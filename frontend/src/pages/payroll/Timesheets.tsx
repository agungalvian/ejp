import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Clock, Plus, Camera, CheckCircle, Loader2, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import api from '../../api/axios';
import { useAuthStore } from '../../store/authStore';

interface TimesheetForm {
  employee_id: string;
  date: string;
  check_in: string;
  check_out: string;
  notes: string;
  evidence: FileList;
}

const formatTime = (dt: string | null) => dt ? new Date(dt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '—';

export default function TimesheetsPage() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const [showModal, setShowModal] = useState(false);
  const today = new Date().toISOString().split('T')[0];

  const { data: employees } = useQuery({
    queryKey: ['employees'],
    queryFn: () => api.get('/payroll/employees').then((r) => r.data.data),
    enabled: user?.role !== 'Lapangan',
  });

  const { data: timesheets, isLoading } = useQuery({
    queryKey: ['timesheets'],
    queryFn: () => api.get('/payroll/timesheets', { params: { from_date: today, to_date: today } }).then((r) => r.data.data),
  });

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<TimesheetForm>({
    defaultValues: { date: today } as TimesheetForm,
  });

  const createMutation = useMutation({
    mutationFn: (fd: FormData) => api.post('/payroll/timesheets', fd),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['timesheets'] });
      toast.success('Timesheet submitted!');
      setShowModal(false);
      reset({ date: today });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed'),
  });

  const onSubmit = (data: any) => {
    const fd = new FormData();
    Object.entries(data).forEach(([k, v]) => { if (v && k !== 'evidence') fd.append(k, String(v)); });
    if (data.evidence?.[0]) fd.append('evidence', data.evidence[0]);
    createMutation.mutate(fd);
  };

  const todaySheets = timesheets ?? [];
  const presentCount = todaySheets.filter((ts: any) => Number(ts.hours_worked) > 0).length;

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h2 className="page-title">Timesheets</h2>
          <p className="page-subtitle">{new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={16} /> Log Time
        </button>
      </div>

      {/* Today's summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[
          { label: 'Present Today', value: presentCount, color: '#22c55e' },
          { label: 'Total Records', value: todaySheets.length, color: '#3b82f6' },
          { label: 'Avg Hours', value: todaySheets.length ? `${(todaySheets.reduce((s: number, ts: any) => s + Number(ts.hours_worked), 0) / todaySheets.length).toFixed(1)}h` : '—', color: '#a855f7' },
        ].map((s) => (
          <div key={s.label} className="card p-4 text-center">
            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs text-slate-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Today's timesheets */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-brand-400" /></div>
      ) : (
        <div className="space-y-3">
          {todaySheets.map((ts: any) => (
            <div key={ts.id} className="card p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-brand-600/20 border border-brand-600/30 flex items-center justify-center flex-shrink-0">
                <User size={16} className="text-brand-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-white">{ts.employee?.name}</p>
                <p className="text-xs text-slate-400">{ts.employee?.employee_id} · {ts.project?.name ?? 'No Project'}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-mono text-white">{formatTime(ts.check_in)} → {formatTime(ts.check_out)}</p>
                <p className={`text-xs font-semibold ${Number(ts.hours_worked) >= 8 ? 'text-green-400' : 'text-amber-400'}`}>
                  {Number(ts.hours_worked).toFixed(1)}h
                </p>
              </div>
              {ts.evidence_photo_path && (
                <a href={ts.evidence_photo_path} target="_blank" rel="noopener noreferrer" className="btn-icon">
                  <Camera size={14} />
                </a>
              )}
            </div>
          ))}
          {!todaySheets.length && (
            <div className="card p-8 text-center">
              <Clock size={32} className="text-slate-600 mx-auto mb-2" />
              <p className="text-slate-400">No timesheets logged today</p>
              <button className="btn-primary mt-4 mx-auto" onClick={() => setShowModal(true)}>
                <Plus size={14} /> Log First Check-In
              </button>
            </div>
          )}
        </div>
      )}

      {/* Log Timesheet Modal — Mobile optimized with big touch targets */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="card w-full max-w-md p-6 animate-slide-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-2 mb-5">
              <Clock size={18} className="text-brand-400" />
              <h3 className="text-lg font-semibold text-white">Log Timesheet</h3>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Employee — only shown for non-Lapangan */}
              {user?.role !== 'Lapangan' && (
                <div className="form-group">
                  <label className="label"><User size={12} className="inline mr-1" />Employee *</label>
                  <select className="select" {...register('employee_id', { required: true })}>
                    <option value="">Select employee...</option>
                    {employees?.map((e: any) => <option key={e.id} value={e.id}>{e.name} ({e.employee_id})</option>)}
                  </select>
                </div>
              )}

              <div className="form-group">
                <label className="label">Date *</label>
                <input className="input" type="date" {...register('date', { required: true })} />
              </div>

              {/* Check In / Out — large on mobile */}
              <div className="grid grid-cols-2 gap-3">
                <div className="form-group">
                  <label className="label flex items-center gap-1">
                    <CheckCircle size={12} className="text-green-400" /> Check In
                  </label>
                  <input className="input text-lg py-3 font-mono text-center" type="time" {...register('check_in')} />
                </div>
                <div className="form-group">
                  <label className="label flex items-center gap-1">
                    <CheckCircle size={12} className="text-red-400" /> Check Out
                  </label>
                  <input className="input text-lg py-3 font-mono text-center" type="time" {...register('check_out')} />
                </div>
              </div>

              <div className="form-group">
                <label className="label">Notes</label>
                <input className="input" placeholder="Work description..." {...register('notes')} />
              </div>

              {/* Camera capture — key mobile feature */}
              <div className="form-group">
                <label className="label flex items-center gap-1.5">
                  <Camera size={13} className="text-brand-400" /> Take Photo (optional)
                </label>
                <label className="input flex items-center gap-3 cursor-pointer min-h-[60px] justify-center border-dashed border-2 hover:border-brand-500 transition-colors">
                  <Camera size={20} className="text-slate-400" />
                  <div className="text-center">
                    <p className="text-slate-400 text-sm">Tap to take photo</p>
                    <p className="text-slate-600 text-xs">or select from gallery</p>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    {...register('evidence')}
                  />
                </label>
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" className="btn-secondary flex-1 py-3" onClick={() => { setShowModal(false); reset({ date: today }); }}>
                  Cancel
                </button>
                <button type="submit" disabled={createMutation.isPending} className="btn-primary flex-1 justify-center py-3 text-base">
                  {createMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                  Submit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
