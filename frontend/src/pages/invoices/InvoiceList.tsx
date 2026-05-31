import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Plus, Search, CheckCircle, Clock, Loader2, Upload, Receipt, Calendar, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';

const formatIDR = (val: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);

const statusColors: Record<string, string> = {
  Draft: 'badge-slate', Sent: 'badge-amber', Paid: 'badge-green', Cancelled: 'badge-red',
};

const typeColors: Record<string, string> = {
  Down_Payment: 'badge-blue', Termin_Progress: 'badge-purple', Retention_Claim: 'badge-amber',
};

export default function InvoicesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // New Invoice Modal state
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [projectId, setProjectId] = useState('');
  const [invoiceType, setInvoiceType] = useState<'Down_Payment' | 'Termin_Progress' | 'Retention_Claim'>('Termin_Progress');
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [invoiceDueDate, setInvoiceDueDate] = useState('');
  const [invoiceNotes, setInvoiceNotes] = useState('');
  const [invoiceTaxes, setInvoiceTaxes] = useState<string[]>([]);

  const { data: invoices, isLoading } = useQuery({
    queryKey: ['invoices', statusFilter],
    queryFn: () =>
      api.get('/invoices', { params: { status: statusFilter || undefined } }).then((r) => r.data.data),
  });

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get('/projects').then((r) => r.data.data),
  });

  const { data: taxParams } = useQuery({
    queryKey: ['tax-parameters'],
    queryFn: () => api.get('/invoices/tax-params').then((r) => r.data.data),
  });

  const createInvoiceMutation = useMutation({
    mutationFn: (body: any) => api.post('/invoices', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Invoice berhasil dibuat!');
      setShowInvoiceModal(false);
      setProjectId('');
      setInvoiceType('Termin_Progress');
      setInvoiceAmount('');
      setInvoiceDueDate('');
      setInvoiceNotes('');
      setInvoiceTaxes([]);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Gagal membuat invoice'),
  });

  const markPaidMutation = useMutation({
    mutationFn: ({ id, file }: { id: string; file?: File }) => {
      const fd = new FormData();
      fd.append('status', 'Paid');
      if (file) fd.append('evidence', file);
      return api.patch(`/invoices/${id}/status`, fd);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Invoice marked as Paid! Journal entry created.');
      setSelectedId(null);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed'),
  });

  const filtered = invoices?.filter((inv: any) =>
    inv.invoice_number?.toLowerCase().includes(search.toLowerCase()) ||
    inv.project?.name?.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  const totalPending = invoices?.filter((i: any) => i.status === 'Sent')
    .reduce((s: number, i: any) => s + Number(i.total_amount), 0) ?? 0;

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h2 className="page-title">Invoicing</h2>
          <p className="page-subtitle">Project invoices and tax management</p>
        </div>
        <button onClick={() => setShowInvoiceModal(true)} className="btn-primary"><Plus size={16} /> New Invoice</button>
      </div>

      {/* Summary banner */}
      {totalPending > 0 && (
        <div className="card p-4 flex items-center gap-4 border-amber-500/30 bg-amber-500/5">
          <Clock size={18} className="text-amber-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-white">Pending Payments</p>
            <p className="text-xs text-slate-400">{formatIDR(totalPending)} outstanding</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Search invoices..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="select w-36" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          {['Draft', 'Sent', 'Paid', 'Cancelled'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-brand-400" /></div>
      ) : (
        <>
          <div className="table-container hidden md:block">
            <table className="table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Project</th>
                  <th>Type</th>
                  <th className="text-right">Amount</th>
                  <th className="text-right">Tax</th>
                  <th className="text-right">Total</th>
                  <th>Due Date</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv: any) => (
                  <tr key={inv.id}>
                    <td className="font-mono text-xs text-brand-400">{inv.invoice_number}</td>
                    <td className="text-white">{inv.project?.name}</td>
                    <td><span className={typeColors[inv.invoice_type] ?? 'badge-slate'}>{inv.invoice_type.replace('_', ' ')}</span></td>
                    <td className="currency">{formatIDR(Number(inv.amount))}</td>
                    <td className="currency text-slate-400">{formatIDR(Number(inv.tax_total))}</td>
                    <td className="currency font-semibold text-white">{formatIDR(Number(inv.total_amount))}</td>
                    <td className="text-slate-400 text-xs">{inv.due_date ? new Date(inv.due_date).toLocaleDateString('id-ID') : '—'}</td>
                    <td><span className={statusColors[inv.status] ?? 'badge-slate'}>{inv.status}</span></td>
                    <td>
                      {inv.status === 'Sent' && (
                        <button
                          onClick={() => setSelectedId(inv.id)}
                          className="btn-success text-xs px-2 py-1"
                        >
                          <CheckCircle size={12} /> Mark Paid
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {!filtered.length && (
                  <tr><td colSpan={9} className="text-center py-8 text-slate-500">No invoices found</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((inv: any) => (
              <div key={inv.id} className="card p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-mono text-xs text-brand-400">{inv.invoice_number}</p>
                    <p className="text-sm font-medium text-white mt-0.5">{inv.project?.name}</p>
                  </div>
                  <span className={statusColors[inv.status]}>{inv.status}</span>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <span className={typeColors[inv.invoice_type] ?? 'badge-slate'}>{inv.invoice_type.replace('_', ' ')}</span>
                  <p className="font-mono font-bold text-white">{formatIDR(Number(inv.total_amount))}</p>
                </div>
                {inv.status === 'Sent' && (
                  <button onClick={() => setSelectedId(inv.id)} className="btn-success w-full justify-center mt-3 text-sm">
                    <CheckCircle size={14} /> Mark as Paid
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Mark Paid Modal */}
      {selectedId && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="card w-full max-w-sm p-6 animate-slide-up">
            <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
              <CheckCircle size={16} className="text-green-400" /> Mark Invoice as Paid
            </h3>
            <p className="text-sm text-slate-400 mb-4">
              This will automatically create double-entry journal entries in the General Ledger.
            </p>
            <div className="form-group mb-4">
              <label className="label">Upload Payment Evidence (optional)</label>
              <label className="input flex items-center gap-2 cursor-pointer">
                <Upload size={14} className="text-slate-400" />
                <span className="text-slate-400 text-sm">Choose file...</span>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    markPaidMutation.mutate({ id: selectedId, file });
                  }}
                />
              </label>
            </div>
            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => setSelectedId(null)}>Cancel</button>
              <button
                className="btn-success flex-1 justify-center"
                disabled={markPaidMutation.isPending}
                onClick={() => markPaidMutation.mutate({ id: selectedId })}
              >
                {markPaidMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                Confirm Paid
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Add Invoice */}
      {showInvoiceModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="card w-full max-w-md p-6 animate-slide-up">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2 border-b border-surface-300 pb-2">
              <Receipt size={18} className="text-amber-400" /> Buat Invoice Baru
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createInvoiceMutation.mutate({
                  project_id: projectId,
                  invoice_type: invoiceType,
                  amount: invoiceAmount ? Number(invoiceAmount) : undefined,
                  due_date: invoiceDueDate || undefined,
                  notes: invoiceNotes || undefined,
                  tax_ids: invoiceTaxes,
                });
              }}
              className="space-y-4"
            >
              <div className="form-group">
                <label className="label">Proyek *</label>
                <select
                  className="select"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  required
                >
                  <option value="">-- Pilih Proyek --</option>
                  {projects?.filter((p: any) => p.status !== 'Cancelled').map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.project_code} - {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="label">Tipe Invoice *</label>
                <select
                  className="select"
                  value={invoiceType}
                  onChange={(e) => setInvoiceType(e.target.value as any)}
                  required
                >
                  <option value="Down_Payment">Uang Muka (Down Payment)</option>
                  <option value="Termin_Progress">Termin Progress / Termin Kerja</option>
                  <option value="Retention_Claim">Klaim Retensi</option>
                </select>
              </div>

              <div className="form-group">
                <label className="label">Nominal / Nilai (IDR)</label>
                <input
                  type="number"
                  className="input"
                  placeholder={
                    invoiceType === 'Down_Payment'
                      ? 'Kosongkan untuk hitung otomatis dari % proyek'
                      : 'Contoh: 25000000'
                  }
                  value={invoiceAmount}
                  onChange={(e) => setInvoiceAmount(e.target.value)}
                />
                {invoiceType === 'Down_Payment' && (
                  (() => {
                    const selProj = projects?.find((p: any) => p.id === projectId);
                    return selProj ? (
                      <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                        <Info size={10} /> Proyek ini memiliki konfigurasi uang muka sebesar{' '}
                        {Number(selProj.down_payment_percentage)}%
                      </p>
                    ) : (
                      <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                        <Info size={10} /> Pilih proyek untuk melihat konfigurasi uang muka
                      </p>
                    );
                  })()
                )}
              </div>

              <div className="form-group">
                <label className="label">Tanggal Jatuh Tempo</label>
                <div className="relative">
                  <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="date"
                    className="input pl-9"
                    value={invoiceDueDate}
                    onChange={(e) => setInvoiceDueDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="label">Pajak (Taxes)</label>
                <div className="space-y-2 max-h-24 overflow-y-auto bg-surface-200 p-2.5 rounded-lg border border-surface-300">
                  {taxParams?.map((tax: any) => (
                    <label key={tax.id} className="flex items-center gap-2 text-xs text-white cursor-pointer">
                      <input
                        type="checkbox"
                        checked={invoiceTaxes.includes(tax.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setInvoiceTaxes([...invoiceTaxes, tax.id]);
                          } else {
                            setInvoiceTaxes(invoiceTaxes.filter((t) => t !== tax.id));
                          }
                        }}
                        className="rounded border-surface-300 text-brand-600 focus:ring-brand-500"
                      />
                      <span>
                        {tax.name} ({(Number(tax.rate) * 100).toFixed(0)}%)
                      </span>
                    </label>
                  ))}
                  {!taxParams?.length && (
                    <span className="text-xs text-slate-500">Tidak ada parameter pajak aktif</span>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label className="label">Catatan</label>
                <textarea
                  className="input h-16"
                  placeholder="Catatan pembayaran termin, termin progress, dll."
                  value={invoiceNotes}
                  onChange={(e) => setInvoiceNotes(e.target.value)}
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-surface-300">
                <button
                  type="button"
                  className="btn-secondary flex-1"
                  onClick={() => {
                    setShowInvoiceModal(false);
                    setProjectId('');
                    setInvoiceType('Termin_Progress');
                    setInvoiceAmount('');
                    setInvoiceDueDate('');
                    setInvoiceNotes('');
                    setInvoiceTaxes([]);
                  }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={createInvoiceMutation.isPending}
                  className="btn-primary flex-1 justify-center"
                >
                  {createInvoiceMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
                  Buat Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
