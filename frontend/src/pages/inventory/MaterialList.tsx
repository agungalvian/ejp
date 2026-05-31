import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Package, Plus, Search, AlertTriangle, ArrowDown, ArrowUp, ArrowLeftRight, Loader2, Camera } from 'lucide-react';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import api from '../../api/axios';
import { useAuthStore } from '../../store/authStore';

const formatIDR = (val: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);

const typeIcons: Record<string, JSX.Element> = {
  Stock_In: <ArrowDown size={12} className="text-green-400" />,
  Stock_Out: <ArrowUp size={12} className="text-red-400" />,
  Stock_Transfer: <ArrowLeftRight size={12} className="text-blue-400" />,
};

const typeColors: Record<string, string> = {
  Stock_In: 'badge-green', Stock_Out: 'badge-red', Stock_Transfer: 'badge-blue',
};

export default function MaterialList() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const [tab, setTab] = useState<'stocks' | 'transactions' | 'materials'>('stocks');
  const [showModal, setShowModal] = useState(false);
  const [txType, setTxType] = useState<'Stock_In' | 'Stock_Out' | 'Stock_Transfer'>('Stock_In');

  const { data: stocks } = useQuery({
    queryKey: ['stocks'],
    queryFn: () => api.get('/inventory/stocks').then((r) => r.data.data),
  });

  const { data: transactions } = useQuery({
    queryKey: ['inv-transactions'],
    queryFn: () => api.get('/inventory/transactions').then((r) => r.data.data),
  });

  const { data: materials } = useQuery({
    queryKey: ['materials'],
    queryFn: () => api.get('/inventory/materials').then((r) => r.data.data),
  });

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => api.get('/inventory/warehouses').then((r) => r.data.data),
    enabled: showModal,
  });

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm();

  const createTxMutation = useMutation({
    mutationFn: (fd: FormData) => api.post('/inventory/transactions', fd),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stocks'] });
      qc.invalidateQueries({ queryKey: ['inv-transactions'] });
      toast.success('Stock transaction recorded!');
      setShowModal(false);
      reset();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed — check stock availability'),
  });

  const lowStock = stocks?.filter((s: any) => Number(s.stock_quantity) <= 5) ?? [];

  const onSubmit = (data: any) => {
    const fd = new FormData();
    fd.append('type', txType);
    fd.append('date', data.date);
    fd.append('from_warehouse_id', data.from_warehouse_id || '');
    fd.append('to_warehouse_id', data.to_warehouse_id || '');
    fd.append('notes', data.notes || '');
    fd.append('details', JSON.stringify([{
      material_id: data.material_id,
      quantity: Number(data.quantity),
      unit_cost: Number(data.unit_cost),
    }]));
    if (data.evidence?.[0]) fd.append('evidence', data.evidence[0]);
    createTxMutation.mutate(fd);
  };

  const tabs = [
    { key: 'stocks', label: 'Current Stock' },
    { key: 'transactions', label: 'Transactions' },
    { key: 'materials', label: 'Materials' },
  ];

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h2 className="page-title">Inventory & Warehouse</h2>
          <p className="page-subtitle">Stock management and material tracking</p>
        </div>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={16} /> New Transaction
        </button>
      </div>

      {/* Low stock alert */}
      {lowStock.length > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
          <AlertTriangle size={16} className="text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-300">
            <span className="font-semibold">{lowStock.length} material{lowStock.length > 1 ? 's' : ''}</span> at low stock (≤5 units).
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-200 p-1 rounded-lg w-fit">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${tab === t.key ? 'bg-brand-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Current Stock */}
      {tab === 'stocks' && (
        <div className="table-container">
          <table className="table">
            <thead><tr><th>Material</th><th>Code</th><th>Warehouse</th><th>Unit</th><th className="text-right">Qty</th><th>Status</th></tr></thead>
            <tbody>
              {stocks?.map((s: any) => (
                <tr key={s.id}>
                  <td className="font-medium text-white">{s.material?.name}</td>
                  <td className="font-mono text-xs text-slate-400">{s.material?.code}</td>
                  <td className="text-slate-400">{s.warehouse?.name}</td>
                  <td className="text-slate-400">{s.material?.unit}</td>
                  <td className="currency font-semibold text-white">{Number(s.stock_quantity).toLocaleString('id-ID')}</td>
                  <td>
                    <span className={`badge ${Number(s.stock_quantity) <= 0 ? 'badge-red' : Number(s.stock_quantity) <= 5 ? 'badge-amber' : 'badge-green'}`}>
                      {Number(s.stock_quantity) <= 0 ? 'Out of Stock' : Number(s.stock_quantity) <= 5 ? 'Low Stock' : 'OK'}
                    </span>
                  </td>
                </tr>
              ))}
              {!stocks?.length && <tr><td colSpan={6} className="text-center py-8 text-slate-500">No stock data</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* Transactions */}
      {tab === 'transactions' && (
        <div className="space-y-3">
          {transactions?.map((tx: any) => (
            <div key={tx.id} className="card p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`badge ${typeColors[tx.type]} flex items-center gap-1`}>{typeIcons[tx.type]} {tx.type.replace('_', ' ')}</span>
                  <p className="text-sm font-medium text-white">{tx.project?.name ?? 'No Project'}</p>
                </div>
                <p className="text-xs text-slate-400">{new Date(tx.date).toLocaleDateString('id-ID')}</p>
              </div>
              <div className="mt-2 space-y-1">
                {tx.details?.map((d: any) => (
                  <div key={d.id} className="flex justify-between text-xs">
                    <span className="text-slate-400">{d.material?.name}</span>
                    <span className="text-white font-mono">{Number(d.quantity).toLocaleString()} {d.material?.unit}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {!transactions?.length && <p className="text-center py-8 text-slate-500">No transactions</p>}
        </div>
      )}

      {/* Materials */}
      {tab === 'materials' && (
        <div className="table-container">
          <table className="table">
            <thead><tr><th>Code</th><th>Name</th><th>Unit</th><th className="text-right">Unit Cost</th></tr></thead>
            <tbody>
              {materials?.map((m: any) => (
                <tr key={m.id}>
                  <td className="font-mono text-xs text-brand-400">{m.code}</td>
                  <td className="font-medium text-white">{m.name}</td>
                  <td className="text-slate-400">{m.unit}</td>
                  <td className="currency">{formatIDR(Number(m.unit_cost))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Transaction Modal — Mobile optimized */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="card w-full max-w-md p-6 animate-slide-up max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Package size={18} className="text-brand-400" /> New Stock Transaction
            </h3>

            {/* Type selector — big buttons for mobile */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {(['Stock_In', 'Stock_Out', 'Stock_Transfer'] as const).map((t) => (
                <button key={t} type="button"
                  onClick={() => setTxType(t)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-medium transition-all ${txType === t ? (t === 'Stock_In' ? 'border-green-500 bg-green-500/10 text-green-400' : t === 'Stock_Out' ? 'border-red-500 bg-red-500/10 text-red-400' : 'border-blue-500 bg-blue-500/10 text-blue-400') : 'border-surface-300 text-slate-400 hover:border-slate-500'}`}>
                  {typeIcons[t]}
                  {t.replace('_', ' ')}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="form-group">
                <label className="label">Material *</label>
                <select className="select" {...register('material_id', { required: true })}>
                  <option value="">Select material...</option>
                  {materials?.map((m: any) => <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>)}
                </select>
              </div>
              {(txType === 'Stock_Out' || txType === 'Stock_Transfer') && (
                <div className="form-group">
                  <label className="label">From Warehouse *</label>
                  <select className="select" {...register('from_warehouse_id', { required: true })}>
                    <option value="">Select warehouse...</option>
                    {warehouses?.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
              )}
              {(txType === 'Stock_In' || txType === 'Stock_Transfer') && (
                <div className="form-group">
                  <label className="label">To Warehouse *</label>
                  <select className="select" {...register('to_warehouse_id', { required: true })}>
                    <option value="">Select warehouse...</option>
                    {warehouses?.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="form-group">
                  <label className="label">Quantity *</label>
                  <input className="input" type="number" step="0.001" placeholder="10" {...register('quantity', { required: true })} />
                </div>
                <div className="form-group">
                  <label className="label">Unit Cost (IDR)</label>
                  <input className="input" type="number" placeholder="50000" {...register('unit_cost')} />
                </div>
              </div>
              <div className="form-group">
                <label className="label">Date *</label>
                <input className="input" type="date" defaultValue={new Date().toISOString().split('T')[0]} {...register('date', { required: true })} />
              </div>
              <div className="form-group">
                <label className="label">Notes</label>
                <input className="input" placeholder="Notes..." {...register('notes')} />
              </div>

              {/* Camera input for field workers */}
              <div className="form-group">
                <label className="label flex items-center gap-1.5">
                  <Camera size={13} className="text-slate-400" /> Receipt Photo (optional)
                </label>
                <label className="input flex items-center gap-2 cursor-pointer">
                  <Camera size={14} className="text-slate-400" />
                  <span className="text-slate-400 text-sm">Take photo or select file</span>
                  <input type="file" accept="image/*" capture="environment" className="hidden" {...register('evidence')} />
                </label>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" className="btn-secondary flex-1" onClick={() => { setShowModal(false); reset(); }}>Cancel</button>
                <button type="submit" disabled={createTxMutation.isPending} className="btn-primary flex-1 justify-center">
                  {createTxMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : null} Submit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
