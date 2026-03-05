import { ActionRow, AuditRow, RateRule } from '../types';

/**
 * Clean a string for matching: trim, uppercase, strip all whitespace.
 */
export function cleanKey(v: string): string {
  return v.toString().trim().toUpperCase().replace(/\s/g, '');
}

interface RateMatch {
  matched: boolean;
  rate: number;
  setupFee: number;
  total: number;
  ruleLabel: string;
  reason?: string;
}

/**
 * Find a matching rate rule for a given action row.
 *
 * Lookup order:
 * 1. ANALYSIS: match on actionType=ANALYSIS AND cleanKey(variation)=cleanKey(analysisName)
 * 2. BILLABLE keyword in notes/name → match variation="BILLABLE"
 * 3. PROCESSFRUITTOVOLUME/WEIGHT → range-based on qty
 * 4. Exact match: actionType + variation
 * 5. Prefix match: actionType with blank variation (catch-all for that type)
 */
function findRate(
  rules: RateRule[],
  actionType: string,
  variation: string,
  qty: number,
  notes: string,
  actionName: string,
  hours: number
): RateMatch {
  const cleanActionType = cleanKey(actionType);
  const cleanVariation = cleanKey(variation);
  const combinedText = `${notes} ${actionName}`;

  // 1. ANALYSIS match
  if (cleanActionType === 'ANALYSIS') {
    for (const rule of rules) {
      if (!rule.enabled) continue;
      if (cleanKey(rule.actionType) !== 'ANALYSIS') continue;
      if (cleanKey(rule.variation) === cleanVariation && cleanVariation !== '') {
        const effectiveQty = qty || 1;
        return {
          matched: true,
          rate: rule.rate,
          setupFee: rule.setupFee,
          total: effectiveQty * rule.rate + rule.setupFee,
          ruleLabel: rule.label,
        };
      }
    }
    return {
      matched: false,
      rate: 0,
      setupFee: 0,
      total: 0,
      ruleLabel: '',
      reason: `No rate rule for analysis type: ${variation}`,
    };
  }

  // 2. BILLABLE keyword
  if (/billable/i.test(combinedText)) {
    for (const rule of rules) {
      if (!rule.enabled) continue;
      if (cleanKey(rule.variation) === 'BILLABLE') {
        const effectiveQty = hours || qty || 1;
        return {
          matched: true,
          rate: rule.rate,
          setupFee: rule.setupFee,
          total: effectiveQty * rule.rate + rule.setupFee,
          ruleLabel: rule.label,
        };
      }
    }
  }

  // 3. PROCESSFRUITTOVOLUME / PROCESSFRUITTOWEIGHT — range-based
  if (cleanActionType === 'PROCESSFRUITTOVOLUME' || cleanActionType === 'PROCESSFRUITTOWEIGHT') {
    for (const rule of rules) {
      if (!rule.enabled) continue;
      if (cleanKey(rule.actionType) !== cleanActionType) continue;
      const min = rule.minQty ?? 0;
      const max = rule.maxQty === null || rule.maxQty === undefined ? Infinity : rule.maxQty;
      if (qty >= min && qty <= max) {
        return {
          matched: true,
          rate: rule.rate,
          setupFee: rule.setupFee,
          total: qty * rule.rate + rule.setupFee,
          ruleLabel: rule.label,
        };
      }
    }
    return {
      matched: false,
      rate: 0,
      setupFee: 0,
      total: 0,
      ruleLabel: '',
      reason: `No rate rule for ${actionType} with qty ${qty}`,
    };
  }

  // 4. Exact match: actionType + variation
  for (const rule of rules) {
    if (!rule.enabled) continue;
    if (cleanKey(rule.actionType) !== cleanActionType) continue;
    const ruleVar = cleanKey(rule.variation);
    if (ruleVar !== '' && ruleVar === cleanVariation) {
      const effectiveQty = hours || qty || 1;
      return {
        matched: true,
        rate: rule.rate,
        setupFee: rule.setupFee,
        total: effectiveQty * rule.rate + rule.setupFee,
        ruleLabel: rule.label,
      };
    }
  }

  // Also try matching variation against vessel types or action name
  if (actionName) {
    const cleanName = cleanKey(actionName);
    for (const rule of rules) {
      if (!rule.enabled) continue;
      if (cleanKey(rule.actionType) !== cleanActionType) continue;
      const ruleVar = cleanKey(rule.variation);
      if (ruleVar !== '' && ruleVar === cleanName) {
        const effectiveQty = hours || qty || 1;
        return {
          matched: true,
          rate: rule.rate,
          setupFee: rule.setupFee,
          total: effectiveQty * rule.rate + rule.setupFee,
          ruleLabel: rule.label,
        };
      }
    }
  }

  // 5. Prefix match: actionType with blank variation (catch-all)
  for (const rule of rules) {
    if (!rule.enabled) continue;
    if (cleanKey(rule.actionType) !== cleanActionType) continue;
    const ruleVar = cleanKey(rule.variation);
    if (ruleVar === '') {
      const effectiveQty = hours || qty || 1;
      return {
        matched: true,
        rate: rule.rate,
        setupFee: rule.setupFee,
        total: effectiveQty * rule.rate + rule.setupFee,
        ruleLabel: rule.label,
      };
    }
  }

  return {
    matched: false,
    rate: 0,
    setupFee: 0,
    total: 0,
    ruleLabel: '',
    reason: `No rate rule found for action type: ${actionType}`,
  };
}

/**
 * Apply rate rules to all action rows.
 */
export function applyRateMapping(
  rows: ActionRow[],
  rules: RateRule[]
): { matched: ActionRow[]; auditRows: AuditRow[] } {
  const auditRows: AuditRow[] = [];

  const updatedRows = rows.map((row) => {
    const result = findRate(
      rules,
      row.actionType,
      row.analysisOrNotes,
      row.quantity || 0,
      row.analysisOrNotes,
      row.analysisOrNotes,
      row.hours
    );

    const updatedRow: ActionRow = {
      ...row,
      rate: result.rate,
      setupFee: result.setupFee,
      total: result.total,
      matched: result.matched,
      matchedRuleLabel: result.matched ? result.ruleLabel : '',
    };

    if (!result.matched) {
      auditRows.push({
        actionType: row.actionType,
        actionId: row.actionId,
        lotCodes: row.lotCodes,
        performer: row.performer,
        date: row.date,
        ownerCode: row.ownerCode,
        analysisOrNotes: row.analysisOrNotes,
        reason: result.reason || 'No matching rate rule',
      });
    }

    return updatedRow;
  });

  return { matched: updatedRows, auditRows };
}
