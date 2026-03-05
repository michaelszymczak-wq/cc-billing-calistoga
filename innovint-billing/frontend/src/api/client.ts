const BASE_URL = '/api';

// ─── Shared Types ───

export interface RateRule {
  id: string;
  actionType: string;
  variation: string;
  label: string;
  billingUnit: string;
  rate: number;
  setupFee: number;
  minQty: number;
  maxQty: number;
  notes: string;
  enabled: boolean;
}

export interface BarrelBillingRow {
  ownerCode: string;
  snap1: number;
  snap2: number;
  snap3: number;
  avgBarrels: number;
  rate: number;
  charge: number;
}

export interface BarrelSnapshots {
  snap1Day: number;
  snap2Day: number;
  snap3Day: number | 'last';
}

export interface AppConfig {
  token: string;
  wineryId: string;
  hasToken: boolean;
  rateRules: RateRule[];
  lastUsedMonth: string;
  lastUsedYear: number;
  barrelSnapshots: BarrelSnapshots;
}

export interface ActionRow {
  actionType: string;
  actionId: string;
  lotCodes: string;
  performer: string;
  date: string;
  ownerCode: string;
  analysisOrNotes: string;
  hours: number;
  rate: number;
  setupFee: number;
  total: number;
  matched: boolean;
  matchedRuleLabel: string;
  error?: string;
}

export interface AuditRow {
  actionType: string;
  actionId: string;
  lotCodes: string;
  performer: string;
  date: string;
  ownerCode: string;
  analysisOrNotes: string;
  reason: string;
}

export interface BulkBillingRow {
  ownerCode: string;
  lotCode: string;
  tankVolume: number;
  barrelCount: number;
  kegCount: number;
  tankDaysPresent: number;
  barrelDaysPresent: number;
  kegDaysPresent: number;
  totalDays: number;
  tankPct: number;
  barrelPct: number;
  kegPct: number;
  tankRate: number;
  barrelRate: number;
  kegRate: number;
  tankCost: number;
  barrelCost: number;
  kegCost: number;
  totalCost: number;
}

export interface BillingResults {
  actions: ActionRow[];
  auditRows: AuditRow[];
  bulkInventory: BulkBillingRow[];
  barrelInventory: BarrelBillingRow[];
  summary: {
    totalActions: number;
    totalBilled: number;
    auditCount: number;
    bulkLots: number;
    barrelOwners: number;
  };
}

// ─── API Functions ───

export async function getSettings(): Promise<AppConfig> {
  const res = await fetch(`${BASE_URL}/settings`);
  if (!res.ok) throw new Error('Failed to load settings');
  return res.json();
}

export async function saveSettings(data: {
  token?: string;
  wineryId?: string;
  rateRules?: RateRule[];
  lastUsedMonth?: string;
  lastUsedYear?: number;
}): Promise<{ success: boolean }> {
  const res = await fetch(`${BASE_URL}/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to save settings');
  return res.json();
}

export async function saveRateRules(rules: RateRule[]): Promise<{ success: boolean }> {
  const res = await fetch(`${BASE_URL}/settings/rate-rules`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rules),
  });
  if (!res.ok) throw new Error('Failed to save rate rules');
  return res.json();
}

export async function saveBillingPrefs(prefs: { lastUsedMonth?: string; lastUsedYear?: number }): Promise<void> {
  await fetch(`${BASE_URL}/settings/billing-prefs`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(prefs),
  });
}

export async function runBilling(params: {
  month: string;
  year: number;
  rateRules: RateRule[];
  steps: string[];
}): Promise<{ sessionId: string }> {
  const res = await fetch(`${BASE_URL}/run-billing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to start billing');
  }
  return res.json();
}

export function subscribeToBillingProgress(
  sessionId: string,
  onEvent: (event: { step: string; message: string; pct: number }) => void,
  onError?: (err: Event) => void
): EventSource {
  const es = new EventSource(`${BASE_URL}/billing-progress?sessionId=${sessionId}`);
  es.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      onEvent(data);
    } catch {
      // ignore
    }
  };
  if (onError) es.onerror = onError;
  return es;
}

export async function getBillingResults(sessionId: string): Promise<BillingResults> {
  const res = await fetch(`${BASE_URL}/billing-results?sessionId=${sessionId}`);
  if (!res.ok) throw new Error('Results not ready');
  return res.json();
}

export function getExcelDownloadUrl(sessionId: string): string {
  return `${BASE_URL}/export-excel?sessionId=${sessionId}`;
}

export async function saveBarrelSnapshots(snapshots: BarrelSnapshots): Promise<{ success: boolean }> {
  const res = await fetch(`${BASE_URL}/settings/barrel-snapshots`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(snapshots),
  });
  if (!res.ok) throw new Error('Failed to save barrel snapshots');
  return res.json();
}

// ─── Helpers ───

export function generateRuleId(): string {
  return `rule_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
