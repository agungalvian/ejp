import { NavLink } from 'react-router-dom';
import { LayoutDashboard, FolderOpen, Package, Clock, DollarSign } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

const mobileNavItems = [
  { to: '/', label: 'Beranda', icon: LayoutDashboard },
  { to: '/projects', label: 'Proyek', icon: FolderOpen },
  { to: '/inventory', label: 'Stok', icon: Package },
  { to: '/timesheets', label: 'Timesheet', icon: Clock },
  { to: '/payroll', label: 'Payroll', icon: DollarSign, roles: ['Admin', 'Staf_Keuangan'] },
];

export default function MobileNav() {
  const { user } = useAuthStore();

  const visible = mobileNavItems.filter((item) => {
    if (!('roles' in item)) return true;
    return user && (item.roles as string[]).includes(user.role);
  });

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface-50 border-t border-surface-300 z-50 safe-area-inset-bottom">
      <div className="flex items-center justify-around px-2 py-1">
        {visible.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => `mobile-nav-btn ${isActive ? 'active' : ''}`}
          >
            <item.icon size={20} />
            <span className="text-[10px] font-medium">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
