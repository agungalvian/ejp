import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DollarSign, Play, Check, ChevronDown, ChevronUp, Loader2, Plus, Settings, Edit2, Trash2, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';

const formatIDR = (val: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);

const statusColors: Record<string, string> = {
  Draft: 'badge-slate', Processed: 'badge-amber', Paid: 'badge-green',
};

const monthsIndo = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export default function PayrollPage() {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showParamModal, setShowParamModal] = useState(false);

  // New period modal states
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<any | null>(null);
  const [periodMonth, setPeriodMonth] = useState<number>(new Date().getMonth() + 1);
  const [periodYear, setPeriodYear] = useState<number>(new Date().getFullYear());
  const [periodNotes, setPeriodNotes] = useState<string>('');

  const { data: periods, isLoading } = useQuery({
    queryKey: ['payroll-periods'],
    queryFn: () => api.get('/payroll/periods').then((r) => r.data.data),
  });

  const { data: employees } = useQuery({
    queryKey: ['active-employees'],
    queryFn: () => api.get('/payroll/employees').then((r) => r.data.data),
  });

  const { data: params } = useQuery({
    queryKey: ['payroll-params'],
    queryFn: () => api.get('/payroll/parameters').then((r) => r.data.data),
    enabled: showParamModal,
  });

  const { data: details } = useQuery({
    queryKey: ['payroll-details', expanded],
    queryFn: () => api.get(`/payroll/periods/${expanded}/details`).then((r) => r.data.data),
    enabled: !!expanded,
  });

  const createPeriodMutation = useMutation({
    mutationFn: ({ period_month, period_year, notes }: { period_month: number; period_year: number; notes?: string }) => {
      return api.post('/payroll/periods', { period_month, period_year, notes });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payroll-periods'] });
      toast.success('Periode payroll berhasil dibuat!');
      setShowPeriodModal(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Gagal membuat periode'),
  });

  const updatePeriodMutation = useMutation({
    mutationFn: ({ id, period_month, period_year, notes }: { id: string; period_month: number; period_year: number; notes?: string }) =>
      api.put(`/payroll/periods/${id}`, { period_month, period_year, notes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payroll-periods'] });
      toast.success('Periode payroll berhasil diubah!');
      setShowPeriodModal(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Gagal mengubah periode'),
  });

  const deletePeriodMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/payroll/periods/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payroll-periods'] });
      toast.success('Periode payroll berhasil dihapus!');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Gagal menghapus periode'),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => api.post(`/payroll/periods/${id}/reject`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payroll-periods'] });
      toast.success('Pemrosesan payroll berhasil dibatalkan ke Draft!');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Gagal membatalkan pemrosesan payroll'),
  });

  const processMutation = useMutation({
    mutationFn: (id: string) => api.post(`/payroll/periods/${id}/process`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payroll-periods'] }); toast.success('Payroll processed! Journal entries created.'); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed'),
  });

  const paidMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/payroll/periods/${id}/paid`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payroll-periods'] }); toast.success('Payroll marked as Paid!'); },
  });

  const toggleParamMutation = useMutation({
    mutationFn: ({ id, is_enabled }: { id: string; is_enabled: boolean }) =>
      api.put(`/payroll/parameters/${id}`, { is_enabled }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payroll-params'] }); toast.success('Parameter updated!'); },
  });

  const monthName = (m: number) => monthsIndo[m - 1] || '';

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h2 className="page-title">Payroll Management</h2>
          <p className="page-subtitle">Parameterized salary & allowance processing</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => setShowParamModal(true)}>
            <Settings size={14} /> Parameters
          </button>
          <button className="btn-primary" onClick={() => {
            setEditingPeriod(null);
            setPeriodMonth(new Date().getMonth() + 1);
            setPeriodYear(new Date().getFullYear());
            setPeriodNotes('');
            setShowPeriodModal(true);
          }}>
            <Plus size={14} /> Tambah Periode
          </button>
        </div>
      </div>

      {/* Periods list */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-brand-400" /></div>
      ) : (
        <div className="space-y-3">
          {periods?.map((p: any) => (
            <div key={p.id} className="card overflow-hidden">
              <div className="p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-brand-600/10 border border-brand-600/20 flex flex-col items-center justify-center flex-shrink-0">
                  <p className="text-xs font-bold text-brand-400">{String(p.period_month).padStart(2, '0')}</p>
                  <p className="text-xs text-slate-500">{p.period_year}</p>
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-white">{monthName(p.period_month)} {p.period_year}</p>
                  {p.notes && <p className="text-xs text-slate-400 italic mt-0.5">{p.notes}</p>}
                  <p className="text-xs text-slate-500 mt-1">
                    {p.status === 'Draft'
                      ? `${employees?.length ?? 0} karyawan aktif`
                      : `${p._count?.payroll_details ?? 0} karyawan diproses`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={statusColors[p.status] ?? 'badge-slate'}>{p.status}</span>
                  
                  {p.status === 'Draft' && (
                    <>
                      <button onClick={() => {
                        setEditingPeriod(p);
                        setPeriodMonth(p.period_month);
                        setPeriodYear(p.period_year);
                        setPeriodNotes(p.notes || '');
                        setShowPeriodModal(true);
                      }} className="btn-secondary text-xs px-2 py-1 flex items-center gap-1">
                        <Edit2 size={12} /> Edit
                      </button>
                      <button onClick={() => {
                        if (confirm(`Apakah Anda yakin ingin menghapus periode ${monthName(p.period_month)} ${p.period_year}?`)) {
                          deletePeriodMutation.mutate(p.id);
                        }
                      }} disabled={deletePeriodMutation.isPending} className="btn-danger text-xs px-2 py-1 flex items-center gap-1">
                        <Trash2 size={12} /> Hapus
                      </button>
                      <button onClick={() => processMutation.mutate(p.id)} disabled={processMutation.isPending}
                        className="btn-primary text-xs px-2 py-1 flex items-center gap-1">
                        {processMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />} Proses
                      </button>
                    </>
                  )}
                  
                  {p.status === 'Processed' && (
                    <>
                      <button onClick={() => {
                        if (confirm(`PERINGATAN: Membatalkan pemrosesan payroll untuk ${monthName(p.period_month)} ${p.period_year} akan menghapus rincian gaji terhitung dan entri jurnal akuntansi di Buku Besar secara permanen.\n\nApakah Anda yakin ingin melanjutkan?`)) {
                          rejectMutation.mutate(p.id);
                        }
                      }} disabled={rejectMutation.isPending} className="btn-danger text-xs px-2 py-1 flex items-center gap-1">
                        {rejectMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />} Batal Proses
                      </button>
                      <button onClick={() => paidMutation.mutate(p.id)} className="btn-success text-xs px-2 py-1 flex items-center gap-1">
                        <Check size={12} /> Mark Paid
                      </button>
                    </>
                  )}
                  
                  <button onClick={() => setExpanded(expanded === p.id ? null : p.id)} className="btn-icon">
                    {expanded === p.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>
              </div>

              {/* Expanded Details */}
              {expanded === p.id && (
                <div className="border-t border-surface-300 p-4 animate-fade-in">
                  <div className="table-container">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Employee</th>
                          <th>Type</th>
                          <th className="text-right">Days</th>
                          <th className="text-right">Basic Salary</th>
                          <th className="text-right">Allowances</th>
                          <th className="text-right">Deductions</th>
                          <th className="text-right">Net Salary</th>
                        </tr>
                      </thead>
                      <tbody>
                        {details?.map((d: any) => (
                          <tr key={d.id}>
                            <td className="text-white font-medium">{d.employee?.name}</td>
                            <td><span className="badge badge-slate text-xs">{d.employee?.type.replace('_', ' ')}</span></td>
                            <td className="currency">{d.working_days}</td>
                            <td className="currency">{formatIDR(Number(d.basic_salary))}</td>
                            <td className="currency text-green-400">{formatIDR(Number(d.meal_allowance) + Number(d.transport_allowance))}</td>
                            <td className="currency text-red-400">({formatIDR(Number(d.total_deductions))})</td>
                            <td className="currency font-bold text-white">{formatIDR(Number(d.net_salary))}</td>
                          </tr>
                        ))}
                        {details && (
                          <tr className="bg-surface-200">
                            <td colSpan={3} className="text-white font-semibold">TOTAL</td>
                            <td className="currency font-semibold">{formatIDR(details.reduce((s: number, d: any) => s + Number(d.basic_salary), 0))}</td>
                            <td className="currency font-semibold text-green-400">{formatIDR(details.reduce((s: number, d: any) => s + Number(d.meal_allowance) + Number(d.transport_allowance), 0))}</td>
                            <td className="currency font-semibold text-red-400">({formatIDR(details.reduce((s: number, d: any) => s + Number(d.total_deductions), 0))})</td>
                            <td className="currency font-bold text-brand-400 text-base">{formatIDR(details.reduce((s: number, d: any) => s + Number(d.net_salary), 0))}</td>
                          </tr>
                        )}
                        {!details?.length && (
                          <tr><td colSpan={7} className="text-center py-4 text-slate-500">Not yet processed</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ))}
          {!periods?.length && (
            <div className="card p-8 text-center">
              <DollarSign size={32} className="text-slate-600 mx-auto mb-2" />
              <p className="text-slate-400">No payroll periods yet</p>
            </div>
          )}
        </div>
      )}

      {/* Parameters Modal */}
      {showParamModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="card w-full max-w-lg p-6 animate-slide-up">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Settings size={16} className="text-brand-400" /> Payroll Parameters
            </h3>
            <div className="space-y-3">
              {params?.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-surface-200">
                  <div>
                    <p className="text-sm font-medium text-white">{p.name}</p>
                    <p className="text-xs text-slate-400">
                      {p.is_percentage ? `${(Number(p.value) * 100).toFixed(2)}%` : formatIDR(Number(p.value))} per {p.is_percentage ? 'gross' : 'day'}
                    </p>
                  </div>
                  <button
                    onClick={() => toggleParamMutation.mutate({ id: p.id, is_enabled: !p.is_enabled })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${p.is_enabled ? 'bg-brand-600' : 'bg-surface-300'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${p.is_enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              ))}
            </div>
            <button className="btn-secondary w-full mt-4 justify-center" onClick={() => setShowParamModal(false)}>Close</button>
          </div>
        </div>
      )}

      {/* Period Modal (Create / Edit) */}
      {showPeriodModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="card w-full max-w-md p-6 animate-slide-up">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Settings size={16} className="text-brand-400" />
              {editingPeriod ? 'Edit Periode Payroll' : 'Tambah Periode Payroll'}
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (editingPeriod) {
                  updatePeriodMutation.mutate({
                    id: editingPeriod.id,
                    period_month: periodMonth,
                    period_year: periodYear,
                    notes: periodNotes,
                  });
                } else {
                  createPeriodMutation.mutate({
                    period_month: periodMonth,
                    period_year: periodYear,
                    notes: periodNotes,
                  });
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Bulan</label>
                <select
                  value={periodMonth}
                  onChange={(e) => setPeriodMonth(Number(e.target.value))}
                  className="input w-full bg-surface-200 border border-surface-300 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  required
                >
                  {monthsIndo.map((name, index) => (
                    <option key={index} value={index + 1}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Tahun</label>
                <input
                  type="number"
                  value={periodYear}
                  onChange={(e) => setPeriodYear(Number(e.target.value))}
                  className="input w-full bg-surface-200 border border-surface-300 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  min={2000}
                  max={2100}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Catatan</label>
                <textarea
                  value={periodNotes}
                  onChange={(e) => setPeriodNotes(e.target.value)}
                  className="input w-full bg-surface-200 border border-surface-300 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 h-20"
                  placeholder="Catatan opsional..."
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowPeriodModal(false)}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={createPeriodMutation.isPending || updatePeriodMutation.isPending}
                >
                  {(createPeriodMutation.isPending || updatePeriodMutation.isPending) ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    'Simpan'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
