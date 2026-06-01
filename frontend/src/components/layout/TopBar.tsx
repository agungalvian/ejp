import { useState, useEffect } from 'react';
import { Bell, LogOut, Search, Sun, Moon } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../../api/axios';

const routeTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/projects': 'Proyek & RAB',
  '/invoices': 'Faktur & Tagihan',
  '/equipment': 'Alat Berat',
  '/inventory': 'Persediaan & Gudang',
  '/employees': 'Data Karyawan',
  '/timesheets': 'Absensi & Timesheet',
  '/payroll': 'Penggajian & Payroll',
  '/ledger': 'Buku Besar',
  '/accounts': 'Bagan Akun (CoA)',
};

export default function TopBar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Initialize theme from localStorage, default to light mode (isLightMode = true)
  const [isLightMode, setIsLightMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved === null) return true; // Default to light mode
    return saved === 'light';
  });

  useEffect(() => {
    if (isLightMode) {
      document.documentElement.classList.add('light');
      localStorage.setItem('theme', 'light');
    } else {
      document.documentElement.classList.remove('light');
      localStorage.setItem('theme', 'dark');
    }
  }, [isLightMode]);

  const toggleTheme = () => {
    setIsLightMode(!isLightMode);
  };

  const title = Object.entries(routeTitles).find(([key]) =>
    key === '/' ? pathname === '/' : pathname.startsWith(key)
  )?.[1] ?? 'ERP';

  const handleLogout = async () => {
    await api.post('/auth/logout').catch(() => {});
    logout();
    navigate('/login');
  };

  return (
    <header className="flex items-center justify-between px-4 md:px-6 py-3 bg-surface-50 border-b border-surface-300 flex-shrink-0">
      {/* Title */}
      <div>
        <h1 className="text-base font-semibold text-white">{title}</h1>
        <p className="text-xs text-slate-500 hidden md:block">
          {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button className="btn-icon hidden md:flex">
          <Search size={16} />
        </button>
        <button onClick={toggleTheme} className="btn-icon text-slate-400 hover:text-white" title={isLightMode ? "Mode Gelap" : "Mode Terang"}>
          {isLightMode ? <Moon size={16} /> : <Sun size={16} />}
        </button>
        <button className="btn-icon relative">
          <Bell size={16} />
          <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-brand-500 rounded-full" />
        </button>
        <button
          onClick={handleLogout}
          className="btn-icon text-slate-400 hover:text-red-400"
          title="Logout"
        >
          <LogOut size={16} />
        </button>

        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-brand-gradient flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ml-1">
          {user?.name?.charAt(0).toUpperCase()}
        </div>
      </div>
    </header>
  );
}
