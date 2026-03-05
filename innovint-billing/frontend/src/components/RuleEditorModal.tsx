import React, { useState, useEffect } from 'react';
import { RateRule, generateRuleId } from '../api/client';

const ACTION_TYPES = [
  'ANALYSIS', 'CUSTOM', 'STEAM', 'ADDITION',
  'PROCESSFRUITTOVOLUME', 'PROCESSFRUITTOWEIGHT',
  'BOTTLING', 'FILTRATION', 'RACKING', 'BLENDING', 'TOPPING', 'SAMPLING',
  'STORAGE',
];

const BILLING_UNITS = [
  'per hour', 'per barrel', 'per lot', 'per analysis', 'per case',
  'per kg', 'per gallon', 'flat fee', 'per vessel', 'per additive unit',
];

const TEMPLATES: Array<{ name: string; rule: Partial<RateRule> }> = [
  { name: 'Custom Labor (hourly)', rule: { actionType: 'CUSTOM', variation: '', billingUnit: 'per hour' } },
  { name: 'Billable Custom Labor', rule: { actionType: 'CUSTOM', variation: 'BILLABLE', billingUnit: 'per hour' } },
  { name: 'Steam Cleaning (per barrel)', rule: { actionType: 'STEAM', variation: '', billingUnit: 'per barrel' } },
  { name: 'Full Chemistry Panel', rule: { actionType: 'ANALYSIS', variation: 'Full Chemistry', billingUnit: 'per analysis' } },
  { name: 'SO2 Analysis', rule: { actionType: 'ANALYSIS', variation: 'SO2', billingUnit: 'per analysis' } },
  { name: 'Fruit Processing (by volume)', rule: { actionType: 'PROCESSFRUITTOVOLUME', variation: '', billingUnit: 'per gallon' } },
  { name: 'Fruit Processing (by weight)', rule: { actionType: 'PROCESSFRUITTOWEIGHT', variation: '', billingUnit: 'per kg' } },
  { name: 'Additive - SO2', rule: { actionType: 'ADDITION', variation: 'SO2', billingUnit: 'per additive unit' } },
  { name: 'Racking', rule: { actionType: 'RACKING', variation: '', billingUnit: 'per lot' } },
  { name: 'Bottling', rule: { actionType: 'BOTTLING', variation: '', billingUnit: 'per case' } },
  { name: 'Storage - Tank (per gallon)', rule: { actionType: 'STORAGE', variation: 'TANK', billingUnit: 'per gallon' } },
  { name: 'Storage - Barrel (per barrel)', rule: { actionType: 'STORAGE', variation: 'BARREL', billingUnit: 'per barrel' } },
  { name: 'Storage - Keg (per keg)', rule: { actionType: 'STORAGE', variation: 'KEG', billingUnit: 'per vessel' } },
];

function defaultRule(): RateRule {
  return {
    id: generateRuleId(),
    actionType: '',
    variation: '',
    label: '',
    billingUnit: 'flat fee',
    rate: 0,
    setupFee: 0,
    minQty: 0,
    maxQty: Infinity,
    notes: '',
    enabled: true,
  };
}

function variationHint(actionType: string): string {
  switch (actionType) {
    case 'ANALYSIS': return 'Analysis panel or test name (e.g. "Full Chemistry", "SO2")';
    case 'CUSTOM': return 'Custom action name to match (leave blank to match all CUSTOM)';
    case 'STEAM': return 'Leave blank \u2014 STEAM billing is always per-barrel count';
    case 'ADDITION': return 'Additive product name (e.g. "SO2", "Tartaric Acid")';
    case 'PROCESSFRUITTOVOLUME':
    case 'PROCESSFRUITTOWEIGHT': return 'Leave blank \u2014 use Min/Max Qty for range';
    case 'STORAGE': return 'Vessel type: TANK (per gallon), BARREL (per barrel), or KEG (per keg)';
    default: return 'Subtype or variation to match';
  }
}

interface RuleEditorModalProps {
  rule: RateRule | null;
  onSave: (rule: RateRule) => void;
  onSaveAndAdd: (rule: RateRule) => void;
  onClose: () => void;
}

export default function RuleEditorModal({ rule, onSave, onSaveAndAdd, onClose }: RuleEditorModalProps) {
  const [form, setForm] = useState<RateRule>(rule || defaultRule());
  const [labelManual, setLabelManual] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);

  useEffect(() => {
    if (rule) {
      setForm(rule);
      setLabelManual(true);
    } else {
      setForm(defaultRule());
      setLabelManual(false);
    }
  }, [rule]);

  // Auto-populate label
  useEffect(() => {
    if (!labelManual) {
      const parts = [form.actionType, form.variation].filter(Boolean);
      setForm((f) => ({ ...f, label: parts.join(' \u2013 ') || '' }));
    }
  }, [form.actionType, form.variation, labelManual]);

  const update = (field: keyof RateRule, value: unknown) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  const applyTemplate = (tmpl: Partial<RateRule>) => {
    setForm((f) => ({
      ...f,
      ...tmpl,
      id: f.id,
      rate: f.rate,
      setupFee: f.setupFee,
      label: '',
      enabled: true,
    }));
    setLabelManual(false);
  };

  const validate = (): boolean => {
    const errs: string[] = [];
    const warns: string[] = [];
    if (!form.actionType.trim()) errs.push('Action Type is required');
    if (form.rate < 0) errs.push('Rate must be >= 0');
    if (form.setupFee < 0) errs.push('Setup Fee must be >= 0');
    const isFruit = form.actionType === 'PROCESSFRUITTOVOLUME' || form.actionType === 'PROCESSFRUITTOWEIGHT';
    if (isFruit && form.minQty >= form.maxQty && form.maxQty !== Infinity) {
      errs.push('Min Qty must be less than Max Qty');
    }
    if (form.rate === 0 && form.setupFee === 0) {
      warns.push('This rule will always bill $0');
    }
    setErrors(errs);
    setWarnings(warns);
    return errs.length === 0;
  };

  const handleSave = () => {
    if (validate()) onSave(form);
  };

  const handleSaveAndAdd = () => {
    if (validate()) onSaveAndAdd(form);
  };

  const isFruitType = form.actionType === 'PROCESSFRUITTOVOLUME' || form.actionType === 'PROCESSFRUITTOWEIGHT';

  // Live preview
  const sampleQty = 3;
  const previewTotal = sampleQty * form.rate + form.setupFee;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-8 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4 mb-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">{rule ? 'Edit Rule' : 'Add Rule'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        <div className="flex flex-col lg:flex-row">
          {/* Left: Form */}
          <div className="flex-1 p-6 space-y-5">
            {/* Templates (only for new rules) */}
            {!rule && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Start from template</p>
                <div className="flex flex-wrap gap-1.5">
                  {TEMPLATES.map((t) => (
                    <button
                      key={t.name}
                      onClick={() => applyTemplate(t.rule)}
                      className="px-2.5 py-1 text-xs bg-gray-100 hover:bg-blue-50 hover:text-blue-700 rounded-md border border-gray-200 transition-colors"
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Action Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Action Type *</label>
              <input
                list="action-types"
                value={form.actionType}
                onChange={(e) => update('actionType', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                placeholder="Select or type..."
              />
              <datalist id="action-types">
                {ACTION_TYPES.map((t) => <option key={t} value={t} />)}
              </datalist>
            </div>

            {/* Variation */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Variation / Subtype</label>
              <input
                value={form.variation}
                onChange={(e) => update('variation', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                placeholder={variationHint(form.actionType)}
              />
              <p className="text-xs text-gray-400 mt-1">{variationHint(form.actionType)}</p>
            </div>

            {/* Label */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Label</label>
              <input
                value={form.label}
                onChange={(e) => { update('label', e.target.value); setLabelManual(true); }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                placeholder="Auto-generated from type + variation"
              />
            </div>

            {/* Billing Unit */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Billing Unit</label>
              <select
                value={form.billingUnit}
                onChange={(e) => update('billingUnit', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                {BILLING_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>

            {/* Rate + Setup Fee */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rate ($)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.rate}
                  onChange={(e) => update('rate', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Setup Fee ($)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.setupFee}
                  onChange={(e) => update('setupFee', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
                <p className="text-xs text-gray-400 mt-1">One-time fee added per action</p>
              </div>
            </div>

            {/* Min/Max Qty (fruit processing only) */}
            {isFruitType && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Min Tonnage</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={form.minQty}
                    onChange={(e) => update('minQty', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Tonnage</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={form.maxQty === Infinity ? '' : form.maxQty}
                    onChange={(e) => update('maxQty', e.target.value === '' ? Infinity : (parseFloat(e.target.value) || 0))}
                    placeholder="\u221E"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes (internal)</label>
              <textarea
                value={form.notes}
                onChange={(e) => update('notes', e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>

            {/* Enabled */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => update('enabled', e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-sm">Enabled</span>
            </label>

            {/* Errors / Warnings */}
            {errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-md text-sm">
                {errors.map((e, i) => <p key={i}>{e}</p>)}
              </div>
            )}
            {warnings.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 p-3 rounded-md text-sm">
                {warnings.map((w, i) => <p key={i}>{w}</p>)}
              </div>
            )}
          </div>

          {/* Right: Live Preview */}
          <div className="lg:w-72 bg-gray-50 p-6 border-t lg:border-t-0 lg:border-l rounded-br-lg">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Live Preview</p>
            <div className="bg-white border border-gray-200 rounded-md p-4 space-y-2">
              <p className="text-sm text-gray-600">Sample calculation:</p>
              <p className="text-sm font-mono">
                {sampleQty} units &times; ${form.rate.toFixed(2)}
              </p>
              {form.setupFee > 0 && (
                <p className="text-sm font-mono">+ ${form.setupFee.toFixed(2)} setup</p>
              )}
              <hr className="my-2" />
              <p className="text-lg font-bold text-blue-700">= ${previewTotal.toFixed(2)}</p>
            </div>
            {form.label && (
              <div className="mt-4">
                <p className="text-xs text-gray-500">Rule label:</p>
                <p className="text-sm font-medium">{form.label}</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-lg">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
            Cancel
          </button>
          {!rule && (
            <button onClick={handleSaveAndAdd} className="px-4 py-2 text-sm bg-white border border-blue-300 text-blue-600 rounded-md hover:bg-blue-50">
              Save & Add Another
            </button>
          )}
          <button onClick={handleSave} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
