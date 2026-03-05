import React from 'react';
import { AuditRow } from '../api/client';

interface AuditTableProps {
  rows: AuditRow[];
}

export default function AuditTable({ rows }: AuditTableProps) {
  return (
    <div className="overflow-x-auto border border-gray-200 rounded-lg">
      <table className="min-w-full text-sm">
        <thead className="bg-red-50">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-gray-600">Action Type</th>
            <th className="px-3 py-2 text-left font-medium text-gray-600">Action ID</th>
            <th className="px-3 py-2 text-left font-medium text-gray-600">Lot Codes</th>
            <th className="px-3 py-2 text-left font-medium text-gray-600">Performer</th>
            <th className="px-3 py-2 text-left font-medium text-gray-600">Date</th>
            <th className="px-3 py-2 text-left font-medium text-gray-600">Owner</th>
            <th className="px-3 py-2 text-left font-medium text-gray-600">Analysis/Notes</th>
            <th className="px-3 py-2 text-left font-medium text-gray-600">Reason</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={`${row.actionId}-${i}`} className="border-t hover:bg-red-25">
              <td className="px-3 py-1.5">{row.actionType}</td>
              <td className="px-3 py-1.5 font-mono text-xs">{row.actionId.slice(0, 8)}</td>
              <td className="px-3 py-1.5 max-w-xs truncate" title={row.lotCodes}>{row.lotCodes}</td>
              <td className="px-3 py-1.5">{row.performer}</td>
              <td className="px-3 py-1.5">{row.date}</td>
              <td className="px-3 py-1.5 font-mono">{row.ownerCode}</td>
              <td className="px-3 py-1.5 max-w-xs truncate" title={row.analysisOrNotes}>{row.analysisOrNotes}</td>
              <td className="px-3 py-1.5 text-red-600 font-medium">{row.reason}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={8} className="px-3 py-8 text-center text-gray-400">
                No unmatched actions.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
