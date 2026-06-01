import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import Layout from './components/layout/Layout';
import LoginPage from './pages/auth/Login';
import Dashboard from './pages/Dashboard';
import ProjectsPage from './pages/projects/ProjectList';
import ProjectDetail from './pages/projects/ProjectDetail';
import InvoicesPage from './pages/invoices/InvoiceList';
import EquipmentPage from './pages/equipment/EquipmentList';
import InventoryPage from './pages/inventory/MaterialList';
import TimesheetsPage from './pages/payroll/Timesheets';
import PayrollPage from './pages/payroll/PayrollPeriod';
import EmployeeListPage from './pages/payroll/EmployeeList';
import LedgerPage from './pages/ledger/GeneralLedger';
import ChartOfAccountsPage from './pages/ledger/ChartOfAccounts';
import UserManagementPage from './pages/users/UserManagement';
import ContactListPage from './pages/contacts/ContactList';
import ContractListPage from './pages/contracts/ContractList';

function RequireAuth({
  children,
  roles,
  permission,
  mode = 'read',
}: {
  children: React.ReactNode;
  roles?: string[];
  permission?: string;
  mode?: 'read' | 'write';
}) {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (user) {
    // Admin always gets access
    if (user.role === 'Admin') return <>{children}</>;

    // 1. Dynamic permission check
    if (permission) {
      const permissions = user.permissions || {};
      const userAccess = permissions[permission] || 'none';

      if (userAccess === 'none') return <Navigate to="/" replace />;
      if (mode === 'write' && userAccess !== 'write') return <Navigate to="/" replace />;
      return <>{children}</>;
    }

    // 2. Legacy role check fallback
    if (roles && !roles.includes(user.role)) {
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/"
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="projects/:id" element={<ProjectDetail />} />
          <Route path="contracts" element={<ContractListPage />} />
          <Route path="contacts" element={<ContactListPage />} />
          <Route
            path="invoices"
            element={
              <RequireAuth roles={['Admin', 'Staf_Keuangan', 'Manajer_Proyek']}>
                <InvoicesPage />
              </RequireAuth>
            }
          />
          <Route path="equipment" element={<EquipmentPage />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="timesheets" element={<TimesheetsPage />} />
          <Route
            path="employees"
            element={
              <RequireAuth roles={['Admin', 'Staf_Keuangan']}>
                <EmployeeListPage />
              </RequireAuth>
            }
          />
          <Route
            path="users"
            element={
              <RequireAuth permission="users" mode="write">
                <UserManagementPage />
              </RequireAuth>
            }
          />
          <Route
            path="payroll"
            element={
              <RequireAuth roles={['Admin', 'Staf_Keuangan']}>
                <PayrollPage />
              </RequireAuth>
            }
          />
          <Route
            path="ledger"
            element={
              <RequireAuth roles={['Admin', 'Staf_Keuangan']}>
                <LedgerPage />
              </RequireAuth>
            }
          />
          <Route
            path="accounts"
            element={
              <RequireAuth roles={['Admin', 'Staf_Keuangan']}>
                <ChartOfAccountsPage />
              </RequireAuth>
            }
          />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
