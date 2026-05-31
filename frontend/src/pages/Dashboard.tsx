import { useQuery } from '@tanstack/react-query';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  FolderOpen, FileText, Package, Users, TrendingUp, TrendingDown,
  AlertTriangle, CheckCircle, Clock, Truck,
} from 'lucide-react';
import api from '../api/axios';
import { useAuthStore } from '../store/authStore';

const formatIDR = (val: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);

// Placeholder chart data (scaled to match billions contract value)
const revenueData = [
  { month: 'Jan', revenue: 1800000000, expense: 1100000000 },
  { month: 'Feb', revenue: 2200000000, expense: 1400000000 },
  { month: 'Mar', revenue: 2500000000, expense: 1600000000 },
  { month: 'Apr', revenue: 2100000000, expense: 1300000000 },
  { month: 'May', revenue: 3800000000, expense: 2400000000 },
  { month: 'Jun', revenue: 6000000000, expense: 3700000000 },
];

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  trend?: 'up' | 'down' | 'neutral';
  color?: string;
}

function StatCard({ label, value, sub, icon: Icon, trend, color = '#3b82f6' }: StatCardProps) {
  return (
    <div className="stat-card" style={{ '--accent-color': color } as any}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold text-white mt-1">{value}</p>
          {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
        </div>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${color}20`, border: `1px solid ${color}30` }}>
          <Icon size={18} style={{ color }} />
        </div>
      </div>
      {trend && (
        <div className={`flex items-center gap-1 text-xs font-medium ${trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : 'text-slate-400'}`}>
          {trend === 'up' ? <TrendingUp size={12} /> : trend === 'down' ? <TrendingDown size={12} /> : null}
          <span>{trend === 'up' ? '+12% dari bulan lalu' : trend === 'down' ? '-5% dari bulan lalu' : 'Tidak ada perubahan'}</span>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuthStore();

  const { data: projects } = useQuery({
    queryKey: ['projects-summary'],
    queryFn: () => api.get('/projects').then((r) => r.data.data),
  });

  const { data: invoices } = useQuery({
    queryKey: ['invoices-summary'],
    queryFn: () => api.get('/invoices').then((r) => r.data.data),
    enabled: user?.role !== 'Lapangan',
  });

  const { data: equipment } = useQuery({
    queryKey: ['equipment-summary'],
    queryFn: () => api.get('/equipment').then((r) => r.data.data),
  });

  const currentYear = new Date().getFullYear();

  const activeProjects = projects?.filter((p: any) => p.status === 'Active').length ?? 0;
  
  // Total running projects this year
  const runningProjectsThisYear = projects?.filter((p: any) => {
    const startYear = p.start_date ? new Date(p.start_date).getFullYear() : null;
    const endYear = p.end_date ? new Date(p.end_date).getFullYear() : null;
    const isRunning = p.status === 'Active' || p.status === 'Completed' || p.status === 'On_Hold';
    const isThisYear = startYear === currentYear || endYear === currentYear || 
      (p.start_date && new Date(p.start_date).getFullYear() <= currentYear && (!p.end_date || new Date(p.end_date).getFullYear() >= currentYear));
    return isRunning && isThisYear;
  }).length ?? 0;

  const pendingInvoices = invoices?.filter((inv: any) => inv.status === 'Sent').length ?? 0;
  const availableEquipment = equipment?.filter((eq: any) => eq.status === 'Available').length ?? 0;

  // YTD Estimated Revenue: Sum of contract values of all active projects
  const estimatedRevenue = projects?.filter((p: any) => p.status === 'Active')
    .reduce((s: number, p: any) => s + Number(p.contract_value), 0) ?? 0;

  const hour = new Date().getHours();
  const greeting = hour < 11 ? 'Pagi' : hour < 15 ? 'Siang' : hour < 19 ? 'Sore' : 'Malam';

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">
            Selamat {greeting},{' '}
            <span className="text-gradient">{user?.name?.split(' ')[0]}</span> 👋
          </h2>
          <p className="text-slate-400 text-sm mt-0.5">Berikut ringkasan aktivitas proyek Anda hari ini.</p>
        </div>
      </div>

      {/* Top Single Card - YTD Revenue */}
      <div className="stat-card p-6" style={{ '--accent-color': '#a855f7' } as any}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Estimasi Pendapatan (YTD)</p>
            <p className="text-3xl md:text-4xl font-extrabold text-brand-400 mt-2 font-mono">
              {formatIDR(estimatedRevenue)}
            </p>
            <p className="text-xs text-slate-500 mt-1.5">Total nilai kontrak dari seluruh proyek aktif yang sedang berjalan</p>
          </div>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: '#a855f720', border: '1px solid #a855f730' }}>
            <TrendingUp size={24} style={{ color: '#a855f7' }} />
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Proyek Aktif"
          value={activeProjects}
          sub={`${projects?.length ?? 0} total proyek`}
          icon={FolderOpen}
          trend="up"
          color="#3b82f6"
        />
        <StatCard
          label="Proyek Tahun Ini"
          value={runningProjectsThisYear}
          sub={`Berjalan di ${currentYear}`}
          icon={Clock}
          trend="up"
          color="#06b6d4"
        />
        <StatCard
          label="Faktur Tertunda"
          value={pendingInvoices}
          sub="Menunggu pembayaran"
          icon={FileText}
          trend={pendingInvoices > 5 ? 'down' : 'up'}
          color="#f59e0b"
        />
        <StatCard
          label="Alat Berat Tersedia"
          value={availableEquipment}
          sub={`${equipment?.length ?? 0} total unit`}
          icon={Truck}
          trend="neutral"
          color="#22c55e"
        />
      </div>

      {/* Chart + Recent */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue Chart */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white">Pendapatan vs Beban</h3>
              <p className="text-xs text-slate-500">6 Bulan Terakhir (IDR)</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={revenueData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2d3347" />
              <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false}
                tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}Jt`} />
              <Tooltip
                contentStyle={{ background: '#1e2130', border: '1px solid #2d3347', borderRadius: 8, fontSize: 12 }}
                formatter={(v: number) => [formatIDR(v), '']}
              />
              <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} fill="url(#revGrad)" name="Pendapatan" />
              <Area type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={2} fill="url(#expGrad)" name="Beban" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Recent Projects */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Proyek Aktif</h3>
          <div className="space-y-3">
            {(projects?.filter((p: any) => p.status === 'Active') ?? []).slice(0, 5).map((p: any) => (
              <div key={p.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-surface-200 hover:bg-surface-300 transition-colors cursor-pointer">
                <div className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white truncate">{p.name}</p>
                  <p className="text-xs text-slate-500">{p.project_code}</p>
                </div>
                <CheckCircle size={12} className="text-green-400 flex-shrink-0" />
              </div>
            ))}
            {activeProjects === 0 && (
              <p className="text-xs text-slate-500 text-center py-4">Tidak ada proyek aktif</p>
            )}
          </div>
        </div>
      </div>

      {/* Alert banners */}
      {pendingInvoices > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 animate-slide-up">
          <AlertTriangle size={16} className="text-amber-400 flex-shrink-0" />
          <p className="text-sm text-amber-300">
            <span className="font-semibold">{pendingInvoices} faktur</span> menunggu pembayaran — tinjau di modul Faktur & Tagihan.
          </p>
        </div>
      )}
    </div>
  );
}
