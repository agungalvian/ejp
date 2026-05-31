import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Plus, Building2, Receipt, Calendar, Info, FileText, Truck, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { useAuthStore } from '../../store/authStore';

const formatIDR = (val: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);

const statusColors: Record<string, string> = {
  Draft: 'badge-slate', Sent: 'badge-amber', Paid: 'badge-green', Cancelled: 'badge-red',
};

const projectStatusColors: Record<string, string> = {
  Planning: 'badge-slate',
  Active: 'badge-green',
  On_Hold: 'badge-amber',
  Completed: 'badge-blue',
  Cancelled: 'badge-red',
};

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const canUpdateStatus = user?.role === 'Admin' || user?.role === 'Manajer_Proyek';

  // Modals state
  const [showRabModal, setShowRabModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  // RAB Form state
  const [rabDesc, setRabDesc] = useState('');
  const [rabUnit, setRabUnit] = useState('');
  const [rabQty, setRabQty] = useState('');
  const [rabPrice, setRabPrice] = useState('');

  // Invoice Form state
  const [invoiceType, setInvoiceType] = useState<'Down_Payment' | 'Termin_Progress' | 'Retention_Claim'>('Termin_Progress');
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [invoiceDueDate, setInvoiceDueDate] = useState('');
  const [invoiceNotes, setInvoiceNotes] = useState('');
  const [invoiceTaxes, setInvoiceTaxes] = useState<string[]>([]);

  // Rent Equipment Form state
  const [showRentModal, setShowRentModal] = useState(false);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState('');
  const [operatorName, setOperatorName] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [hourMeterStart, setHourMeterStart] = useState('');
  const [ratePerHour, setRatePerHour] = useState('');
  const [rentNotes, setRentNotes] = useState('');

  // Close Equipment Rental Form state
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [hourMeterEnd, setHourMeterEnd] = useState('');
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => api.get(`/projects/${id}`).then((r) => r.data.data),
  });

  const { data: taxParams } = useQuery({
    queryKey: ['tax-parameters'],
    queryFn: () => api.get('/invoices/tax-params').then((r) => r.data.data),
  });

  const { data: availableEquipment } = useQuery({
    queryKey: ['available-equipment'],
    queryFn: () => api.get('/equipment', { params: { status: 'Available' } }).then((r) => r.data.data),
    enabled: showRentModal,
  });

  const updateProjectStatusMutation = useMutation({
    mutationFn: (newStatus: string) => api.put(`/projects/${id}`, { status: newStatus }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project', id] });
      toast.success('Status proyek berhasil diperbarui!');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Gagal memperbarui status proyek'),
  });

  const createRabMutation = useMutation({
    mutationFn: (body: any) => api.post(`/projects/${id}/rab`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project', id] });
      toast.success('Item RAB berhasil ditambahkan!');
      setShowRabModal(false);
      setRabDesc('');
      setRabUnit('');
      setRabQty('');
      setRabPrice('');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Gagal menambahkan item RAB'),
  });

  const createInvoiceMutation = useMutation({
    mutationFn: (body: any) => api.post('/invoices', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project', id] });
      toast.success('Invoice berhasil dibuat!');
      setShowInvoiceModal(false);
      setInvoiceType('Termin_Progress');
      setInvoiceAmount('');
      setInvoiceDueDate('');
      setInvoiceNotes('');
      setInvoiceTaxes([]);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Gagal membuat invoice'),
  });

  const createRentalMutation = useMutation({
    mutationFn: (body: any) => api.post(`/equipment/${body.equipment_id}/rentals`, body.payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project', id] });
      toast.success('Penyewaan alat berat berhasil dicatat!');
      setShowRentModal(false);
      setSelectedEquipmentId('');
      setOperatorName('');
      setStartDate(new Date().toISOString().split('T')[0]);
      setHourMeterStart('');
      setRatePerHour('');
      setRentNotes('');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Gagal mencatat penyewaan'),
  });

  const closeRentalMutation = useMutation({
    mutationFn: (body: any) =>
      api.patch(`/equipment/${body.equipment_id}/rentals/${body.log_id}/close`, {
        hour_meter_end: body.hour_meter_end,
        end_date: body.end_date,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project', id] });
      toast.success('Penyewaan alat berat berhasil diselesaikan!');
      setShowReturnModal(false);
      setSelectedLog(null);
      setHourMeterEnd('');
      setEndDate(new Date().toISOString().split('T')[0]);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Gagal menyelesaikan penyewaan'),
  });

  if (isLoading) return (
    <div className="flex justify-center py-24"><Loader2 size={28} className="animate-spin text-brand-400" /></div>
  );

  if (!project) return <div className="text-center py-16 text-slate-500">Project not found</div>;

  const totalBudget = project.rab_budgets?.reduce((s: number, b: any) => s + Number(b.qty) * Number(b.unit_price), 0) ?? 0;
  const totalActual = project.rab_budgets?.reduce((s: number, b: any) => s + Number(b.actual_cost), 0) ?? 0;
  const paidInvoices = project.invoices?.filter((i: any) => i.status === 'Paid').reduce((s: number, i: any) => s + Number(i.total_amount), 0) ?? 0;

  return (
    <div className="space-y-5 animate-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-icon">
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-brand-400">{project.project_code}</span>
            {canUpdateStatus ? (
              <select
                value={project.status}
                onChange={(e) => updateProjectStatusMutation.mutate(e.target.value)}
                className="badge py-0.5 px-2 bg-surface-200 border border-surface-300 text-white rounded text-xs font-medium focus:outline-none cursor-pointer hover:border-brand-500 transition-colors"
              >
                {['Planning', 'Active', 'On_Hold', 'Completed', 'Cancelled'].map((status) => (
                  <option key={status} value={status} className="bg-surface-100 text-white">
                    {status.replace('_', ' ')}
                  </option>
                ))}
              </select>
            ) : (
              <span className={`badge ${projectStatusColors[project.status] ?? 'badge-slate'}`}>
                {project.status.replace('_', ' ')}
              </span>
            )}
          </div>
          <h2 className="page-title">{project.name}</h2>
          <p className="page-subtitle">Client: {project.contact?.name}</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Contract Value', value: formatIDR(Number(project.contract_value)), color: '#3b82f6' },
          { label: 'RAB Budget', value: formatIDR(totalBudget), color: '#a855f7' },
          { label: 'Actual Cost', value: formatIDR(totalActual), color: '#f59e0b' },
          { label: 'Invoiced & Paid', value: formatIDR(paidInvoices), color: '#22c55e' },
        ].map((kpi) => (
          <div key={kpi.label} className="card p-4">
            <p className="text-xs text-slate-400">{kpi.label}</p>
            <p className="text-lg font-bold mt-1 font-mono" style={{ color: kpi.color }}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* RAB Table */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Building2 size={14} className="text-brand-400" /> RAB Budget Items
          </h3>
          <button onClick={() => setShowRabModal(true)} className="btn-secondary text-xs px-3 py-1.5"><Plus size={12} /> Add Item</button>
        </div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Unit</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Unit Price</th>
                <th className="text-right">Budget Total</th>
                <th className="text-right">Actual Cost</th>
                <th className="text-right">Variance</th>
              </tr>
            </thead>
            <tbody>
              {project.rab_budgets?.map((b: any) => {
                const budget = Number(b.qty) * Number(b.unit_price);
                const variance = budget - Number(b.actual_cost);
                return (
                  <tr key={b.id}>
                    <td className="text-white font-medium">{b.description}</td>
                    <td className="text-slate-400">{b.unit}</td>
                    <td className="currency">{Number(b.qty).toLocaleString('id-ID')}</td>
                    <td className="currency">{formatIDR(Number(b.unit_price))}</td>
                    <td className="currency font-semibold">{formatIDR(budget)}</td>
                    <td className="currency text-amber-300">{formatIDR(Number(b.actual_cost))}</td>
                    <td className={`currency font-semibold ${variance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {variance >= 0 ? '+' : ''}{formatIDR(variance)}
                    </td>
                  </tr>
                );
              })}
              {!project.rab_budgets?.length && (
                <tr><td colSpan={7} className="text-center py-6 text-slate-500">No RAB items yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Heavy Equipment Rentals */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Truck size={14} className="text-brand-400" /> Log Sewa Alat Berat
          </h3>
          {canUpdateStatus && (
            <button
              onClick={() => setShowRentModal(true)}
              className="btn-secondary text-xs px-3 py-1.5"
            >
              <Plus size={12} /> Log Sewa Alat
            </button>
          )}
        </div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Alat Berat</th>
                <th>Operator</th>
                <th>Mulai Sewa</th>
                <th>Selesai Sewa</th>
                <th className="text-right">HM Awal</th>
                <th className="text-right">HM Akhir</th>
                <th className="text-right">HM Digunakan</th>
                <th className="text-right">Tarif / Jam</th>
                <th className="text-right">Total Biaya</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {project.rental_logs?.map((log: any) => {
                const isClosed = !!log.end_date;
                return (
                  <tr key={log.id}>
                    <td className="text-white font-medium">
                      {log.equipment?.name} <span className="text-xs text-slate-400">({log.equipment?.asset_code})</span>
                    </td>
                    <td className="text-slate-300">{log.operator_name || '—'}</td>
                    <td className="text-slate-400 text-xs">{new Date(log.start_date).toLocaleDateString('id-ID')}</td>
                    <td className="text-slate-400 text-xs">
                      {isClosed ? new Date(log.end_date).toLocaleDateString('id-ID') : (
                        <span className="badge badge-amber text-[10px]">Sedang Disewa</span>
                      )}
                    </td>
                    <td className="currency">{Number(log.hour_meter_start).toLocaleString('id-ID')}</td>
                    <td className="currency">{isClosed ? Number(log.hour_meter_end).toLocaleString('id-ID') : '—'}</td>
                    <td className="currency font-semibold text-slate-300">{isClosed ? Number(log.hour_meter_used).toLocaleString('id-ID') : '—'}</td>
                    <td className="currency">{formatIDR(Number(log.rate_per_hour))}</td>
                    <td className="currency font-semibold text-brand-400">
                      {isClosed ? formatIDR(Number(log.total_cost)) : '—'}
                    </td>
                    <td>
                      {!isClosed && canUpdateStatus && (
                        <button
                          onClick={() => {
                            setSelectedLog(log);
                            setHourMeterEnd('');
                            setShowReturnModal(true);
                          }}
                          className="btn-success text-xs px-2 py-1 flex items-center gap-1"
                        >
                          Selesai Sewa
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!project.rental_logs?.length && (
                <tr>
                  <td colSpan={10} className="text-center py-6 text-slate-500">
                    Belum ada penyewaan alat berat untuk proyek ini
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoices */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Receipt size={14} className="text-amber-400" /> Invoices
          </h3>
          <button onClick={() => setShowInvoiceModal(true)} className="btn-secondary text-xs px-3 py-1.5"><Plus size={12} /> New Invoice</button>
        </div>
        <div className="space-y-2">
          {project.invoices?.map((inv: any) => (
            <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg bg-surface-200 hover:bg-surface-300 transition-colors">
              <div>
                <p className="text-sm font-medium text-white">{inv.invoice_number}</p>
                <p className="text-xs text-slate-400">{inv.invoice_type.replace('_', ' ')} · {inv.due_date ? new Date(inv.due_date).toLocaleDateString('id-ID') : 'No due date'}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-mono font-semibold text-white">{formatIDR(Number(inv.total_amount))}</p>
                <span className={statusColors[inv.status] ?? 'badge-slate'}>{inv.status}</span>
              </div>
            </div>
          ))}
          {!project.invoices?.length && (
            <p className="text-center py-4 text-slate-500 text-sm">No invoices yet</p>
          )}
        </div>
      </div>

      {/* Modal Add RAB Item */}
      {showRabModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="card w-full max-w-md p-6 animate-slide-up">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2 border-b border-surface-300 pb-2">
              <Building2 size={18} className="text-brand-400" /> Tambah Item RAB
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createRabMutation.mutate({
                  description: rabDesc,
                  unit: rabUnit,
                  qty: Number(rabQty),
                  unit_price: Number(rabPrice),
                });
              }}
              className="space-y-4"
            >
              <div className="form-group">
                <label className="label">Deskripsi Item *</label>
                <input
                  className="input"
                  placeholder="Contoh: Pekerjaan Tanah & Galian"
                  value={rabDesc}
                  onChange={(e) => setRabDesc(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="label">Satuan *</label>
                <input
                  className="input"
                  placeholder="Contoh: m3, ls, unit, hari"
                  value={rabUnit}
                  onChange={(e) => setRabUnit(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="label">Volume / Qty *</label>
                  <input
                    type="number"
                    step="any"
                    className="input"
                    placeholder="10"
                    value={rabQty}
                    onChange={(e) => setRabQty(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="label">Harga Satuan (IDR) *</label>
                  <input
                    type="number"
                    className="input"
                    placeholder="150000"
                    value={rabPrice}
                    onChange={(e) => setRabPrice(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-surface-300">
                <button type="button" className="btn-secondary flex-1" onClick={() => setShowRabModal(false)}>
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={createRabMutation.isPending}
                  className="btn-primary flex-1 justify-center"
                >
                  {createRabMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
                  Simpan Item
                </button>
              </div>
            </form>
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
                  project_id: id,
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
                  <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                    <Info size={10} /> Proyek ini memiliki konfigurasi uang muka sebesar{' '}
                    {Number(project.down_payment_percentage)}%
                  </p>
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
                <button type="button" className="btn-secondary flex-1" onClick={() => setShowInvoiceModal(false)}>
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

      {/* Modal Log Sewa Alat */}
      {showRentModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="card w-full max-w-md p-6 animate-slide-up">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2 border-b border-surface-300 pb-2">
              <Truck size={18} className="text-brand-400" /> Log Sewa Alat Berat
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createRentalMutation.mutate({
                  equipment_id: selectedEquipmentId,
                  payload: {
                    project_id: id,
                    operator_name: operatorName || undefined,
                    start_date: startDate,
                    hour_meter_start: Number(hourMeterStart),
                    rate_per_hour: Number(ratePerHour),
                    notes: rentNotes || undefined,
                  }
                });
              }}
              className="space-y-4"
            >
              <div className="form-group">
                <label className="label">Pilih Alat Berat *</label>
                <select
                  className="select"
                  value={selectedEquipmentId}
                  onChange={(e) => setSelectedEquipmentId(e.target.value)}
                  required
                >
                  <option value="">-- Pilih Alat Berat --</option>
                  {availableEquipment?.map((eq: any) => (
                    <option key={eq.id} value={eq.id}>
                      {eq.name} ({eq.asset_code}) · Useful Life: {eq.useful_life_years}thn
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="label">Nama Operator</label>
                <input
                  className="input"
                  placeholder="Contoh: Andi, Budi"
                  value={operatorName}
                  onChange={(e) => setOperatorName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="label">HM Awal *</label>
                  <input
                    type="number"
                    step="any"
                    className="input"
                    placeholder="100.5"
                    value={hourMeterStart}
                    onChange={(e) => setHourMeterStart(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="label">Tarif per Jam (IDR) *</label>
                  <input
                    type="number"
                    className="input"
                    placeholder="150000"
                    value={ratePerHour}
                    onChange={(e) => setRatePerHour(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="label">Tanggal Mulai Sewa *</label>
                <div className="relative">
                  <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="date"
                    className="input pl-9"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="label">Catatan</label>
                <textarea
                  className="input h-16"
                  placeholder="Catatan pengerjaan lapangan, dll."
                  value={rentNotes}
                  onChange={(e) => setRentNotes(e.target.value)}
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-surface-300">
                <button type="button" className="btn-secondary flex-1" onClick={() => setShowRentModal(false)}>
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={createRentalMutation.isPending}
                  className="btn-primary flex-1 justify-center"
                >
                  {createRentalMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
                  Mulai Sewa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Selesai Sewa */}
      {showReturnModal && selectedLog && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="card w-full max-w-sm p-6 animate-slide-up">
            <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2 border-b border-surface-300 pb-2">
              <CheckCircle size={16} className="text-green-400" /> Selesai Penyewaan Alat
            </h3>
            <div className="text-xs text-slate-400 mb-3 space-y-1 bg-surface-200 p-2.5 rounded-lg border border-surface-300">
              <p>Alat: <span className="text-white font-medium">{selectedLog.equipment?.name} ({selectedLog.equipment?.asset_code})</span></p>
              <p>Operator: <span className="text-white font-medium">{selectedLog.operator_name || '—'}</span></p>
              <p>HM Awal: <span className="text-white font-medium font-mono">{Number(selectedLog.hour_meter_start).toLocaleString('id-ID')}</span></p>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (Number(hourMeterEnd) < Number(selectedLog.hour_meter_start)) {
                  toast.error(`HM Akhir tidak boleh kurang dari HM Awal (${selectedLog.hour_meter_start})`);
                  return;
                }
                closeRentalMutation.mutate({
                  equipment_id: selectedLog.equipment_id,
                  log_id: selectedLog.id,
                  hour_meter_end: Number(hourMeterEnd),
                  end_date: endDate || undefined,
                });
              }}
              className="space-y-4"
            >
              <div className="form-group">
                <label className="label">HM Akhir *</label>
                <input
                  type="number"
                  step="any"
                  className="input"
                  placeholder="120.5"
                  value={hourMeterEnd}
                  onChange={(e) => setHourMeterEnd(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="label">Tanggal Selesai Sewa *</label>
                <div className="relative">
                  <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="date"
                    className="input pl-9"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-surface-300">
                <button type="button" className="btn-secondary flex-1" onClick={() => setShowReturnModal(false)}>
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={closeRentalMutation.isPending}
                  className="btn-success flex-1 justify-center"
                >
                  {closeRentalMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
                  Selesaikan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
