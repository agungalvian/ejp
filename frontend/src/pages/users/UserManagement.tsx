import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users, Plus, Search, Edit2, Trash2, Key, CheckCircle, XCircle, Loader2, Shield, User, Mail, ShieldAlert
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import api from '../../api/axios';

interface UserForm {
  name: string;
  email: string;
  password?: string;
  role_id: string;
  employee_id?: string;
  is_active: boolean;
}

interface RoleForm {
  name: string;
  description: string;
}

const MENU_KEYS = [
  { key: 'dashboard', label: 'Dashboard Utama' },
  { key: 'projects', label: 'Proyek & RAB' },
  { key: 'invoices', label: 'Faktur & Tagihan' },
  { key: 'equipment', label: 'Armada Alat Berat' },
  { key: 'inventory', label: 'Persediaan & Gudang' },
  { key: 'employees', label: 'Data Karyawan' },
  { key: 'timesheets', label: 'Absensi & Timesheet' },
  { key: 'payroll', label: 'Penggajian (Payroll)' },
  { key: 'ledger', label: 'Buku Besar & Keuangan' },
  { key: 'accounts', label: 'Bagan Akun (CoA)' },
  { key: 'users', label: 'Manajemen Akses & User' },
];

type AccessLevel = 'none' | 'read' | 'write';

export default function UserManagement() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<'users' | 'roles'>('users');
  const [searchUser, setSearchUser] = useState('');
  
  // User Modal State
  const [showUserModal, setShowUserModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);

  // Role Modal State
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState<any | null>(null);
  const [rolePermissions, setRolePermissions] = useState<Record<string, AccessLevel>>({});

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then((r) => r.data.data),
  });

  const { data: roles, isLoading: rolesLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: () => api.get('/users/roles').then((r) => r.data.data),
  });

  const { data: unlinkedEmployees } = useQuery({
    queryKey: ['unlinked-employees', selectedUser?.id],
    queryFn: () =>
      api
        .get('/users/unlinked-employees', {
          params: { current_user_id: selectedUser?.id || undefined },
        })
        .then((r) => r.data.data),
    enabled: showUserModal,
  });

  // ── Forms ──────────────────────────────────────────────────────────────────
  const userForm = useForm<UserForm>();
  const roleForm = useForm<RoleForm>();

  // ── User Mutations ─────────────────────────────────────────────────────────
  const createUserMutation = useMutation({
    mutationFn: (data: UserForm) => api.post('/users', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('Pengguna baru berhasil dibuat!');
      closeUserModal();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Gagal membuat pengguna'),
  });

  const updateUserMutation = useMutation({
    mutationFn: (data: { id: string; body: Partial<UserForm> }) =>
      api.put(`/users/${data.id}`, data.body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('Informasi pengguna berhasil diperbarui!');
      closeUserModal();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Gagal memperbarui pengguna'),
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('Akun pengguna dinonaktifkan.');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Gagal menonaktifkan akun'),
  });

  // ── Role Mutations ─────────────────────────────────────────────────────────
  const createRoleMutation = useMutation({
    mutationFn: (data: { name: string; description: string; permissions: any }) =>
      api.post('/users/roles', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roles'] });
      toast.success('Role kustom berhasil dibuat!');
      closeRoleModal();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Gagal membuat role'),
  });

  const updateRoleMutation = useMutation({
    mutationFn: (data: { id: string; body: { name: string; description: string; permissions: any } }) =>
      api.put(`/users/roles/${data.id}`, data.body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roles'] });
      toast.success('Role kustom berhasil diperbarui!');
      closeRoleModal();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Gagal memperbarui role'),
  });

  const deleteRoleMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/users/roles/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roles'] });
      toast.success('Role berhasil dihapus.');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Gagal menghapus role'),
  });

  // ── User Modal Handlers ────────────────────────────────────────────────────
  const openAddUserModal = () => {
    setSelectedUser(null);
    userForm.reset({
      name: '',
      email: '',
      password: '',
      role_id: roles?.[0]?.id || '',
      employee_id: '',
      is_active: true,
    });
    setShowUserModal(true);
  };

  const openEditUserModal = (user: any) => {
    setSelectedUser(user);
    userForm.reset({
      name: user.name,
      email: user.email,
      password: '',
      role_id: user.role_id,
      employee_id: user.employee_id || '',
      is_active: user.is_active,
    });
    setShowUserModal(true);
  };

  const closeUserModal = () => {
    setShowUserModal(false);
    setSelectedUser(null);
    userForm.reset();
  };

  const handleUserSubmit = (data: UserForm) => {
    const body: any = { ...data };
    if (!body.password) delete body.password; // Don't send empty password

    if (selectedUser) {
      updateUserMutation.mutate({ id: selectedUser.id, body });
    } else {
      createUserMutation.mutate(body);
    }
  };

  // ── Role Modal Handlers ────────────────────────────────────────────────────
  const openAddRoleModal = () => {
    setSelectedRole(null);
    roleForm.reset({ name: '', description: '' });
    
    // Default: all none
    const initialPerms: Record<string, AccessLevel> = {};
    MENU_KEYS.forEach((m) => {
      initialPerms[m.key] = 'none';
    });
    setRolePermissions(initialPerms);
    setShowRoleModal(true);
  };

  const openEditRoleModal = (role: any) => {
    setSelectedRole(role);
    roleForm.reset({ name: role.name, description: role.description || '' });

    const initialPerms: Record<string, AccessLevel> = {};
    MENU_KEYS.forEach((m) => {
      initialPerms[m.key] = role.permissions?.[m.key] || 'none';
    });
    setRolePermissions(initialPerms);
    setShowRoleModal(true);
  };

  const closeRoleModal = () => {
    setShowRoleModal(false);
    setSelectedRole(null);
    roleForm.reset();
  };

  const handleRolePermissionChange = (menuKey: string, level: AccessLevel) => {
    setRolePermissions((prev) => ({
      ...prev,
      [menuKey]: level,
    }));
  };

  const handleRoleSubmit = (data: RoleForm) => {
    const body = {
      name: data.name,
      description: data.description,
      permissions: rolePermissions,
    };

    if (selectedRole) {
      updateRoleMutation.mutate({ id: selectedRole.id, body });
    } else {
      createRoleMutation.mutate(body);
    }
  };

  // Filtered users
  const filteredUsers = users?.filter(
    (u: any) =>
      u.name.toLowerCase().includes(searchUser.toLowerCase()) ||
      u.email.toLowerCase().includes(searchUser.toLowerCase())
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Manajemen Akses & Karyawan</h2>
          <p className="page-subtitle">Kelola otorisasi akun pengguna, role kustom, dan pembatasan menu</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-surface-300 gap-2">
        <button
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'users'
              ? 'border-brand-500 text-white bg-brand-600/10'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
          onClick={() => setActiveTab('users')}
        >
          <User size={14} className="inline mr-1.5" /> Akun Pengguna
        </button>
        <button
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'roles'
              ? 'border-brand-500 text-white bg-brand-600/10'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
          onClick={() => setActiveTab('roles')}
        >
          <Shield size={14} className="inline mr-1.5" /> Role & Hak Akses
        </button>
      </div>

      {/* TAB 1: USERS */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="input pl-9"
                placeholder="Cari user berdasarkan nama atau email..."
                value={searchUser}
                onChange={(e) => setSearchUser(e.target.value)}
              />
            </div>
            <button className="btn-primary flex-shrink-0" onClick={openAddUserModal}>
              <Plus size={16} /> Buat User
            </button>
          </div>

          {usersLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 size={24} className="animate-spin text-brand-400" />
            </div>
          ) : (
            <div className="table-container card">
              <table className="table">
                <thead>
                  <tr>
                    <th>Nama User</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Korelasi Karyawan</th>
                    <th>Status</th>
                    <th className="text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers?.map((u: any) => (
                    <tr key={u.id} className="hover:bg-surface-200/50">
                      <td className="font-semibold text-white">{u.name}</td>
                      <td className="text-slate-300 font-mono text-xs">{u.email}</td>
                      <td>
                        <span className="badge badge-blue">
                          {u.role?.name || '—'}
                        </span>
                      </td>
                      <td>
                        {u.employee ? (
                          <div className="text-xs">
                            <span className="text-slate-300 font-medium">{u.employee.name}</span>
                            <span className="text-slate-500 font-mono block">({u.employee.employee_id})</span>
                          </div>
                        ) : (
                          <span className="text-slate-500 text-xs italic">Belum dikaitkan</span>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${u.is_active ? 'badge-green' : 'badge-red'}`}>
                          {u.is_active ? 'Aktif' : 'Non-aktif'}
                        </span>
                      </td>
                      <td className="text-center">
                        <div className="inline-flex gap-2">
                          <button className="btn-icon" onClick={() => openEditUserModal(u)} title="Ubah User">
                            <Edit2 size={14} />
                          </button>
                          {u.email !== 'admin@erp.local' && u.is_active && (
                            <button
                              className="btn-icon text-red-400 hover:text-red-300"
                              onClick={() => deleteUserMutation.mutate(u.id)}
                              title="Nonaktifkan User"
                            >
                              <XCircle size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!filteredUsers?.length && (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-slate-500">
                        Tidak ada user ditemukan.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ROLES */}
      {activeTab === 'roles' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button className="btn-primary animate-fade-in" onClick={openAddRoleModal}>
              <Plus size={16} /> Tambah Role Kustom
            </button>
          </div>

          {rolesLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 size={24} className="animate-spin text-brand-400" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {roles?.map((r: any) => {
                const systemRoles = ['Admin', 'Manajer_Proyek', 'Staf_Keuangan', 'Lapangan'];
                const isSystem = systemRoles.includes(r.name);
                
                return (
                  <div key={r.id} className="card p-5 flex flex-col justify-between border-surface-300 hover:border-brand-600/40 transition-colors">
                    <div>
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-bold text-white text-base">{r.name.replace(/_/g, ' ')}</h4>
                        <span className={`badge ${isSystem ? 'badge-slate' : 'badge-blue'} text-[10px]`}>
                          {isSystem ? 'Sistem' : 'Kustom'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mb-4">{r.description || 'Tidak ada deskripsi.'}</p>
                      
                      {/* Quick permissions preview */}
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {Object.entries(r.permissions || {}).map(([menu, level]: any) => {
                          if (level === 'none') return null;
                          return (
                            <span key={menu} className={`text-[10px] px-2 py-0.5 rounded font-mono ${level === 'write' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'}`}>
                              {menu}: {level}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-3 border-t border-surface-300">
                      <button className="btn-secondary py-1.5 px-3 text-xs" onClick={() => openEditRoleModal(r)}>
                        <Edit2 size={12} /> Hak Akses
                      </button>
                      {!isSystem && (
                        <button
                          className="btn-danger py-1.5 px-3 text-xs"
                          onClick={() => {
                            if (window.confirm(`Hapus role ${r.name}?`)) {
                              deleteRoleMutation.mutate(r.id);
                            }
                          }}
                        >
                          <Trash2 size={12} /> Hapus
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* USER DIALOG MODAL */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="card w-full max-w-md p-6 animate-slide-up">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2 border-b border-surface-300 pb-2">
              <User size={18} className="text-brand-400" />
              {selectedUser ? 'Ubah Akun User' : 'Buat User Baru'}
            </h3>
            <form onSubmit={userForm.handleSubmit(handleUserSubmit)} className="space-y-4">
              <div className="form-group">
                <label className="label">Nama Lengkap *</label>
                <input
                  className="input"
                  placeholder="Contoh: John Doe"
                  {...userForm.register('name', { required: 'Nama wajib diisi' })}
                />
                {userForm.formState.errors.name && <p className="text-red-400 text-xs mt-1">{userForm.formState.errors.name.message}</p>}
              </div>

              <div className="form-group">
                <label className="label">Alamat Email *</label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="email"
                    className="input pl-9"
                    placeholder="john@example.com"
                    {...userForm.register('email', { required: 'Email wajib diisi' })}
                  />
                </div>
                {userForm.formState.errors.email && <p className="text-red-400 text-xs mt-1">{userForm.formState.errors.email.message}</p>}
              </div>

              <div className="form-group">
                <label className="label">Password {selectedUser && '(Opsional, isi jika ingin ubah)'} *</label>
                <div className="relative">
                  <Key size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="password"
                    className="input pl-9"
                    placeholder="••••••••"
                    {...userForm.register('password', { required: selectedUser ? false : 'Password wajib diisi' })}
                  />
                </div>
                {userForm.formState.errors.password && <p className="text-red-400 text-xs mt-1">{userForm.formState.errors.password.message}</p>}
              </div>

              <div className="form-group">
                <label className="label">Role Otorisasi *</label>
                <select className="select" {...userForm.register('role_id', { required: true })}>
                  {roles?.map((r: any) => (
                    <option key={r.id} value={r.id}>
                      {r.name.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="label">Kaitkan dengan Karyawan (Opsional)</label>
                <select className="select" {...userForm.register('employee_id')}>
                  <option value="">-- Pilih Karyawan --</option>
                  {unlinkedEmployees?.map((emp: any) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.employee_id})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500 mt-1">
                  Menghubungkan akun login dengan profil data karyawan untuk logging Timesheet &amp; Payroll.
                </p>
              </div>

              {selectedUser && selectedUser.email !== 'admin@erp.local' && (
                <div className="flex items-center gap-2 py-1">
                  <input
                    type="checkbox"
                    id="is_active"
                    className="rounded bg-surface-200 border-surface-300 focus:ring-brand-500 text-brand-600"
                    {...userForm.register('is_active')}
                  />
                  <label htmlFor="is_active" className="text-sm text-slate-300 cursor-pointer">
                    Akun Aktif
                  </label>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-surface-300">
                <button type="button" className="btn-secondary flex-1" onClick={closeUserModal}>
                  Batal
                </button>
                <button type="submit" disabled={userForm.formState.isSubmitting} className="btn-primary flex-1 justify-center">
                  {userForm.formState.isSubmitting ? <Loader2 size={14} className="animate-spin" /> : null}
                  {selectedUser ? 'Simpan Perubahan' : 'Buat User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ROLE & PERMISSION MATRIX MODAL */}
      {showRoleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="card w-full max-w-2xl p-6 animate-slide-up max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2 border-b border-surface-300 pb-2">
              <Shield size={18} className="text-brand-400" />
              {selectedRole ? 'Konfigurasi Hak Akses Role' : 'Tambah Role Kustom'}
            </h3>
            <form onSubmit={roleForm.handleSubmit(handleRoleSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="label">Nama Role Kustom *</label>
                  <input
                    className="input"
                    placeholder="Contoh: Manager Gudang"
                    disabled={selectedRole?.name === 'Admin' || selectedRole?.name === 'Manajer_Proyek' || selectedRole?.name === 'Staf_Keuangan' || selectedRole?.name === 'Lapangan'}
                    {...roleForm.register('name', { required: 'Nama role wajib diisi' })}
                  />
                  {roleForm.formState.errors.name && <p className="text-red-400 text-xs mt-1">{roleForm.formState.errors.name.message}</p>}
                </div>

                <div className="form-group">
                  <label className="label">Deskripsi</label>
                  <input
                    className="input"
                    placeholder="Contoh: Mengelola stok persediaan material"
                    {...roleForm.register('description')}
                  />
                </div>
              </div>

              {/* Matrix Table */}
              <div className="form-group">
                <label className="label mb-2 flex items-center gap-1.5 text-slate-300">
                  <ShieldAlert size={14} className="text-brand-400" /> Atur Tingkat Izin Akses per Modul Menu
                </label>
                
                {selectedRole?.name === 'Admin' ? (
                  <div className="p-3 rounded-lg bg-brand-500/10 border border-brand-500/20 text-xs text-brand-300">
                    Role Admin memiliki hak akses penuh terhadap semua menu dan tidak dapat dimodifikasi demi keamanan sistem.
                  </div>
                ) : (
                  <div className="table-container border border-surface-300 max-h-60 overflow-y-auto">
                    <table className="table w-full text-xs">
                      <thead>
                        <tr className="bg-surface-200">
                          <th className="py-2">Modul / Menu</th>
                          <th className="py-2 text-center w-24">Tidak Ada</th>
                          <th className="py-2 text-center w-24">Baca Saja</th>
                          <th className="py-2 text-center w-28">Baca &amp; Tulis</th>
                        </tr>
                      </thead>
                      <tbody>
                        {MENU_KEYS.map((menu) => {
                          const currentVal = rolePermissions[menu.key] || 'none';
                          return (
                            <tr key={menu.key} className="hover:bg-surface-200/40">
                              <td className="font-medium text-white py-2">{menu.label}</td>
                              <td className="text-center py-2">
                                <input
                                  type="radio"
                                  name={`perm_${menu.key}`}
                                  checked={currentVal === 'none'}
                                  onChange={() => handleRolePermissionChange(menu.key, 'none')}
                                  className="focus:ring-brand-500 h-3.5 w-3.5 text-brand-600 bg-surface-200 border-surface-300"
                                />
                              </td>
                              <td className="text-center py-2">
                                <input
                                  type="radio"
                                  name={`perm_${menu.key}`}
                                  checked={currentVal === 'read'}
                                  onChange={() => handleRolePermissionChange(menu.key, 'read')}
                                  className="focus:ring-brand-500 h-3.5 w-3.5 text-brand-600 bg-surface-200 border-surface-300"
                                />
                              </td>
                              <td className="text-center py-2">
                                <input
                                  type="radio"
                                  name={`perm_${menu.key}`}
                                  checked={currentVal === 'write'}
                                  onChange={() => handleRolePermissionChange(menu.key, 'write')}
                                  className="focus:ring-brand-500 h-3.5 w-3.5 text-brand-600 bg-surface-200 border-surface-300"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4 border-t border-surface-300">
                <button type="button" className="btn-secondary flex-1" onClick={closeRoleModal}>
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={createRoleMutation.isPending || updateRoleMutation.isPending}
                  className="btn-primary flex-1 justify-center"
                >
                  {(createRoleMutation.isPending || updateRoleMutation.isPending) ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : null}
                  Simpan Hak Akses
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
