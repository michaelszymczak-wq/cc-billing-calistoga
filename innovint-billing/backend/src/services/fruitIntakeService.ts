import {
  ContractLengthRule,
  FruitInstallment,
  FruitIntakeApiItem,
  FruitIntakeRate,
  FruitIntakeRecord,
  FruitIntakeRunResult,
  FruitIntakeSettings,
  ProgressEvent,
} from '../types';
import { cleanKey } from './rateMapper';

const BASE_URL = 'https://sutter.innovint.us';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch fruit intake report from InnoVint API with pagination.
 */
export async function fetchFruitIntakeReport(
  wineryId: string,
  token: string,
  vintages: number[],
  pageDelaySeconds: number,
  onProgress: (event: ProgressEvent) => void
): Promise<FruitIntakeApiItem[]> {
  const allItems: FruitIntakeApiItem[] = [];
  let offset = 0;
  const size = 200;
  const maxPages = 50;
  let page = 0;

  while (page < maxPages) {
    const url = new URL(`${BASE_URL}/wineries/${wineryId}/components/fruitIntakeReport`);
    url.searchParams.set('size', String(size));
    url.searchParams.set('offset', String(offset));
    url.searchParams.set('states', 'ACTIVE');
    url.searchParams.set('vintages', vintages.join(','));

    onProgress({
      step: 'fruit-intake',
      message: `Fetching fruit intake page ${page + 1} (offset ${offset})...`,
      pct: Math.min(50, Math.round((page / 10) * 50)),
    });

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Access-Token ${token}`,
          'Accept': 'application/json',
        },
      });
    } catch (err) {
      onProgress({
        step: 'fruit-intake',
        message: `Network error on page ${page + 1}: ${err instanceof Error ? err.message : 'Unknown error'}`,
        pct: -1,
      });
      break;
    }

    if (response.status === 429) {
      onProgress({
        step: 'fruit-intake',
        message: 'Rate limited by InnoVint API. Stopping pagination.',
        pct: -1,
      });
      break;
    }

    if (!response.ok) {
      let body = '';
      try { body = await response.text(); } catch { /* ignore */ }
      onProgress({
        step: 'fruit-intake',
        message: `API error ${response.status}: ${response.statusText}. ${body.slice(0, 200)}`,
        pct: -1,
      });
      break;
    }

    const data = (await response.json()) as unknown;
    const items: FruitIntakeApiItem[] = Array.isArray(data) ? data : [];

    // Filter out voided records
    const active = items.filter((item) => !item.voided);
    allItems.push(...active);

    if (items.length < size) break;
    offset += items.length;
    page++;

    if (page < maxPages && pageDelaySeconds > 0) {
      await delay(pageDelaySeconds * 1000);
    }
  }

  onProgress({
    step: 'fruit-intake',
    message: `Fetched ${allItems.length} fruit intake records.`,
    pct: 50,
  });

  return allItems;
}

/**
 * Get contract length in months based on color/varietal rules.
 * More-specific rules (color+varietal) match before color-only.
 */
export function getContractLengthMonths(
  color: string,
  varietal: string,
  rules: ContractLengthRule[]
): number {
  const cleanColor = cleanKey(color);
  const cleanVarietal = cleanKey(varietal);

  // First pass: try exact color+varietal match
  for (const rule of rules) {
    if (cleanKey(rule.color) === cleanColor && rule.varietal && cleanKey(rule.varietal) === cleanVarietal) {
      return rule.months;
    }
  }

  // Second pass: color-only match (varietal is empty)
  for (const rule of rules) {
    if (cleanKey(rule.color) === cleanColor && !rule.varietal) {
      return rule.months;
    }
  }

  return 0;
}

/**
 * Look up the contract rate from the fruit intake rates table.
 * Matches on vintage + contract length in months.
 */
export function lookupContractRate(
  vintage: number,
  contractMonths: number,
  rates: FruitIntakeRate[]
): number {
  // Exact match on vintage + contract length
  for (const r of rates) {
    if (r.vintage === vintage && r.contractMonths === contractMonths) {
      return r.ratePerTon;
    }
  }

  // Fallback: match contract length only (any vintage)
  for (const r of rates) {
    if (r.contractMonths === contractMonths) {
      return r.ratePerTon;
    }
  }

  return 0;
}

/**
 * Generate monthly installments for a contract.
 */
export function generateInstallments(
  contractStartMonth: string,
  contractLengthMonths: number,
  monthlyAmount: number
): FruitInstallment[] {
  const installments: FruitInstallment[] = [];
  const parts = contractStartMonth.split(' ');
  if (parts.length !== 2) return installments;

  let monthIdx = MONTHS.indexOf(parts[0]);
  let year = parseInt(parts[1], 10);
  if (monthIdx === -1 || isNaN(year)) return installments;

  for (let i = 0; i < contractLengthMonths; i++) {
    installments.push({
      month: `${MONTHS[monthIdx]} ${year}`,
      amount: monthlyAmount,
    });
    monthIdx++;
    if (monthIdx >= 12) {
      monthIdx = 0;
      year++;
    }
  }

  return installments;
}

/**
 * Determine contract start month: the month after the effective date.
 */
function getContractStartMonth(effectiveDate: string): string {
  const date = new Date(effectiveDate);
  let monthIdx = date.getUTCMonth() + 1;
  let year = date.getUTCFullYear();
  if (monthIdx >= 12) {
    monthIdx = 0;
    year++;
  }
  return `${MONTHS[monthIdx]} ${year}`;
}

/**
 * Get the contract end month from start + length.
 */
export function getContractEndMonth(contractStartMonth: string, lengthMonths: number): string {
  if (lengthMonths <= 0) return contractStartMonth;
  const installments = generateInstallments(contractStartMonth, lengthMonths, 0);
  return installments.length > 0 ? installments[installments.length - 1].month : contractStartMonth;
}

/**
 * Process a single raw fruit intake API item into a FruitIntakeRecord.
 */
export function processRawRecord(
  item: FruitIntakeApiItem,
  customerMap: Record<string, string>,
  contractRules: ContractLengthRule[],
  rates: FruitIntakeRate[]
): FruitIntakeRecord {
  const lotCode = item.lot?.lotCode || '';
  const color = item.lot?.color || '';
  const varietal = item.varietal?.name || '';
  const fruitWeightTons = item.fruitWeight?.value || 0;
  const effectiveDate = item.effectiveAt || '';
  const vintage = item.vintage || 0;
  const weighTagNumber = item.weighTagNumber || '';

  // Owner: from access.owners[0].name
  const ownerName = item.access?.owners?.[0]?.name || '';

  // Map owner name to code: check customerMap, fallback to lotCode extraction, then UNMAPPED
  let ownerCode: string;
  if (ownerName && customerMap[ownerName]) {
    ownerCode = customerMap[ownerName];
  } else if (lotCode.length >= 7) {
    ownerCode = lotCode.substring(4, 7);
  } else {
    ownerCode = 'UNMAPPED';
  }

  const contractLengthMonths = getContractLengthMonths(color, varietal, contractRules);
  const contractRatePerTon = lookupContractRate(vintage, contractLengthMonths, rates);
  const totalCost = fruitWeightTons * contractRatePerTon;
  const monthlyAmount = contractLengthMonths > 0 ? Math.round((totalCost / contractLengthMonths) * 100) / 100 : 0;
  const contractStartMonth = getContractStartMonth(effectiveDate);
  const contractEndMonth = getContractEndMonth(contractStartMonth, contractLengthMonths);
  const installments = generateInstallments(contractStartMonth, contractLengthMonths, monthlyAmount);

  return {
    id: `fi_${item.eventId}_${item.actionId}`,
    eventId: String(item.eventId),
    actionId: String(item.actionId),
    vintage,
    effectiveDate,
    weighTagNumber,
    ownerName,
    ownerCode,
    lotCode,
    varietal,
    color,
    fruitWeightTons,
    contractLengthMonths,
    contractRatePerTon,
    totalCost,
    monthlyAmount,
    contractStartMonth,
    contractEndMonth,
    installments,
    savedAt: new Date().toISOString(),
  };
}

/**
 * Recalculate a record with a new contract length.
 */
export function recalculateRecord(
  record: FruitIntakeRecord,
  newContractLengthMonths: number,
  rates: FruitIntakeRate[]
): FruitIntakeRecord {
  const contractRatePerTon = lookupContractRate(record.vintage, newContractLengthMonths, rates);
  const totalCost = record.fruitWeightTons * contractRatePerTon;
  const monthlyAmount = newContractLengthMonths > 0
    ? Math.round((totalCost / newContractLengthMonths) * 100) / 100
    : 0;
  const contractEndMonth = getContractEndMonth(record.contractStartMonth, newContractLengthMonths);
  const installments = generateInstallments(record.contractStartMonth, newContractLengthMonths, monthlyAmount);

  return {
    ...record,
    contractLengthMonths: newContractLengthMonths,
    contractRatePerTon,
    totalCost,
    monthlyAmount,
    contractEndMonth,
    installments,
  };
}

/**
 * Main entry: fetch, dedup, process, merge with existing records.
 */
export async function runFruitIntake(
  wineryId: string,
  token: string,
  settings: FruitIntakeSettings,
  customerMap: Record<string, string>,
  existingRecords: FruitIntakeRecord[],
  onProgress: (event: ProgressEvent) => void
): Promise<FruitIntakeRunResult> {
  const currentYear = new Date().getFullYear();
  const vintages: number[] = [];
  for (let i = 0; i < settings.vintageLookback; i++) {
    vintages.push(currentYear - i);
  }

  onProgress({
    step: 'fruit-intake',
    message: `Querying vintages: ${vintages.join(', ')}`,
    pct: 5,
  });

  const rawItems = await fetchFruitIntakeReport(
    wineryId,
    token,
    vintages,
    settings.apiPageDelaySeconds,
    onProgress
  );

  // Build dedup sets from existing records
  const existingEventIds = new Set(existingRecords.map((r) => r.eventId));
  const existingCompositeKeys = new Set(
    existingRecords.map((r) => `${r.lotCode}_${r.vintage}_${r.effectiveDate}`)
  );

  let newCount = 0;
  let dupCount = 0;
  const newRecords: FruitIntakeRecord[] = [];

  onProgress({
    step: 'fruit-intake',
    message: `Processing ${rawItems.length} records...`,
    pct: 60,
  });

  for (const item of rawItems) {
    const eventId = String(item.eventId);
    const compositeKey = `${item.lot?.lotCode || ''}_${item.vintage}_${item.effectiveAt}`;

    // Tier 1: exact eventId dedup
    if (existingEventIds.has(eventId)) {
      dupCount++;
      continue;
    }

    // Tier 2: composite key dedup
    if (existingCompositeKeys.has(compositeKey)) {
      dupCount++;
      continue;
    }

    const record = processRawRecord(
      item,
      customerMap,
      settings.contractLengthRules,
      settings.rates || []
    );

    newRecords.push(record);
    existingEventIds.add(eventId);
    existingCompositeKeys.add(compositeKey);
    newCount++;
  }

  // Merge: existing + new
  const allRecords = [...existingRecords, ...newRecords];

  onProgress({
    step: 'fruit-intake',
    message: `Done. ${newCount} new records, ${dupCount} duplicates skipped.`,
    pct: 90,
  });

  return {
    runId: `run_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    ranAt: new Date().toISOString(),
    vintagesQueried: vintages,
    totalRecords: allRecords.length,
    newRecords: newCount,
    duplicatesSkipped: dupCount,
    records: allRecords,
  };
}
