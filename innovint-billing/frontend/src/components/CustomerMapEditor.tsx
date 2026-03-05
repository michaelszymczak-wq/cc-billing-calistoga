import React, { useState, useEffect } from 'react';
import { saveCustomerMap } from '../api/client';

interface CustomerMapEditorProps {
  customerMap: Record<string, string>;
  onSaved: (map: Record<string, string>) => void;
  unmappedOwners?: string[];
}

export default function CustomerMapEditor({ customerMap, onSaved, unmappedOwners = [] }: CustomerMapEditorProps) {
  const [entries, setEntries] = useState<Array<{ name: string; code: string }>>([]);
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  useEffect(() => {
    const existing = Object.entries(customerMap).map(([name, code]) => ({ name, code }));
    // Add unmapped owners not already in the map
    for (const owner of unmappedOwners) {
      if (!customerMap[owner]) {
        existing.push({ name: owner, code: '' });
      }
    }
    setEntries(existing.length > 0 ? existing : [{ name: '', code: '' }]);
  }, [customerMap, unmappedOwners]);

  const updateEntry = (idx: number, field: 'name' | 'code', value: string) => {
    setEntries((prev) => prev.map((e, i) => (i === idx ? { ...e, [field]: value } : e)));
  };

  const addRow = () => setEntries((prev) => [...prev, { name: '', code: '' }]);

  const removeRow = (idx: number) => {
    setEntries((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    setStatus('saving');
    const map: Record<string, string> = {};
    for (const entry of entries) {
      if (entry.name.trim() && entry.code.trim()) {
        map[entry.name.trim()] = entry.code.trim();
      }
    }
    try {
      await saveCustomerMap(map);
      setStatus('success');
      onSaved(map);
      setTimeout(() => setStatus('idle'), 2000);
    } catch {
      setStatus('error');
    }
  };

  const unmappedCount = entries.filter((e) => e.name.trim() && !e.code.trim()).length;

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <h3 className="text-base font-semibold">Customer Mapping</h3>
        {unmappedCount > 0 && (
          <span className="px-2 py-0.5 text-xs rounded-full bg-amber-500 text-white">
            {unmappedCount} unmapped
          </span>
        )}
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Map InnoVint owner names to billing customer codes.
      </p>

      <div className="space-y-2">
        <div className="grid grid-cols-[1fr_1fr_auto] gap-2 text-xs font-medium text-gray-500 uppercase">
          <span>Owner Name</span>
          <span>Customer Code</span>
          <span></span>
        </div>
        {entries.map((entry, idx) => (
          <div key={idx} className="grid grid-cols-[1fr_1fr_auto] gap-2">
            <input
              type="text"
              value={entry.name}
              onChange={(e) => updateEntry(idx, 'name', e.target.value)}
              placeholder="Owner name from InnoVint"
              className={`px-3 py-1.5 border rounded-md text-sm ${
                entry.name.trim() && !entry.code.trim() ? 'border-amber-400 bg-amber-50' : 'border-gray-300'
              }`}
            />
            <input
              type="text"
              value={entry.code}
              onChange={(e) => updateEntry(idx, 'code', e.target.value)}
              placeholder="e.g. ABC"
              className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
            />
            <button
              onClick={() => removeRow(idx)}
              className="px-2 text-red-500 hover:text-red-700 text-sm"
              title="Remove row"
            >
              X
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 mt-3">
        <button
          onClick={addRow}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
        >
          + Add Row
        </button>
        <button
          onClick={handleSave}
          disabled={status === 'saving'}
          className="px-4 py-1.5 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {status === 'saving' ? 'Saving...' : 'Save Customer Map'}
        </button>
        {status === 'success' && <span className="text-sm text-green-600">Saved.</span>}
        {status === 'error' && <span className="text-sm text-red-600">Failed to save.</span>}
      </div>
    </div>
  );
}
