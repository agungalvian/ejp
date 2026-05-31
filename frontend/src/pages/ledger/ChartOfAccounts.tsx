import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Plus, ChevronRight, ChevronDown, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import api from '../../api/axios';

const typeColors: Record<string, string> = {
  Asset: 'badge-blue', Liability: 'badge-amber', Equity: 'badge-purple',
  Revenue: 'badge-green', Expense: 'badge-red',
};

export default function ChartOfAccountsPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data: accounts, isLoading } = useQuery({
    queryKey: ['accounts-full'],
    queryFn: () => api.get('/ledger/accounts').then((r) => r.data.data),
  });

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm();

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/ledger/accounts', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['accounts-full'] }); toast.success('Account created!'); setShowModal(false); reset(); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed'),
  });

  // Root accounts (no parent)
  const roots = accounts?.filter((a: any) => !a.parent_id) ?? [];

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const AccountRow = ({ account, level = 0 }: { account: any; level?: number }) => {
    const hasChildren = account.children?.length > 0;
    const isOpen = expanded.has(account.id);

    return (
      <>
        <tr
          className={`cursor-pointer ${level === 0 ? 'bg-surface-200/30' : ''}`}
          onClick={() => hasChildren && toggleExpand(account.id)}
        >
          <td style={{ paddingLeft: `${16 + level * 20}px` }}>
            <div className="flex items-center gap-2">
              {hasChildren ? (
                isOpen ? <ChevronDown size={12} className="text-slate-400 flex-shrink-0" /> : <ChevronRight size={12} className="text-slate-400 flex-shrink-0" />
              ) : <span className="w-3" />}
              <span className={`font-mono text-xs ${level === 0 ? 'text-brand-400 font-bold' : 'text-slate-400'}`}>{account.code}</span>
            </div>
          </td>
          <td className={`${level === 0 ? 'text-white font-semibold' : 'text-slate-300'}`}>{account.name}</td>
          <td><span className={typeColors[account.type] ?? 'badge-slate'}>{account.type}</span></td>
          <td>
            <span className={`badge ${account.is_active ? 'badge-green' : 'badge-red'}`}>
              {account.is_active ? 'Active' : 'Inactive'}
            </span>
          </td>
        </tr>
        {isOpen && account.children?.map((child: any) => (
          <AccountRow key={child.id} account={child} level={level + 1} />
        ))}
      </>
    );
  };

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h2 className="page-title">Chart of Accounts</h2>
          <p className="page-subtitle">Double-entry accounting structure</p>
        </div>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={16} /> New Account
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-brand-400" /></div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead><tr><th>Code</th><th>Account Name</th><th>Type</th><th>Status</th></tr></thead>
            <tbody>
              {roots.map((acc: any) => <AccountRow key={acc.id} account={acc} />)}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="card w-full max-w-md p-6 animate-slide-up">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <BookOpen size={18} className="text-brand-400" /> New Account
            </h3>
            <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="label">Account Code *</label>
                  <input className="input font-mono" placeholder="1-1300" {...register('code', { required: true })} />
                </div>
                <div className="form-group">
                  <label className="label">Type *</label>
                  <select className="select" {...register('type', { required: true })}>
                    {['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'].map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2 form-group">
                  <label className="label">Account Name *</label>
                  <input className="input" placeholder="Petty Cash" {...register('name', { required: true })} />
                </div>
                <div className="col-span-2 form-group">
                  <label className="label">Parent Account (optional)</label>
                  <select className="select" {...register('parent_id')}>
                    <option value="">No parent (root)</option>
                    {accounts?.map((a: any) => (
                      <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-3">
                <button type="button" className="btn-secondary flex-1" onClick={() => { setShowModal(false); reset(); }}>Cancel</button>
                <button type="submit" disabled={isSubmitting} className="btn-primary flex-1 justify-center">
                  {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : null} Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
