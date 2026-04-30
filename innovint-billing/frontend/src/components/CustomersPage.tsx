import React, { useState } from 'react';
import { CustomerRecord, saveCustomers } from '../api/client';

interface CustomersPageProps {
  customers: CustomerRecord[];
  onCustomersChange: (customers: CustomerRecord[]) => void;
  unmappedOwners?: string[];
}

function emptyRecord(): CustomerRecord {
  return { ownerName: '', code: '', displayName: '', qbName: '', address: '', phone: '', email: '', isActive: true };
}

function escapeCSV(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let i = 0;
  while (i <= line.length) {
    if (line[i] === '"') {
      // Quoted field
      let field = '';
      i++; // skip opening quote
      while (i < line.length) {
        if (line[i] === '"' && line[i + 1] === '"') {
          field += '"';
          i += 2;
        } else if (line[i] === '"') {
          i++; // skip closing quote
          break;
        } else {
          field += line[i++];
        }
      }
      fields.push(field);
      if (line[i] === ',') i++; // skip comma after field
    } else {
      // Unquoted field
      const end = line.indexOf(',', i);
      if (end === -1) {
        fields.push(line.slice(i).trim());
        break;
      }
      fields.push(line.slice(i, end).trim());
      i = end + 1;
    }
  }
  return fields;
}

export default function CustomersPage({ customers, onCustomersChange, unmappedOwners = [] }: CustomersPageProps) {
  const [rows, setRows] = useState<CustomerRecord[]>(() => {
    const list = [...customers];
    for (const owner of unmappedOwners) {
      if (!list.some(c => c.ownerName === owner)) {
        list.push({ ...emptyRecord(), ownerName: owner });
      }
    }
    return list.length > 0 ? list : [emptyRecord()];
  });
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [dirty, setDirty] = useState(false);

  const updateRow = (idx: number, field: keyof CustomerRecord, value: string | boolean) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
    setDirty(true);
  };

  const addRow = () => {
    setRows(prev => [...prev, emptyRecord()]);
    setDirty(true);
  };

  const removeRow = (idx: number) => {
    setRows(prev => prev.filter((_, i) => i !== idx));
    setDirty(true);
  };

  const handleSave = async () => {
    setStatus('saving');
    const toSave = rows.filter(r => r.ownerName.trim() || r.code.trim() || r.qbName?.trim());
    try {
      await saveCustomers(toSave);
      setStatus('success');
      setDirty(false);
      onCustomersChange(toSave);
      setTimeout(() => setStatus('idle'), 2000);
    } catch {
      setStatus('error');
    }
  };

  const handleDownloadCSV = () => {
    const header = 'Owner Name,QB Name,Code,Address,Phone,Email';
    const csvRows = rows
      .filter(r => r.ownerName.trim() || r.code.trim() || r.qbName?.trim())
      .map(r => [r.ownerName, r.qbName || '', r.code, r.address, r.phone, r.email].map(escapeCSV).join(','));
    const csv = [header, ...csvRows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'customers.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (!text) return;
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      // Skip header row if present
      const dataLines = lines[0]?.toLowerCase().startsWith('owner') ? lines.slice(1) : lines;
      const imported: CustomerRecord[] = [];
      for (const line of dataLines) {
        const parts = parseCSVLine(line);
        if (parts.length >= 2) {
          imported.push({
            ownerName: parts[0] || '',
            qbName: parts[1] || '',
            code: parts[2] || '',
            displayName: '',
            address: parts[3] || '',
            phone: parts[4] || '',
            email: parts[5] || '',
            isActive: true,
          });
        }
      }
      if (imported.length === 0) return;
      setRows(imported);
      setDirty(true);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const unmappedSet = new Set(unmappedOwners);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-1">Customers</h2>
      <p className="text-sm text-gray-500 mb-6">Manage customer mappings and contact info for invoices and QB exports</p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="text-center px-2 py-2 font-medium text-gray-600 whitespace-nowrap w-16">Active?</th>
              <th className="text-left px-2 py-2 font-medium text-gray-600 whitespace-nowrap">Owner Name</th>
              <th className="text-left px-2 py-2 font-medium text-gray-600 whitespace-nowrap">QB Name</th>
              <th className="text-left px-2 py-2 font-medium text-gray-600 whitespace-nowrap">Code</th>
              <th className="text-left px-2 py-2 font-medium text-gray-600 whitespace-nowrap">Address</th>
              <th className="text-left px-2 py-2 font-medium text-gray-600 whitespace-nowrap">Phone</th>
              <th className="text-left px-2 py-2 font-medium text-gray-600 whitespace-nowrap">Email</th>
              <th className="px-2 py-2 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const isUnmapped = unmappedSet.has(row.ownerName) && !row.code.trim();
              return (
                <tr key={idx} className={`border-b ${isUnmapped ? 'bg-amber-50' : 'hover:bg-gray-50'}`}>
                  <td className="px-1 py-1 text-center">
                    <input
                      type="checkbox"
                      checked={row.isActive !== false}
                      onChange={e => updateRow(idx, 'isActive', e.target.checked)}
                      className="h-4 w-4 accent-violet-600"
                    />
                  </td>
                  <td className="px-1 py-1">
                    <input
                      type="text"
                      value={row.ownerName}
                      onChange={e => updateRow(idx, 'ownerName', e.target.value)}
                      placeholder="InnoVint owner"
                      className={`w-full px-2 py-1 border rounded text-sm ${isUnmapped ? 'border-amber-400' : 'border-gray-300'}`}
                    />
                  </td>
                  <td className="px-1 py-1">
                    <input
                      type="text"
                      value={row.qbName || ''}
                      onChange={e => updateRow(idx, 'qbName', e.target.value)}
                      placeholder="QuickBooks customer name"
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                  </td>
                  <td className="px-1 py-1">
                    <input
                      type="text"
                      value={row.code}
                      onChange={e => updateRow(idx, 'code', e.target.value.toUpperCase())}
                      placeholder="ABC"
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm font-mono"
                    />
                  </td>
                  <td className="px-1 py-1">
                    <input
                      type="text"
                      value={row.address}
                      onChange={e => updateRow(idx, 'address', e.target.value)}
                      placeholder="Address"
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                  </td>
                  <td className="px-1 py-1">
                    <input
                      type="text"
                      value={row.phone}
                      onChange={e => updateRow(idx, 'phone', e.target.value)}
                      placeholder="Phone"
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                  </td>
                  <td className="px-1 py-1">
                    <input
                      type="text"
                      value={row.email}
                      onChange={e => updateRow(idx, 'email', e.target.value)}
                      placeholder="Email"
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                  </td>
                  <td className="px-1 py-1 text-center">
                    <button
                      onClick={() => removeRow(idx)}
                      className="text-red-400 hover:text-red-600 text-sm px-1"
                      title="Remove"
                    >
                      &times;
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3 mt-4">
        <button
          onClick={addRow}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
        >
          + Add Row
        </button>
        <label className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer">
          Import CSV
          <input type="file" accept=".csv,.txt" onChange={handleImportCSV} className="hidden" />
        </label>
        <button
          onClick={handleDownloadCSV}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Download CSV
        </button>
        <button
          onClick={handleSave}
          disabled={status === 'saving'}
          className="px-4 py-1.5 bg-violet-600 text-white rounded-md text-sm hover:bg-violet-700 disabled:opacity-50"
        >
          {status === 'saving' ? 'Saving...' : dirty ? 'Save Customers' : 'Saved'}
        </button>
        {status === 'success' && <span className="text-sm text-green-600">Saved.</span>}
        {status === 'error' && <span className="text-sm text-red-600">Failed to save.</span>}
      </div>

      <p className="text-xs text-gray-400 mt-2">CSV format: Owner Name, QB Name, Code, Address, Phone, Email</p>
    </div>
  );
}
