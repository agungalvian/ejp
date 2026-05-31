import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, Search, Filter, FolderOpen, ChevronRight, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import api from '../../api/axios';

const statusColors: Record<string, string> = {
  Planning: 'badge-slate',
  Active: 'badge-green',
  On_Hold: 'badge-amber',
  Completed: 'badge-blue',
  Cancelled: 'badge-red',
};

const formatIDR = (val: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);

export default function ProjectsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects', search, statusFilter],
    queryFn: () =>
      api.get('/projects', { params: { search: search || undefined, status: statusFilter || undefined } }).then((r) => r.data.data),
  });

  const { data: contacts } = useQuery({
    queryKey: ['contacts-clients'],
    queryFn: () => api.get('/contacts', { params: { type: 'Client' } }).then((r) => r.data.data),
    enabled: showModal,
  });

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm();

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/projects', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project created!');
      setShowModal(false);
      reset();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to create project'),
  });

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h2 className="page-title">Projects & RAB</h2>
          <p className="page-subtitle">Manage construction projects and budgets</p>
        </div>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={16} /> New Project
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="relative">
          <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <select className="select pl-9 w-full sm:w-40" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All Status</option>
            {['Planning', 'Active', 'On_Hold', 'Completed', 'Cancelled'].map((s) => (
              <option key={s} value={s}>{s.replace('_', ' ')}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table / Cards */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-brand-400" /></div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="table-container hidden md:block">
            <table className="table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Project Name</th>
                  <th>Client</th>
                  <th>Contract Value</th>
                  <th>DP %</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {projects?.map((p: any) => (
                  <tr key={p.id} className="cursor-pointer">
                    <td className="font-mono text-xs text-brand-400">{p.project_code}</td>
                    <td className="font-medium text-white">{p.name}</td>
                    <td className="text-slate-400">{p.contact?.name ?? '—'}</td>
                    <td className="currency text-slate-300">{formatIDR(Number(p.contract_value))}</td>
                    <td className="text-center text-slate-400">{Number(p.down_payment_percentage) > 0 ? `${p.down_payment_percentage}%` : '—'}</td>
                    <td><span className={statusColors[p.status] ?? 'badge-slate'}>{p.status.replace('_', ' ')}</span></td>
                    <td>
                      <Link to={`/projects/${p.id}`} className="btn-icon p-1">
                        <ChevronRight size={14} />
                      </Link>
                    </td>
                  </tr>
                ))}
                {!projects?.length && (
                  <tr><td colSpan={7} className="text-center py-8 text-slate-500">No projects found</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {projects?.map((p: any) => (
              <Link key={p.id} to={`/projects/${p.id}`}
                className="card p-4 block hover:border-brand-600/50 transition-colors">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-white">{p.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{p.contact?.name} · {p.project_code}</p>
                  </div>
                  <span className={`${statusColors[p.status] ?? 'badge-slate'} flex-shrink-0 ml-2`}>
                    {p.status.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-sm font-mono text-brand-400 mt-2">{formatIDR(Number(p.contract_value))}</p>
              </Link>
            ))}
          </div>
        </>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="card w-full max-w-lg p-6 animate-slide-up">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <FolderOpen size={18} className="text-brand-400" /> New Project
            </h3>
            <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 form-group">
                  <label className="label">Project Name *</label>
                  <input className="input" placeholder="Gedung Perkantoran A" {...register('name', { required: true })} />
                </div>
                <div className="form-group">
                  <label className="label">Client *</label>
                  <select className="select" {...register('contact_id', { required: true })}>
                    <option value="">Select client...</option>
                    {contacts?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="label">Contract Value (IDR) *</label>
                  <input className="input" type="number" placeholder="5000000000" {...register('contract_value', { required: true })} />
                </div>
                <div className="form-group">
                  <label className="label">Down Payment % (0 = none)</label>
                  <input className="input" type="number" step="0.01" placeholder="20" {...register('down_payment_percentage')} />
                </div>
                <div className="form-group">
                  <label className="label">Retention % (0 = none)</label>
                  <input className="input" type="number" step="0.01" placeholder="5" {...register('retention_percentage')} />
                </div>
                <div className="form-group">
                  <label className="label">Start Date</label>
                  <input className="input" type="date" {...register('start_date')} />
                </div>
                <div className="form-group">
                  <label className="label">End Date</label>
                  <input className="input" type="date" {...register('end_date')} />
                </div>
                <div className="sm:col-span-2 form-group">
                  <label className="label">Description</label>
                  <textarea className="input" rows={2} placeholder="Project description..." {...register('description')} />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" className="btn-secondary flex-1" onClick={() => { setShowModal(false); reset(); }}>Cancel</button>
                <button type="submit" disabled={isSubmitting} className="btn-primary flex-1 justify-center">
                  {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : null} Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
