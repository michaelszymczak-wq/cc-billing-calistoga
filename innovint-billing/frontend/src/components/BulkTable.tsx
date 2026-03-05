import React, { useMemo } from 'react';
import { BulkBillingRow } from '../api/client';

interface BulkTableProps {
  rows: BulkBillingRow[];
}

export default function BulkTable({ rows }: BulkTableProps) {
  // Compute subtotals per ownerCode
  const subtotals = useMemo(() => {
    const map = new Map<string, { tankCost: number; barrelCost: number; kegCost: number; totalCost: number }>();
    for (const row of rows) {
      const existing = map.get(row.ownerCode) || { tankCost: 0, barrelCost: 0, kegCost: 0, totalCost: 0 };
      existing.tankCost += row.tankCost;
      existing.barrelCost += row.barrelCost;
      existing.kegCost += row.kegCost;
      existing.totalCost += row.totalCost;
      map.set(row.ownerCode, existing);
    }
    return map;
  }, [rows]);

  // Group rows by ownerCode for subtotal insertion
  const groupedRows = useMemo(() => {
    const result: Array<{ type: 'row'; data: BulkBillingRow } | { type: 'subtotal'; ownerCode: string; totals: { tankCost: number; barrelCost: number; kegCost: number; totalCost: number } }> = [];
    let currentOwner = '';
    for (const row of rows) {
      if (currentOwner && row.ownerCode !== currentOwner) {
        const sub = subtotals.get(currentOwner);
        if (sub) {
          result.push({ type: 'subtotal', ownerCode: currentOwner, totals: sub });
        }
      }
      currentOwner = row.ownerCode;
      result.push({ type: 'row', data: row });
    }
    // Last group subtotal
    if (currentOwner) {
      const sub = subtotals.get(currentOwner);
      if (sub) {
        result.push({ type: 'subtotal', ownerCode: currentOwner, totals: sub });
      }
    }
    return result;
  }, [rows, subtotals]);

  return (
    <div className="overflow-x-auto border border-gray-200 rounded-lg">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-gray-600">Owner</th>
            <th className="px-3 py-2 text-left font-medium text-gray-600">Lot Code</th>
            <th className="px-3 py-2 text-right font-medium text-gray-600">Tank Vol</th>
            <th className="px-3 py-2 text-right font-medium text-gray-600">Barrels</th>
            <th className="px-3 py-2 text-right font-medium text-gray-600">Kegs</th>
            <th className="px-3 py-2 text-right font-medium text-gray-600">Tank %</th>
            <th className="px-3 py-2 text-right font-medium text-gray-600">Barrel %</th>
            <th className="px-3 py-2 text-right font-medium text-gray-600">Keg %</th>
            <th className="px-3 py-2 text-right font-medium text-gray-600">Tank Cost</th>
            <th className="px-3 py-2 text-right font-medium text-gray-600">Barrel Cost</th>
            <th className="px-3 py-2 text-right font-medium text-gray-600">Keg Cost</th>
            <th className="px-3 py-2 text-right font-medium text-gray-600">Total Cost</th>
          </tr>
        </thead>
        <tbody>
          {groupedRows.map((item, i) => {
            if (item.type === 'subtotal') {
              return (
                <tr key={`sub-${item.ownerCode}-${i}`} className="bg-blue-50 font-semibold border-t-2 border-blue-200">
                  <td className="px-3 py-1.5">{item.ownerCode}</td>
                  <td className="px-3 py-1.5 text-right" colSpan={7}>Subtotal</td>
                  <td className="px-3 py-1.5 text-right">${item.totals.tankCost.toFixed(2)}</td>
                  <td className="px-3 py-1.5 text-right">${item.totals.barrelCost.toFixed(2)}</td>
                  <td className="px-3 py-1.5 text-right">${item.totals.kegCost.toFixed(2)}</td>
                  <td className="px-3 py-1.5 text-right">${item.totals.totalCost.toFixed(2)}</td>
                </tr>
              );
            }
            const row = item.data;
            return (
              <tr key={`${row.lotCode}-${i}`} className="border-t hover:bg-gray-50">
                <td className="px-3 py-1.5 font-mono">{row.ownerCode}</td>
                <td className="px-3 py-1.5">{row.lotCode}</td>
                <td className="px-3 py-1.5 text-right">{row.tankVolume.toFixed(1)}</td>
                <td className="px-3 py-1.5 text-right">{row.barrelCount}</td>
                <td className="px-3 py-1.5 text-right">{row.kegCount}</td>
                <td className="px-3 py-1.5 text-right">{row.tankPct.toFixed(1)}%</td>
                <td className="px-3 py-1.5 text-right">{row.barrelPct.toFixed(1)}%</td>
                <td className="px-3 py-1.5 text-right">{row.kegPct.toFixed(1)}%</td>
                <td className="px-3 py-1.5 text-right">${row.tankCost.toFixed(2)}</td>
                <td className="px-3 py-1.5 text-right">${row.barrelCost.toFixed(2)}</td>
                <td className="px-3 py-1.5 text-right">${row.kegCost.toFixed(2)}</td>
                <td className="px-3 py-1.5 text-right font-semibold">${row.totalCost.toFixed(2)}</td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={12} className="px-3 py-8 text-center text-gray-400">
                No bulk inventory data.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
