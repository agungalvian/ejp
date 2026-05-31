import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, FolderOpen, FileText, Truck, Package,
  Clock, DollarSign, BookOpen, Users, ChevronRight, Layers, Shield, Contact,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { to: '/projects', label: 'Proyek & RAB', icon: FolderOpen },
  { to: '/contacts', label: 'Data Client & Vendor', icon: Contact },
  { to: '/invoices', label: 'Faktur & Tagihan', icon: FileText, roles: ['Admin', 'Staf_Keuangan', 'Manajer_Proyek'] },
  { to: '/equipment', label: 'Alat Berat', icon: Truck },
  { to: '/inventory', label: 'Persediaan & Gudang', icon: Package },
  { to: '/employees', label: 'Data Karyawan', icon: Users, roles: ['Admin', 'Staf_Keuangan'] },
  { to: '/timesheets', label: 'Absensi & Timesheet', icon: Clock },
  { to: '/payroll', label: 'Penggajian & Payroll', icon: DollarSign, roles: ['Admin', 'Staf_Keuangan'] },
  { to: '/ledger', label: 'Buku Besar', icon: BookOpen, roles: ['Admin', 'Staf_Keuangan'] },
  { to: '/accounts', label: 'Bagan Akun (CoA)', icon: Layers, roles: ['Admin', 'Staf_Keuangan'] },
  { to: '/users', label: 'Manajemen Akses & User', icon: Shield, roles: ['Admin'] },
] as const;

export default function Sidebar() {
  const { user } = useAuthStore();

  const visible = navItems.filter((item) => {
    if (!('roles' in item)) return true;
    return user && (item.roles as readonly string[]).includes(user.role);
  });

  return (
    <div
      className="flex flex-col w-64 bg-surface-50 border-r border-surface-300"
      style={{ minHeight: '100vh' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-surface-300">
        <div className="w-9 h-9 rounded-lg bg-brand-gradient flex items-center justify-center shadow-glow-blue flex-shrink-0">
          <span className="text-white font-bold text-sm">EJP</span>
        </div>
        <div className="min-w-0">
          <p className="text-white font-bold text-sm leading-tight truncate">El Jaya Pondasi</p>
          <p className="text-slate-500 text-[10px] tracking-wider uppercase font-semibold">Sistem ERP</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider px-3 mb-2">
          Navigasi Menu
        </p>
        {visible.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
          >
            <item.icon size={16} />
            <span className="flex-1">{item.label}</span>
            <ChevronRight size={12} className="opacity-0 group-hover:opacity-100" />
          </NavLink>
        ))}
      </nav>

      {/* User pill */}
      <div className="px-3 py-4 border-t border-surface-300">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-surface-200">
          <div className="w-7 h-7 rounded-full bg-brand-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-medium truncate">{user?.name}</p>
            <p className="text-slate-500 text-xs truncate">{user?.role?.replace(/_/g, ' ')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
