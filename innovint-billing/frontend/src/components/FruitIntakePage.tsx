import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getFruitIntakeSaved, runFruitIntake, deleteFruitIntakeSaved,
  subscribeToBillingProgress, FruitIntakeRunResult, FruitIntakeRecord,
  updateFruitIntakeRecord, getSettings,
} from '../api/client';
import TabView from './TabView';
import FruitRecordsTable from './FruitRecordsTable';
import InstallmentSchedule from './InstallmentSchedule';
import CustomerMapEditor from './CustomerMapEditor';
import { getRemainingBalance } from '../utils/fruitIntakeUtils';

interface FruitIntakePageProps {
  customerMap: Record<string, string>;
  onCustomerMapChange: (map: Record<string, string>) => void;
}

export default function FruitIntakePage({ customerMap, onCustomerMapChange }: FruitIntakePageProps) {
  const [savedData, setSavedData] = useState<FruitIntakeRunResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<Array<{ step: string; message: string; pct: number }>>([]);
  const [showConfirmRerun, setShowConfirmRerun] = useState(false);
  const [filterOwner, setFilterOwner] = useState('');
  const [filterVintage, setFilterVintage] = useState('');
  const [filterColor, setFilterColor] = useState('');
  const [filterBalance, setFilterBalance] = useState<'' | 'has-balance' | 'completed'>('');
  const [availableContractMonths, setAvailableContractMonths] = useState<number[]>([]);

  const loadSaved = useCallback(() => {
    setLoading(true);
    getFruitIntakeSaved()
      .then((data) => {
        setSavedData(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { loadSaved(); }, [loadSaved]);

  useEffect(() => {
    getSettings().then((s) => {
      const months = [...new Set((s.fruitIntakeSettings?.rates || []).map((r) => r.contractMonths))].sort((a, b) => a - b);
      setAvailableContractMonths(months);
    }).catch(() => {});
  }, []);

  const handleRun = useCallback(async () => {
    setRunning(true);
    setProgress(0);
    setLogs([]);
    setShowConfirmRerun(false);

    try {
      const { sessionId } = await runFruitIntake(customerMap);

      const es = subscribeToBillingProgress(
        sessionId,
        (event) => {
          setLogs((prev) => [...prev, event]);
          if (event.pct >= 0) setProgress(event.pct);

          if (event.step === 'complete') {
            es.close();
            setTimeout(() => {
              loadSaved();
              setRunning(false);
            }, 500);
          }

          if (event.step === 'error') {
            es.close();
            setRunning(false);
          }
        },
        () => {
          setTimeout(() => {
            loadSaved();
            setRunning(false);
          }, 1000);
        }
      );
    } catch (err) {
      setLogs((prev) => [...prev, {
        step: 'error',
        message: err instanceof Error ? err.message : 'Unknown error',
        pct: -1,
      }]);
      setRunning(false);
    }
  }, [customerMap, loadSaved]);

  const handleContractLengthChange = useCallback(async (recordId: string, months: number) => {
    const result = await updateFruitIntakeRecord(recordId, { contractLengthMonths: months });
    setSavedData(result);
  }, []);

  const handleDelete = async () => {
    await deleteFruitIntakeSaved();
    setSavedData(null);
  };

  // Collect unmapped owners from saved data
  const unmappedOwners = savedData
    ? [...new Set(savedData.records.filter((r) => r.ownerCode === 'UNMAPPED').map((r) => r.ownerName))]
    : [];

  const allRecords = savedData?.records || [];
  const ownerCodes = useMemo(() => [...new Set(allRecords.map((r) => r.ownerCode))].sort(), [allRecords]);
  const vintages = useMemo(() => [...new Set(allRecords.map((r) => r.vintage))].sort((a, b) => b - a), [allRecords]);
  const colors = useMemo(() => [...new Set(allRecords.map((r) => r.color).filter(Boolean))].sort(), [allRecords]);

  const filtered = useMemo(() => {
    let result = allRecords;
    if (filterOwner) result = result.filter((r) => r.ownerCode === filterOwner);
    if (filterVintage) result = result.filter((r) => String(r.vintage) === filterVintage);
    if (filterColor) result = result.filter((r) => r.color.toLowerCase() === filterColor.toLowerCase());
    if (filterBalance === 'has-balance') result = result.filter((r) => getRemainingBalance(r) > 0);
    if (filterBalance === 'completed') result = result.filter((r) => getRemainingBalance(r) === 0);
    return result;
  }, [allRecords, filterOwner, filterVintage, filterColor, filterBalance]);

  const hasFilters = !!(filterOwner || filterVintage || filterColor || filterBalance);
  const filteredTotalCost = useMemo(() => filtered.reduce((s, r) => s + r.totalCost, 0), [filtered]);
  const filteredMonthlyCost = useMemo(() => filtered.reduce((s, r) => s + r.monthlyAmount, 0), [filtered]);
  const filteredRemainingBalance = useMemo(() => filtered.reduce((s, r) => s + getRemainingBalance(r), 0), [filtered]);

  if (loading) {
    return <div className="text-gray-400 text-sm">Loading fruit intake data...</div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Fruit Intake</h2>

      {/* Running state */}
      {running && (
        <div className="space-y-4">
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-blue-600 h-3 rounded-full transition-all duration-300"
              style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
            />
          </div>
          <p className="text-sm text-gray-500">{progress}% complete</p>
          <div className="bg-gray-900 text-green-400 p-4 rounded-md h-48 overflow-y-auto font-mono text-xs">
            {logs.map((log, i) => (
              <div key={i} className={log.pct === -1 ? 'text-yellow-400' : ''}>
                [{log.step}] {log.message}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No data state */}
      {!savedData && !running && (
        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 text-blue-700 p-4 rounded-md text-sm">
            No fruit intake data saved. Set up your customer mapping below, then run the fruit intake fetch.
          </div>
          <CustomerMapEditor
            customerMap={customerMap}
            onSaved={onCustomerMapChange}
            unmappedOwners={[]}
          />
          <button
            onClick={handleRun}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 transition-colors"
          >
            Run Fruit Intake Fetch
          </button>
          {logs.length > 0 && (
            <div className="bg-gray-900 text-green-400 p-4 rounded-md h-32 overflow-y-auto font-mono text-xs">
              {logs.map((log, i) => (
                <div key={i} className={log.pct === -1 ? 'text-yellow-400' : ''}>
                  [{log.step}] {log.message}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Data loaded state */}
      {savedData && !running && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="flex items-center gap-4">
            <select value={filterOwner} onChange={(e) => setFilterOwner(e.target.value)} className="px-2 py-1 border border-gray-300 rounded text-sm">
              <option value="">All Customers</option>
              {ownerCodes.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            <select value={filterVintage} onChange={(e) => setFilterVintage(e.target.value)} className="px-2 py-1 border border-gray-300 rounded text-sm">
              <option value="">All Vintages</option>
              {vintages.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
            <select value={filterColor} onChange={(e) => setFilterColor(e.target.value)} className="px-2 py-1 border border-gray-300 rounded text-sm">
              <option value="">All Colors</option>
              {colors.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={filterBalance} onChange={(e) => setFilterBalance(e.target.value as '' | 'has-balance' | 'completed')} className="px-2 py-1 border border-gray-300 rounded text-sm">
              <option value="">All Balances</option>
              <option value="has-balance">Has Remaining Balance</option>
              <option value="completed">Completed</option>
            </select>
            <span className="text-sm text-gray-500">
              {filtered.length} of {allRecords.length} records
              {hasFilters && (
                <button
                  onClick={() => { setFilterOwner(''); setFilterVintage(''); setFilterColor(''); setFilterBalance(''); }}
                  className="ml-2 text-blue-600 hover:text-blue-800 underline"
                >
                  Clear
                </button>
              )}
            </span>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-6 gap-4">
            <SummaryCard label="Records" value={filtered.length} />
            <SummaryCard label="New Records" value={savedData.newRecords} color="green" />
            <SummaryCard label="Duplicates Skipped" value={savedData.duplicatesSkipped} />
            <SummaryCard
              label="Total Cost"
              value={`$${filteredTotalCost.toFixed(2)}`}
            />
            <SummaryCard
              label="Monthly Cost"
              value={`$${filteredMonthlyCost.toFixed(2)}`}
              color="green"
            />
            <SummaryCard
              label="Remaining Balance"
              value={`$${filteredRemainingBalance.toFixed(2)}`}
              color="amber"
            />
          </div>

          <div className="flex items-center gap-3">
            <p className="text-xs text-gray-400">
              Last run: {new Date(savedData.ranAt).toLocaleString()} | Vintages: {savedData.vintagesQueried.join(', ')}
            </p>
            <button
              onClick={() => setShowConfirmRerun(true)}
              className="px-4 py-1.5 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 transition-colors"
            >
              Re-run
            </button>
            <button
              onClick={handleDelete}
              className="px-4 py-1.5 border border-red-300 text-red-600 rounded-md text-sm hover:bg-red-50 transition-colors"
            >
              Clear Data
            </button>
          </div>

          {/* Confirm re-run modal */}
          {showConfirmRerun && (
            <div className="bg-amber-50 border border-amber-200 text-amber-700 p-4 rounded-md text-sm">
              <p className="mb-2">
                Re-running will merge new records with the existing {savedData.totalRecords} records. Existing records are preserved.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleRun}
                  className="px-3 py-1.5 bg-amber-600 text-white rounded-md text-sm hover:bg-amber-700"
                >
                  Confirm Re-run
                </button>
                <button
                  onClick={() => setShowConfirmRerun(false)}
                  className="px-3 py-1.5 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Tabs */}
          <TabView
            tabs={[
              {
                id: 'records',
                label: 'Records',
                badge: filtered.length,
                content: <FruitRecordsTable records={filtered} availableContractMonths={availableContractMonths} onContractLengthChange={handleContractLengthChange} />,
              },
              {
                id: 'schedule',
                label: 'Installment Schedule',
                content: <InstallmentSchedule records={filtered} />,
              },
              {
                id: 'customers',
                label: 'Customers',
                badge: unmappedOwners.length > 0 ? unmappedOwners.length : undefined,
                content: (
                  <CustomerMapEditor
                    customerMap={customerMap}
                    onSaved={onCustomerMapChange}
                    unmappedOwners={unmappedOwners}
                  />
                ),
              },
            ]}
          />
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, color = 'blue' }: { label: string; value: string | number; color?: string }) {
  const bgMap: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200',
    green: 'bg-green-50 border-green-200',
    amber: 'bg-amber-50 border-amber-200',
  };
  return (
    <div className={`p-4 rounded-lg border ${bgMap[color] || bgMap.blue}`}>
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}
