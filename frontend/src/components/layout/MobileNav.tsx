import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, FolderOpen, FileText, Truck, Package,
  Clock, DollarSign, BookOpen, Users, Layers, Shield, Contact, FileCheck
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

const mobileNavItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/projects', label: 'Proyek', icon: FolderOpen },
  { to: '/contracts', label: 'Kontrak', icon: FileCheck },
  { to: '/contacts', label: 'Client/Vendor', icon: Contact },
  { to: '/invoices', label: 'Invoices', icon: FileText, roles: ['Admin', 'Staf_Keuangan', 'Manajer_Proyek'] },
  { to: '/equipment', label: 'Alat Berat', icon: Truck },
  { to: '/inventory', label: 'Gudang', icon: Package },
  { to: '/employees', label: 'Karyawan', icon: Users, roles: ['Admin', 'Staf_Keuangan'] },
  { to: '/timesheets', label: 'Timesheet', icon: Clock },
  { to: '/payroll', label: 'Payroll', icon: DollarSign, roles: ['Admin', 'Staf_Keuangan'] },
  { to: '/ledger', label: 'Ledger', icon: BookOpen, roles: ['Admin', 'Staf_Keuangan'] },
  { to: '/accounts', label: 'CoA', icon: Layers, roles: ['Admin', 'Staf_Keuangan'] },
  { to: '/users', label: 'Akses', icon: Shield, roles: ['Admin'] },
];

export default function MobileNav() {
  const { user } = useAuthStore();

  const visible = mobileNavItems.filter((item) => {
    if (!('roles' in item)) return true;
    return user && (item.roles as string[]).includes(user.role);
  });

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface-50 border-t border-surface-300 z-50 safe-area-inset-bottom">
      <div className="flex items-center overflow-x-auto gap-1 px-3 py-1 scrollbar-none scroll-smooth">
        {visible.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => 
              `mobile-nav-btn flex-shrink-0 min-w-[72px] text-center ${isActive ? 'active' : ''}`
            }
          >
            <item.icon size={18} className="mx-auto" />
            <span className="text-[10px] font-medium tracking-tight truncate w-full block mt-0.5">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
