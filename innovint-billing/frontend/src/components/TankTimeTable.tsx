import React from 'react';
import { ExtendedTankTimeRow, ExtendedTankTimeWarning } from '../api/client';

interface TankTimeTableProps {
  rows: ExtendedTankTimeRow[];
  warnings: ExtendedTankTimeWarning[];
}

export default function TankTimeTable({ rows, warnings }: TankTimeTableProps) {
  const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  const totalCharge = rows.reduce((sum, r) => sum + r.totalCharge, 0);

  return (
    <div className="space-y-4">
      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-sm font-medium text-amber-800 mb-2">
            Lots still in tank ({warnings.length})
          </p>
          <div className="space-y-1">
            {warnings.map((w, i) => (
              <p key={i} className="text-xs text-amber-700">
                <span className="font-mono font-medium">{w.lotCode}</span>
                {' '}({w.ownerCode}) &mdash; {w.message}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Billing rows */}
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-blue-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Owner</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Lot Code</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Color</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Start Action</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">End Action</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Start Date</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">End Date</th>
              <th className="px-3 py-2 text-right font-medium text-gray-600">Total Days</th>
              <th className="px-3 py-2 text-right font-medium text-gray-600">Included</th>
              <th className="px-3 py-2 text-right font-medium text-gray-600">Billable Days</th>
              <th className="px-3 py-2 text-right font-medium text-gray-600">Rate/Day</th>
              <th className="px-3 py-2 text-right font-medium text-gray-600">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-t hover:bg-blue-50/30">
                <td className="px-3 py-1.5 font-mono text-xs">{row.ownerCode}</td>
                <td className="px-3 py-1.5 font-mono text-xs">{row.lotCode}</td>
                <td className="px-3 py-1.5 capitalize">{row.color}</td>
                <td className="px-3 py-1.5 text-xs">{row.startActionType}</td>
                <td className="px-3 py-1.5 text-xs">{row.endActionType}</td>
                <td className="px-3 py-1.5 whitespace-nowrap">{row.startDate}</td>
                <td className="px-3 py-1.5 whitespace-nowrap">{row.endDate}</td>
                <td className="px-3 py-1.5 text-right">{row.totalDays}</td>
                <td className="px-3 py-1.5 text-right">{row.includedDays}</td>
                <td className="px-3 py-1.5 text-right font-medium">{row.billableDays}</td>
                <td className="px-3 py-1.5 text-right">{fmt(row.dailyRate)}</td>
                <td className="px-3 py-1.5 text-right font-medium">{fmt(row.totalCharge)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={12} className="px-3 py-8 text-center text-gray-400">
                  No extended tank time charges for this period.
                </td>
              </tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="bg-blue-50 font-bold border-t">
                <td colSpan={11} className="px-3 py-2 text-right">Total</td>
                <td className="px-3 py-2 text-right">{fmt(totalCharge)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
