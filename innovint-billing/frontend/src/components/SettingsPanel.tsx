import React, { useState, useEffect } from 'react';
import {
  getSettings, saveSettings, saveBarrelSnapshots, BarrelSnapshots,
  FruitIntakeSettings, saveFruitIntakeSettings,
} from '../api/client';

interface SettingsPanelProps {
  onSettingsSaved: () => void;
}

export default function SettingsPanel({ onSettingsSaved }: SettingsPanelProps) {
  const [token, setToken] = useState('');
  const [wineryId, setWineryId] = useState('');
  const [hasToken, setHasToken] = useState(false);
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [barrelSnapshots, setBarrelSnapshots] = useState<BarrelSnapshots>({ snap1Day: 1, snap2Day: 15, snap3Day: 'last' });
  const [snapStatus, setSnapStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [fruitSettings, setFruitSettings] = useState<FruitIntakeSettings>({
    actionTypeKey: 'FRUITINTAKE',
    vintageLookback: 3,
    apiPageDelaySeconds: 5,
    contractLengthRules: [],
    rates: [],
  });
  const [fruitStatus, setFruitStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  useEffect(() => {
    getSettings()
      .then((s) => {
        setToken(s.token);
        setWineryId(s.wineryId);
        setHasToken(s.hasToken);
        if (s.barrelSnapshots) setBarrelSnapshots(s.barrelSnapshots);
        if (s.fruitIntakeSettings) setFruitSettings(s.fruitIntakeSettings);
      })
      .catch(() => {
        // Settings not found yet
      });
  }, []);

  const handleSave = async () => {
    setStatus('saving');
    setErrorMsg('');
    try {
      await saveSettings({ token, wineryId });
      setStatus('success');
      setHasToken(true);
      onSettingsSaved();
      setTimeout(() => setStatus('idle'), 2000);
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save');
    }
  };

  return (
    <div className="max-w-lg">
      <h2 className="text-xl font-semibold mb-4">Settings</h2>
      <p className="text-sm text-gray-500 mb-6">
        Configure your InnoVint API credentials. These are stored locally on your machine.
      </p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Access Token
          </label>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={hasToken ? 'Token saved (enter new to replace)' : 'Enter your InnoVint access token'}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Winery ID
          </label>
          <input
            type="text"
            value={wineryId}
            onChange={(e) => setWineryId(e.target.value)}
            placeholder="e.g. 12345"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={status === 'saving'}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {status === 'saving' ? 'Saving...' : 'Save Settings'}
        </button>

        {status === 'success' && (
          <p className="text-sm text-green-600">Settings saved successfully.</p>
        )}
        {status === 'error' && (
          <p className="text-sm text-red-600">{errorMsg}</p>
        )}
      </div>

      {/* Barrel Inventory Snapshots */}
      <div className="mt-8 pt-8 border-t border-gray-200">
        <h3 className="text-base font-semibold mb-2">Barrel Inventory Snapshots</h3>
        <p className="text-sm text-gray-500 mb-4">
          Three vessel inventory exports are taken per month to calculate average empty barrel counts.
          Set the day-of-month for each snapshot.
        </p>
        <div className="space-y-3 max-w-xs">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Snapshot 1 Day</label>
            <input
              type="number"
              min={1}
              max={31}
              value={barrelSnapshots.snap1Day}
              onChange={(e) => setBarrelSnapshots((prev) => ({ ...prev, snap1Day: parseInt(e.target.value) || 1 }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Snapshot 2 Day</label>
            <input
              type="number"
              min={1}
              max={31}
              value={barrelSnapshots.snap2Day}
              onChange={(e) => setBarrelSnapshots((prev) => ({ ...prev, snap2Day: parseInt(e.target.value) || 15 }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Snapshot 3 Day</label>
            <select
              value={barrelSnapshots.snap3Day === 'last' ? 'last' : String(barrelSnapshots.snap3Day)}
              onChange={(e) => setBarrelSnapshots((prev) => ({
                ...prev,
                snap3Day: e.target.value === 'last' ? 'last' : parseInt(e.target.value),
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="last">Last day of month</option>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <button
            onClick={async () => {
              setSnapStatus('saving');
              try {
                await saveBarrelSnapshots(barrelSnapshots);
                setSnapStatus('success');
                setTimeout(() => setSnapStatus('idle'), 2000);
              } catch {
                setSnapStatus('error');
              }
            }}
            disabled={snapStatus === 'saving'}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {snapStatus === 'saving' ? 'Saving...' : 'Save Snapshot Settings'}
          </button>
          {snapStatus === 'success' && <p className="text-sm text-green-600">Snapshot settings saved.</p>}
          {snapStatus === 'error' && <p className="text-sm text-red-600">Failed to save snapshot settings.</p>}
        </div>
      </div>

      {/* Fruit Intake Settings */}
      <div className="mt-8 pt-8 border-t border-gray-200">
        <h3 className="text-base font-semibold mb-2">Fruit Intake</h3>
        <p className="text-sm text-gray-500 mb-4">
          Configure fruit intake API settings and contract length rules.
        </p>
        <div className="space-y-3 max-w-md">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Action Type Key</label>
            <input
              type="text"
              value={fruitSettings.actionTypeKey}
              onChange={(e) => setFruitSettings((p) => ({ ...p, actionTypeKey: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vintage Lookback</label>
              <input
                type="number"
                min={1}
                max={5}
                value={fruitSettings.vintageLookback}
                onChange={(e) => setFruitSettings((p) => ({ ...p, vintageLookback: parseInt(e.target.value) || 3 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">API Page Delay (s)</label>
              <input
                type="number"
                min={0}
                max={30}
                value={fruitSettings.apiPageDelaySeconds}
                onChange={(e) => setFruitSettings((p) => ({ ...p, apiPageDelaySeconds: parseInt(e.target.value) || 5 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
          </div>

          {/* Contract Length Rules */}
          <div className="mt-4">
            <p className="text-sm font-medium text-gray-700 mb-2">Contract Length Rules</p>
            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_1fr_80px_auto] gap-2 text-xs font-medium text-gray-500 uppercase">
                <span>Color</span>
                <span>Varietal</span>
                <span>Months</span>
                <span></span>
              </div>
              {fruitSettings.contractLengthRules.map((rule, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_1fr_80px_auto] gap-2">
                  <input
                    type="text"
                    value={rule.color}
                    onChange={(e) => {
                      const rules = [...fruitSettings.contractLengthRules];
                      rules[idx] = { ...rules[idx], color: e.target.value };
                      setFruitSettings((p) => ({ ...p, contractLengthRules: rules }));
                    }}
                    className="px-2 py-1.5 border border-gray-300 rounded-md text-sm"
                    placeholder="e.g. red"
                  />
                  <input
                    type="text"
                    value={rule.varietal}
                    onChange={(e) => {
                      const rules = [...fruitSettings.contractLengthRules];
                      rules[idx] = { ...rules[idx], varietal: e.target.value };
                      setFruitSettings((p) => ({ ...p, contractLengthRules: rules }));
                    }}
                    className="px-2 py-1.5 border border-gray-300 rounded-md text-sm"
                    placeholder="(blank = all)"
                  />
                  <input
                    type="number"
                    min={1}
                    value={rule.months}
                    onChange={(e) => {
                      const rules = [...fruitSettings.contractLengthRules];
                      rules[idx] = { ...rules[idx], months: parseInt(e.target.value) || 1 };
                      setFruitSettings((p) => ({ ...p, contractLengthRules: rules }));
                    }}
                    className="px-2 py-1.5 border border-gray-300 rounded-md text-sm"
                  />
                  <button
                    onClick={() => {
                      const rules = fruitSettings.contractLengthRules.filter((_, i) => i !== idx);
                      setFruitSettings((p) => ({ ...p, contractLengthRules: rules }));
                    }}
                    className="px-2 text-red-500 hover:text-red-700 text-sm"
                  >
                    X
                  </button>
                </div>
              ))}
              <button
                onClick={() => {
                  setFruitSettings((p) => ({
                    ...p,
                    contractLengthRules: [...p.contractLengthRules, { color: '', varietal: '', months: 9 }],
                  }));
                }}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
              >
                + Add Rule
              </button>
            </div>
          </div>

          {/* Fruit Intake Rates */}
          <div className="mt-4">
            <p className="text-sm font-medium text-gray-700 mb-2">Rates (per ton by vintage &amp; contract length)</p>
            <div className="space-y-2">
              <div className="grid grid-cols-[100px_120px_120px_auto] gap-2 text-xs font-medium text-gray-500 uppercase">
                <span>Vintage</span>
                <span>Contract (mo)</span>
                <span>Rate/ton ($)</span>
                <span></span>
              </div>
              {(fruitSettings.rates || []).map((rate, idx) => (
                <div key={idx} className="grid grid-cols-[100px_120px_120px_auto] gap-2">
                  <input
                    type="number"
                    value={rate.vintage}
                    onChange={(e) => {
                      const rates = [...(fruitSettings.rates || [])];
                      rates[idx] = { ...rates[idx], vintage: parseInt(e.target.value) || 2026 };
                      setFruitSettings((p) => ({ ...p, rates }));
                    }}
                    className="px-2 py-1.5 border border-gray-300 rounded-md text-sm"
                  />
                  <input
                    type="number"
                    value={rate.contractMonths}
                    onChange={(e) => {
                      const rates = [...(fruitSettings.rates || [])];
                      rates[idx] = { ...rates[idx], contractMonths: parseInt(e.target.value) || 9 };
                      setFruitSettings((p) => ({ ...p, rates }));
                    }}
                    className="px-2 py-1.5 border border-gray-300 rounded-md text-sm"
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={rate.ratePerTon}
                    onChange={(e) => {
                      const rates = [...(fruitSettings.rates || [])];
                      rates[idx] = { ...rates[idx], ratePerTon: parseFloat(e.target.value) || 0 };
                      setFruitSettings((p) => ({ ...p, rates }));
                    }}
                    className="px-2 py-1.5 border border-gray-300 rounded-md text-sm"
                  />
                  <button
                    onClick={() => {
                      const rates = (fruitSettings.rates || []).filter((_, i) => i !== idx);
                      setFruitSettings((p) => ({ ...p, rates }));
                    }}
                    className="px-2 text-red-500 hover:text-red-700 text-sm"
                  >
                    X
                  </button>
                </div>
              ))}
              <button
                onClick={() => {
                  setFruitSettings((p) => ({
                    ...p,
                    rates: [...(p.rates || []), { vintage: new Date().getFullYear(), contractMonths: 9, ratePerTon: 0 }],
                  }));
                }}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
              >
                + Add Rate
              </button>
            </div>
          </div>

          <button
            onClick={async () => {
              setFruitStatus('saving');
              try {
                await saveFruitIntakeSettings(fruitSettings);
                setFruitStatus('success');
                setTimeout(() => setFruitStatus('idle'), 2000);
              } catch {
                setFruitStatus('error');
              }
            }}
            disabled={fruitStatus === 'saving'}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {fruitStatus === 'saving' ? 'Saving...' : 'Save Fruit Intake Settings'}
          </button>
          {fruitStatus === 'success' && <p className="text-sm text-green-600">Fruit intake settings saved.</p>}
          {fruitStatus === 'error' && <p className="text-sm text-red-600">Failed to save fruit intake settings.</p>}
        </div>
      </div>
    </div>
  );
}
