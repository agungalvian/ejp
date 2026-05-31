import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Truck, Plus, Search, Wrench, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import api from '../../api/axios';

const formatIDR = (val: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);

const statusIcons: Record<string, JSX.Element> = {
  Available: <CheckCircle size={12} className="text-green-400" />,
  Rented: <Truck size={12} className="text-amber-400" />,
  Maintenance: <Wrench size={12} className="text-blue-400" />,
  Retired: <XCircle size={12} className="text-red-400" />,
};

const statusColors: Record<string, string> = {
  Available: 'badge-green', Rented: 'badge-amber', Maintenance: 'badge-blue', Retired: 'badge-red',
};

export default function EquipmentPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showDepModal, setShowDepModal] = useState(false);

  const { data: equipment, isLoading } = useQuery({
    queryKey: ['equipment', search],
    queryFn: () => api.get('/equipment', { params: { search: search || undefined } }).then((r) => r.data.data),
  });

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm();

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/equipment', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['equipment'] }); toast.success('Equipment added!'); setShowModal(false); reset(); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed'),
  });

  const runDepMutation = useMutation({
    mutationFn: (data: any) => api.post('/equipment/depreciation/run', data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['equipment'] });
      toast.success(`Depreciation run: ${res.data.count} assets processed!`);
      setShowDepModal(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed'),
  });

  const totalValue = equipment?.reduce((s: number, eq: any) => s + Number(eq.current_book_value), 0) ?? 0;
  const availableCount = equipment?.filter((eq: any) => eq.status === 'Available').length ?? 0;
  const rentedCount = equipment?.filter((eq: any) => eq.status === 'Rented').length ?? 0;

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h2 className="page-title">Heavy Equipment</h2>
          <p className="page-subtitle">Fleet management, rental logs & depreciation</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => setShowDepModal(true)}>
            <Wrench size={14} /> Run Depreciation
          </button>
          <button className="btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={16} /> Add Equipment
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Fleet', value: equipment?.length ?? 0, color: '#3b82f6' },
          { label: 'Available', value: availableCount, color: '#22c55e' },
          { label: 'Total Book Value', value: formatIDR(totalValue), color: '#a855f7' },
        ].map((s) => (
          <div key={s.label} className="card p-4 text-center">
            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs text-slate-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input className="input pl-9" placeholder="Search equipment..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-brand-400" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {equipment?.map((eq: any) => (
            <div key={eq.id} className="card p-5 hover:border-brand-600/40 transition-all cursor-pointer group">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-brand-600/10 border border-brand-600/20 flex items-center justify-center">
                  <Truck size={18} className="text-brand-400" />
                </div>
                <span className={`badge ${statusColors[eq.status] ?? 'badge-slate'} flex items-center gap-1`}>
                  {statusIcons[eq.status]} {eq.status}
                </span>
              </div>
              <p className="font-semibold text-white">{eq.name}</p>
              <p className="text-xs text-slate-400 mt-0.5">{eq.type} · {eq.asset_code}</p>
              <div className="mt-3 pt-3 border-t border-surface-300 grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-slate-500">Acquisition Cost</p>
                  <p className="text-xs font-mono text-slate-300">{formatIDR(Number(eq.acquisition_cost))}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Book Value</p>
                  <p className="text-xs font-mono text-brand-400">{formatIDR(Number(eq.current_book_value))}</p>
                </div>
              </div>
              <div className="mt-2">
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>Depreciated</span>
                  <span>{Math.round((1 - Number(eq.current_book_value) / Number(eq.acquisition_cost)) * 100)}%</span>
                </div>
                <div className="w-full bg-surface-300 rounded-full h-1.5">
                  <div className="bg-brand-500 h-1.5 rounded-full transition-all"
                    style={{ width: `${Math.min(100, (1 - Number(eq.current_book_value) / Number(eq.acquisition_cost)) * 100)}%` }} />
                </div>
              </div>
            </div>
          ))}
          {!equipment?.length && (
            <div className="col-span-3 text-center py-12 text-slate-500">No equipment found</div>
          )}
        </div>
      )}

      {/* Add Equipment Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="card w-full max-w-lg p-6 animate-slide-up">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Truck size={18} className="text-brand-400" /> Add Equipment
            </h3>
            <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 form-group">
                  <label className="label">Equipment Name *</label>
                  <input className="input" placeholder="Excavator PC200" {...register('name', { required: true })} />
                </div>
                <div className="form-group">
                  <label className="label">Type *</label>
                  <input className="input" placeholder="Excavator" {...register('type', { required: true })} />
                </div>
                <div className="form-group">
                  <label className="label">Brand</label>
                  <input className="input" placeholder="Komatsu" {...register('brand')} />
                </div>
                <div className="form-group">
                  <label className="label">Serial Number</label>
                  <input className="input" placeholder="PC200-8M0" {...register('serial_number')} />
                </div>
                <div className="form-group">
                  <label className="label">Useful Life (years) *</label>
                  <input className="input" type="number" placeholder="10" {...register('useful_life_years', { required: true, valueAsNumber: true })} />
                </div>
                <div className="form-group">
                  <label className="label">Acquisition Cost (IDR) *</label>
                  <input className="input" type="number" placeholder="850000000" {...register('acquisition_cost', { required: true })} />
                </div>
                <div className="form-group">
                  <label className="label">Acquisition Date *</label>
                  <input className="input" type="date" {...register('acquisition_date', { required: true })} />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" className="btn-secondary flex-1" onClick={() => { setShowModal(false); reset(); }}>Cancel</button>
                <button type="submit" disabled={isSubmitting} className="btn-primary flex-1 justify-center">
                  {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : null} Add Equipment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Depreciation Modal */}
      {showDepModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="card w-full max-w-sm p-6 animate-slide-up">
            <h3 className="text-base font-semibold text-white mb-2">Run Monthly Depreciation</h3>
            <p className="text-sm text-slate-400 mb-4">
              Straight-line depreciation will be calculated for all active assets and journal entries will be created.
            </p>
            <form onSubmit={handleSubmit((d) => runDepMutation.mutate({ month: Number(d.month), year: Number(d.year) }))} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="form-group">
                  <label className="label">Month</label>
                  <select className="select" {...register('month', { required: true })} defaultValue={new Date().getMonth() + 1}>
                    {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{String(i + 1).padStart(2, '0')}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="label">Year</label>
                  <input className="input" type="number" defaultValue={new Date().getFullYear()} {...register('year', { required: true })} />
                </div>
              </div>
              <div className="flex gap-3">
                <button type="button" className="btn-secondary flex-1" onClick={() => setShowDepModal(false)}>Cancel</button>
                <button type="submit" disabled={runDepMutation.isPending} className="btn-primary flex-1 justify-center">
                  {runDepMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Wrench size={14} />} Run
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
