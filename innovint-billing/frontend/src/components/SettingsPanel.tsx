import React, { useState, useEffect } from 'react';
import { getSettings, saveSettings, saveBarrelSnapshots, BarrelSnapshots } from '../api/client';

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

  useEffect(() => {
    getSettings()
      .then((s) => {
        setToken(s.token);
        setWineryId(s.wineryId);
        setHasToken(s.hasToken);
        if (s.barrelSnapshots) setBarrelSnapshots(s.barrelSnapshots);
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
    </div>
  );
}
