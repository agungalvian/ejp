import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, TrendingUp, TrendingDown, Loader2, Filter } from 'lucide-react';
import api from '../../api/axios';

const formatIDR = (val: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(Math.abs(val));

const thisYear = new Date().getFullYear();

export default function GeneralLedger() {
  const [tab, setTab] = useState<'gl' | 'pl' | 'bs'>('pl');
  const [fromDate, setFromDate] = useState(`${thisYear}-01-01`);
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedAccount, setSelectedAccount] = useState('');

  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.get('/ledger/accounts').then((r) => r.data.data),
  });

  const { data: plData, isLoading: plLoading } = useQuery({
    queryKey: ['profit-loss', fromDate, toDate],
    queryFn: () => api.get('/ledger/profit-loss', { params: { from_date: fromDate, to_date: toDate } }).then((r) => r.data.data),
    enabled: tab === 'pl',
  });

  const { data: bsData, isLoading: bsLoading } = useQuery({
    queryKey: ['balance-sheet', toDate],
    queryFn: () => api.get('/ledger/balance-sheet', { params: { as_of_date: toDate } }).then((r) => r.data.data),
    enabled: tab === 'bs',
  });

  const { data: glData, isLoading: glLoading } = useQuery({
    queryKey: ['general-ledger', selectedAccount, fromDate, toDate],
    queryFn: () =>
      api.get('/ledger/general-ledger', {
        params: { account_id: selectedAccount || undefined, from_date: fromDate, to_date: toDate },
      }).then((r) => r.data.data),
    enabled: tab === 'gl',
  });

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h2 className="page-title">Financial Reports</h2>
          <p className="page-subtitle">General Ledger · Profit & Loss · Balance Sheet</p>
        </div>
      </div>

      {/* Tab selector */}
      <div className="flex gap-1 bg-surface-200 p-1 rounded-lg w-fit">
        {[
          { key: 'pl', label: 'Profit & Loss' },
          { key: 'bs', label: 'Balance Sheet' },
          { key: 'gl', label: 'General Ledger' },
        ].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${tab === t.key ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-white'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Date filters */}
      <div className="flex flex-wrap gap-3 items-end">
        {tab !== 'bs' && (
          <div className="form-group">
            <label className="label">From Date</label>
            <input className="input w-40" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
        )}
        <div className="form-group">
          <label className="label">{tab === 'bs' ? 'As of Date' : 'To Date'}</label>
          <input className="input w-40" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </div>
        {tab === 'gl' && (
          <div className="form-group">
            <label className="label">Account</label>
            <select className="select w-56" value={selectedAccount} onChange={(e) => setSelectedAccount(e.target.value)}>
              <option value="">All Accounts</option>
              {accounts?.filter((a: any) => !a.children?.length).map((a: any) => (
                <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ── Profit & Loss ─────────────────────────────────────────── */}
      {tab === 'pl' && (
        plLoading ? <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-brand-400" /></div> :
        <div className="space-y-4 animate-in">
          {/* Summary banner */}
          <div className={`card p-5 border-2 ${(plData?.net_income ?? 0) >= 0 ? 'border-green-500/40 bg-green-500/5' : 'border-red-500/40 bg-red-500/5'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Net Income / (Loss)</p>
                <p className={`text-3xl font-bold font-mono mt-1 ${(plData?.net_income ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {(plData?.net_income ?? 0) < 0 ? '(' : ''}{formatIDR(plData?.net_income ?? 0)}{(plData?.net_income ?? 0) < 0 ? ')' : ''}
                </p>
              </div>
              {(plData?.net_income ?? 0) >= 0 ? <TrendingUp size={40} className="text-green-400/30" /> : <TrendingDown size={40} className="text-red-400/30" />}
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-surface-300">
              <div>
                <p className="text-xs text-slate-400">Total Revenue</p>
                <p className="text-lg font-mono font-semibold text-green-400">{formatIDR(plData?.total_revenue ?? 0)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Total Expense</p>
                <p className="text-lg font-mono font-semibold text-red-400">{formatIDR(plData?.total_expense ?? 0)}</p>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Revenue */}
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-green-400 mb-3 flex items-center gap-2">
                <TrendingUp size={14} /> Revenue
              </h3>
              <div className="table-container">
                <table className="table">
                  <thead><tr><th>Account</th><th className="text-right">Amount</th></tr></thead>
                  <tbody>
                    {plData?.revenues?.map((r: any) => (
                      <tr key={r.code}>
                        <td><p className="text-white text-xs">{r.name}</p><p className="text-slate-500 text-xs font-mono">{r.code}</p></td>
                        <td className="currency text-green-400 font-semibold">{formatIDR(r.total)}</td>
                      </tr>
                    ))}
                    <tr className="bg-surface-200">
                      <td className="font-semibold text-white">Total Revenue</td>
                      <td className="currency font-bold text-green-400">{formatIDR(plData?.total_revenue ?? 0)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Expenses */}
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-red-400 mb-3 flex items-center gap-2">
                <TrendingDown size={14} /> Expenses
              </h3>
              <div className="table-container">
                <table className="table">
                  <thead><tr><th>Account</th><th className="text-right">Amount</th></tr></thead>
                  <tbody>
                    {plData?.expenses?.map((e: any) => (
                      <tr key={e.code}>
                        <td><p className="text-white text-xs">{e.name}</p><p className="text-slate-500 text-xs font-mono">{e.code}</p></td>
                        <td className="currency text-red-400 font-semibold">{formatIDR(e.total)}</td>
                      </tr>
                    ))}
                    <tr className="bg-surface-200">
                      <td className="font-semibold text-white">Total Expense</td>
                      <td className="currency font-bold text-red-400">{formatIDR(plData?.total_expense ?? 0)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Balance Sheet ─────────────────────────────────────────── */}
      {tab === 'bs' && (
        bsLoading ? <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-brand-400" /></div> :
        <div className="grid md:grid-cols-2 gap-4 animate-in">
          <div className="space-y-4">
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-blue-400 mb-3">Assets</h3>
              <div className="space-y-2">
                {bsData?.assets?.map((a: any) => (
                  <div key={a.code} className="flex justify-between text-sm">
                    <div>
                      <p className="text-white">{a.name}</p>
                      <p className="text-xs text-slate-500 font-mono">{a.code}</p>
                    </div>
                    <p className="font-mono font-semibold text-white">{formatIDR(a.balance)}</p>
                  </div>
                ))}
                <div className="pt-2 border-t border-surface-300 flex justify-between">
                  <p className="font-semibold text-white">Total Assets</p>
                  <p className="font-bold text-blue-400 font-mono">{formatIDR(bsData?.total_assets ?? 0)}</p>
                </div>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-amber-400 mb-3">Liabilities</h3>
              <div className="space-y-2">
                {bsData?.liabilities?.map((l: any) => (
                  <div key={l.code} className="flex justify-between text-sm">
                    <div>
                      <p className="text-white">{l.name}</p>
                      <p className="text-xs text-slate-500 font-mono">{l.code}</p>
                    </div>
                    <p className="font-mono font-semibold text-amber-400">{formatIDR(l.balance)}</p>
                  </div>
                ))}
                <div className="pt-2 border-t border-surface-300 flex justify-between">
                  <p className="font-semibold text-white">Total Liabilities</p>
                  <p className="font-bold text-amber-400 font-mono">{formatIDR(bsData?.total_liabilities ?? 0)}</p>
                </div>
              </div>
            </div>
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-purple-400 mb-3">Equity</h3>
              <div className="space-y-2">
                {bsData?.equity?.map((e: any) => (
                  <div key={e.code} className="flex justify-between text-sm">
                    <div><p className="text-white">{e.name}</p></div>
                    <p className="font-mono font-semibold text-purple-400">{formatIDR(e.balance)}</p>
                  </div>
                ))}
                <div className="pt-2 border-t border-surface-300 flex justify-between">
                  <p className="font-semibold text-white">Total Equity</p>
                  <p className="font-bold text-purple-400 font-mono">{formatIDR(bsData?.total_equity ?? 0)}</p>
                </div>
              </div>
            </div>
            <div className="card p-4 border-brand-600/30">
              <div className="flex justify-between items-center">
                <p className="text-sm font-semibold text-white">Liabilities + Equity</p>
                <p className="font-bold text-brand-400 font-mono">{formatIDR((bsData?.total_liabilities ?? 0) + (bsData?.total_equity ?? 0))}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── General Ledger ─────────────────────────────────────────── */}
      {tab === 'gl' && (
        glLoading ? <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-brand-400" /></div> :
        <div className="animate-in">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Account</th>
                  <th className="text-right">Debit</th>
                  <th className="text-right">Credit</th>
                  <th className="text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {glData?.map((entry: any) => (
                  <tr key={entry.id}>
                    <td className="text-xs text-slate-400 whitespace-nowrap">
                      {new Date(entry.transaction?.date).toLocaleDateString('id-ID')}
                    </td>
                    <td className="text-white max-w-xs truncate">{entry.transaction?.description}</td>
                    <td>
                      <p className="text-xs text-white">{entry.account?.name}</p>
                      <p className="text-xs text-slate-500 font-mono">{entry.account?.code}</p>
                    </td>
                    <td className="currency font-mono text-green-400">{Number(entry.debit) > 0 ? formatIDR(Number(entry.debit)) : '—'}</td>
                    <td className="currency font-mono text-red-400">{Number(entry.credit) > 0 ? formatIDR(Number(entry.credit)) : '—'}</td>
                    <td className={`currency font-bold font-mono ${entry.running_balance >= 0 ? 'text-white' : 'text-red-400'}`}>
                      {entry.running_balance < 0 ? '(' : ''}{formatIDR(entry.running_balance)}{entry.running_balance < 0 ? ')' : ''}
                    </td>
                  </tr>
                ))}
                {!glData?.length && (
                  <tr><td colSpan={6} className="text-center py-8 text-slate-500">No ledger entries for this period</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
