import React, { useState, useMemo } from 'react';
import { FruitIntakeRecord } from '../api/client';
import { getRemainingBalance } from '../utils/fruitIntakeUtils';

interface FruitRecordsTableProps {
  records: FruitIntakeRecord[];
  availableContractMonths: number[];
  onContractLengthChange: (recordId: string, months: number) => Promise<void>;
}

type SortField = 'vintage' | 'ownerCode' | 'lotCode' | 'varietal' | 'color' | 'fruitWeightTons' | 'totalCost' | 'effectiveDate' | 'remainingBalance';

export default function FruitRecordsTable({ records, availableContractMonths, onContractLengthChange }: FruitRecordsTableProps) {
  const [sortField, setSortField] = useState<SortField>('effectiveDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const recordsWithBalance = useMemo(() => {
    return records.map((r) => ({
      ...r,
      remainingBalance: getRemainingBalance(r),
    }));
  }, [records]);

  const sorted = useMemo(() => {
    return [...recordsWithBalance].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      const aStr = String(aVal || '');
      const bStr = String(bVal || '');
      return sortDir === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
  }, [recordsWithBalance, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const sortIndicator = (field: SortField) => {
    if (sortField !== field) return '';
    return sortDir === 'asc' ? ' ^' : ' v';
  };

  const handleContractChange = async (recordId: string, months: number) => {
    setUpdatingId(recordId);
    try {
      await onContractLengthChange(recordId, months);
    } finally {
      setUpdatingId(null);
    }
  };

  const exportCsv = () => {
    const headers = ['Vintage', 'Date', 'Weigh Tag', 'Owner', 'Code', 'Lot Code', 'Varietal', 'Color', 'Weight (tons)', 'Contract (mo)', 'Rate/ton', 'Total Cost', 'Monthly Amt', 'Remaining Balance'];
    const rows = sorted.map((r) => [
      r.vintage, r.effectiveDate, r.weighTagNumber, r.ownerName, r.ownerCode,
      r.lotCode, r.varietal, r.color, r.fruitWeightTons, r.contractLengthMonths,
      r.contractRatePerTon, r.totalCost, r.monthlyAmount, r.remainingBalance,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.map((v) => `"${v}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fruit-intake-records.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const getRowColor = (r: FruitIntakeRecord) => {
    if (r.ownerCode === 'UNMAPPED') return 'bg-red-50';
    if (r.contractLengthMonths === 0 || r.contractRatePerTon === 0) return 'bg-yellow-50';
    return 'bg-green-50';
  };

  return (
    <div>
      <div className="flex items-center justify-end mb-4">
        <button onClick={exportCsv} className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50">
          Export CSV
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {([
                ['vintage', 'Vintage'],
                ['effectiveDate', 'Date'],
                ['ownerCode', 'Code'],
                ['lotCode', 'Lot Code'],
                ['varietal', 'Varietal'],
                ['color', 'Color'],
                ['fruitWeightTons', 'Weight'],
                ['totalCost', 'Total'],
              ] as [SortField, string][]).map(([field, label]) => (
                <th
                  key={field}
                  onClick={() => handleSort(field)}
                  className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700"
                >
                  {label}{sortIndicator(field)}
                </th>
              ))}
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Contract</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Rate/ton</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Monthly</th>
              <th
                onClick={() => handleSort('remainingBalance')}
                className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700"
              >
                Remaining{sortIndicator('remainingBalance')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sorted.map((r) => (
              <tr key={r.id} className={`${getRowColor(r)} ${updatingId === r.id ? 'opacity-50' : ''}`}>
                <td className="px-3 py-1.5">{r.vintage}</td>
                <td className="px-3 py-1.5">{r.effectiveDate.split('T')[0]}</td>
                <td className="px-3 py-1.5 font-mono">{r.ownerCode}</td>
                <td className="px-3 py-1.5 font-mono">{r.lotCode}</td>
                <td className="px-3 py-1.5">{r.varietal}</td>
                <td className="px-3 py-1.5">{r.color}</td>
                <td className="px-3 py-1.5 text-right">{r.fruitWeightTons.toFixed(2)}</td>
                <td className="px-3 py-1.5 text-right">${r.totalCost.toFixed(2)}</td>
                <td className="px-3 py-1.5 text-center">
                  <select
                    value={r.contractLengthMonths}
                    onChange={(e) => handleContractChange(r.id, Number(e.target.value))}
                    disabled={updatingId !== null}
                    className="px-1 py-0.5 border border-gray-300 rounded text-sm bg-white"
                  >
                    {availableContractMonths.map((m) => (
                      <option key={m} value={m}>{m} mo</option>
                    ))}
                    {!availableContractMonths.includes(r.contractLengthMonths) && (
                      <option value={r.contractLengthMonths}>{r.contractLengthMonths} mo</option>
                    )}
                  </select>
                </td>
                <td className="px-3 py-1.5 text-right">${r.contractRatePerTon.toFixed(2)}</td>
                <td className="px-3 py-1.5 text-right">${r.monthlyAmount.toFixed(2)}</td>
                <td className={`px-3 py-1.5 text-right ${r.remainingBalance > 0 ? 'font-semibold' : 'text-gray-400'}`}>
                  ${r.remainingBalance.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
