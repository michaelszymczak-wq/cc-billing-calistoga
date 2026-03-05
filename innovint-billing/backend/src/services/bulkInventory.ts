import { BulkBillingRow, InventoryLot, LotSnapshot, ProgressEvent, RateRule } from '../types';
import { fetchInventorySnapshot, getDaysInMonth, getMonthIndex } from './innovintApi';

const THROTTLE_MS = 1200;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanKey(v: string): string {
  return v.trim().toUpperCase().replace(/\s/g, '');
}

/**
 * Extract storage rates from rate rules.
 * Looks for enabled rules with actionType=STORAGE and variation=TANK/BARREL/KEG.
 * TANK is billed per gallon, BARREL and KEG per unit count.
 */
function extractStorageRates(rules: RateRule[]): { TANK: number; BARREL: number; KEG: number } {
  const rates = { TANK: 0, BARREL: 0, KEG: 0 };

  for (const rule of rules) {
    if (!rule.enabled) continue;
    if (cleanKey(rule.actionType) !== 'STORAGE') continue;
    const variation = cleanKey(rule.variation);
    if (variation === 'TANK') rates.TANK = rule.rate;
    else if (variation === 'BARREL') rates.BARREL = rule.rate;
    else if (variation === 'KEG') rates.KEG = rule.rate;
  }

  return rates;
}

/**
 * Extract owner code from lot code (positions 4–6).
 */
function lotOwnerCode(lotCode: string): string {
  if (lotCode.length >= 7) {
    return lotCode.substring(4, 7);
  }
  return 'UNK';
}

/**
 * Check if a lot has a BULK tag.
 */
function isBulkLot(item: InventoryLot): boolean {
  if (!item.tags) return false;
  return item.tags.some((tag) => tag === 'BULK' || tag === 'Bulk');
}

/**
 * Accumulate a single day's inventory snapshot into the tracking map.
 */
function accumulateSnapshot(
  items: InventoryLot[],
  dayKey: string,
  lotMap: Map<string, LotSnapshot>,
  admittedLots: Set<string>
): void {
  for (const item of items) {
    const code = item.lot?.lotCode;
    if (!code) continue;

    // Once admitted (tagged BULK), always tracked
    if (!admittedLots.has(code) && !isBulkLot(item)) {
      continue;
    }
    admittedLots.add(code);

    let snapshot = lotMap.get(code);
    if (!snapshot) {
      snapshot = {
        lotCode: code,
        ownerCode: lotOwnerCode(code),
        totalVolume: 0,
        tankVolume: 0,
        barrelCount: 0,
        kegCount: 0,
        tankDays: new Set<string>(),
        barrelDays: new Set<string>(),
        kegDays: new Set<string>(),
        maxBarrelCount: 0,
        maxKegCount: 0,
      };
      lotMap.set(code, snapshot);
    }

    const totalVolume = item.volume?.value || 0;

    // Check if any vessel is a TANK
    const hasTank = item.vessels?.some(
      (v) => (v.vesselType || '').toUpperCase() === 'TANK'
    ) ?? false;

    if (hasTank) {
      // When lot is in a TANK, volume = lot contents; ignore barrels/kegs
      snapshot.tankDays.add(dayKey);
      snapshot.totalVolume = Math.max(snapshot.totalVolume, totalVolume);
      snapshot.tankVolume = Math.max(snapshot.tankVolume, totalVolume);
    } else {
      // No tank — count barrels and kegs
      let barrelCount = 0;
      let kegCount = 0;

      if (item.vessels) {
        for (const vessel of item.vessels) {
          const vt = (vessel.vesselType || '').toUpperCase();
          if (vt === 'BARREL') {
            barrelCount++;
            snapshot.barrelDays.add(dayKey);
          } else if (vt === 'KEG') {
            kegCount++;
            snapshot.kegDays.add(dayKey);
          }
        }
      }

      snapshot.totalVolume = Math.max(snapshot.totalVolume, totalVolume);
      snapshot.maxBarrelCount = Math.max(snapshot.maxBarrelCount, barrelCount);
      snapshot.maxKegCount = Math.max(snapshot.maxKegCount, kegCount);
      snapshot.barrelCount = Math.max(snapshot.barrelCount, barrelCount);
      snapshot.kegCount = Math.max(snapshot.kegCount, kegCount);
    }
  }
}

/**
 * Build billing rows from accumulated lot snapshots.
 * TANK: billed by gallons (tankVolume * prorate * rate)
 * BARREL/KEG: billed by count (count * prorate * rate)
 */
function buildBillingRows(
  lotMap: Map<string, LotSnapshot>,
  totalDays: number,
  rates: { TANK: number; BARREL: number; KEG: number }
): BulkBillingRow[] {
  const rows: BulkBillingRow[] = [];

  for (const snapshot of lotMap.values()) {
    const tankDaysPresent = snapshot.tankDays.size;
    const barrelDaysPresent = snapshot.barrelDays.size;
    const kegDaysPresent = snapshot.kegDays.size;

    const tankPct = (tankDaysPresent / totalDays) * 100;
    const barrelPct = (barrelDaysPresent / totalDays) * 100;
    const kegPct = (kegDaysPresent / totalDays) * 100;

    const tankCost = snapshot.tankVolume * (tankPct / 100) * rates.TANK;
    const barrelCost = snapshot.maxBarrelCount * (barrelPct / 100) * rates.BARREL;
    const kegCost = snapshot.maxKegCount * (kegPct / 100) * rates.KEG;

    rows.push({
      ownerCode: snapshot.ownerCode,
      lotCode: snapshot.lotCode,
      tankVolume: snapshot.tankVolume,
      barrelCount: snapshot.maxBarrelCount,
      kegCount: snapshot.maxKegCount,
      tankDaysPresent,
      barrelDaysPresent,
      kegDaysPresent,
      totalDays,
      tankPct: Math.round(tankPct * 100) / 100,
      barrelPct: Math.round(barrelPct * 100) / 100,
      kegPct: Math.round(kegPct * 100) / 100,
      tankRate: rates.TANK,
      barrelRate: rates.BARREL,
      kegRate: rates.KEG,
      tankCost: Math.round(tankCost * 100) / 100,
      barrelCost: Math.round(barrelCost * 100) / 100,
      kegCost: Math.round(kegCost * 100) / 100,
      totalCost: Math.round((tankCost + barrelCost + kegCost) * 100) / 100,
    });
  }

  // Sort: ownerCode ASC → lotCode ASC
  rows.sort((a, b) => {
    const oc = a.ownerCode.localeCompare(b.ownerCode);
    if (oc !== 0) return oc;
    return a.lotCode.localeCompare(b.lotCode);
  });

  return rows;
}

/**
 * Run the full bulk inventory billing process (Step 3).
 * Reads STORAGE rates from the rate rules table.
 */
export async function runBulkInventory(
  wineryId: string,
  token: string,
  month: string,
  year: number,
  rateRules: RateRule[],
  onProgress: (event: ProgressEvent) => void
): Promise<BulkBillingRow[]> {
  const monthIndex = getMonthIndex(month);
  const totalDays = getDaysInMonth(month, year);
  const rates = extractStorageRates(rateRules);

  onProgress({
    step: 'bulk',
    message: `Starting bulk inventory for ${month} ${year} (${totalDays} days). Rates: Tank $${rates.TANK}/gal, Barrel $${rates.BARREL}/ea, Keg $${rates.KEG}/ea`,
    pct: 60,
  });

  if (rates.TANK === 0 && rates.BARREL === 0 && rates.KEG === 0) {
    onProgress({
      step: 'bulk',
      message: 'Warning: All STORAGE rates are $0. Add STORAGE rules in the Rate Table to bill for bulk inventory.',
      pct: -1,
    });
  }

  // Build timestamps: one per calendar day at 23:59:00 UTC
  const timestamps: { day: number; ts: string; key: string }[] = [];
  for (let day = 1; day <= totalDays; day++) {
    const date = new Date(Date.UTC(year, monthIndex, day, 23, 59, 0));
    timestamps.push({
      day,
      ts: date.toISOString(),
      key: `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    });
  }

  const lotMap = new Map<string, LotSnapshot>();
  const admittedLots = new Set<string>();

  for (let i = 0; i < timestamps.length; i++) {
    const { day, ts, key } = timestamps[i];

    onProgress({
      step: 'bulk',
      message: `Fetching inventory for day ${day}/${totalDays}...`,
      pct: 60 + Math.round((i / totalDays) * 35),
    });

    try {
      const lots = await fetchInventorySnapshot(wineryId, token, ts, (msg) => {
        onProgress({ step: 'bulk', message: msg, pct: -1 });
      });

      accumulateSnapshot(lots, key, lotMap, admittedLots);
    } catch (err) {
      onProgress({
        step: 'bulk',
        message: `Warning: Failed to fetch day ${day}: ${err instanceof Error ? err.message : 'Unknown error'}`,
        pct: -1,
      });
    }

    // Throttle between day-level calls
    if (i < timestamps.length - 1) {
      await sleep(THROTTLE_MS);
    }
  }

  onProgress({
    step: 'bulk',
    message: `Building billing rows for ${lotMap.size} tracked lots...`,
    pct: 96,
  });

  const billingRows = buildBillingRows(lotMap, totalDays, rates);

  onProgress({
    step: 'bulk',
    message: `Bulk inventory complete: ${billingRows.length} billing rows generated.`,
    pct: 100,
  });

  return billingRows;
}
