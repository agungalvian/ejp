import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Plus, Search, Edit2, ToggleLeft, ToggleRight, Loader2, Calendar, CreditCard, User, Briefcase, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import api from '../../api/axios';
import { useAuthStore } from '../../store/authStore';

interface EmployeeForm {
  name: string;
  type: 'Office_Staff' | 'Project_Worker' | 'Equipment_Operator';
  position: string;
  base_salary: number;
  bank_name: string;
  bank_account: string;
  join_date: string;
  is_active: boolean;
}

const formatIDR = (val: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
};

const typeLabels: Record<string, string> = {
  Office_Staff: 'Staf Kantor',
  Project_Worker: 'Pekerja Proyek',
  Equipment_Operator: 'Operator Alat',
};

const typeBadges: Record<string, string> = {
  Office_Staff: 'badge-blue',
  Project_Worker: 'badge-amber',
  Equipment_Operator: 'badge-purple',
};

export default function EmployeeList() {
  const qc = useQueryClient();
  const { user: currentUser } = useAuthStore();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);

  const isEditable = currentUser?.role === 'Admin' || currentUser?.role === 'Staf_Keuangan';

  const { data: employees, isLoading } = useQuery({
    queryKey: ['employees', search, typeFilter],
    queryFn: () =>
      api
        .get('/payroll/employees', {
          params: {
            search: search || undefined,
            type: typeFilter || undefined,
          },
        })
        .then((r) => r.data.data),
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<EmployeeForm>();

  const createMutation = useMutation({
    mutationFn: (data: EmployeeForm) => api.post('/payroll/employees', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] });
      toast.success('Karyawan berhasil ditambahkan!');
      closeModal();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Gagal menambahkan karyawan'),
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; body: Partial<EmployeeForm> }) =>
      api.put(`/payroll/employees/${data.id}`, data.body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] });
      toast.success('Data karyawan berhasil diubah!');
      closeModal();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Gagal mengubah data karyawan'),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: (data: { id: string; is_active: boolean }) =>
      api.put(`/payroll/employees/${data.id}`, { is_active: data.is_active }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] });
      toast.success('Status keaktifan karyawan diubah!');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Gagal mengubah status karyawan'),
  });

  const openAddModal = () => {
    setSelectedEmployee(null);
    reset({
      name: '',
      type: 'Office_Staff',
      position: '',
      base_salary: 0,
      bank_name: '',
      bank_account: '',
      join_date: new Date().toISOString().split('T')[0],
      is_active: true,
    });
    setShowModal(true);
  };

  const openEditModal = (emp: any) => {
    setSelectedEmployee(emp);
    reset({
      name: emp.name,
      type: emp.type,
      position: emp.position || '',
      base_salary: Number(emp.base_salary),
      bank_name: emp.bank_name || '',
      bank_account: emp.bank_account || '',
      join_date: emp.join_date ? new Date(emp.join_date).toISOString().split('T')[0] : '',
      is_active: emp.is_active,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedEmployee(null);
    reset();
  };

  const handleFormSubmit = (data: EmployeeForm) => {
    // Convert base_salary to number
    const formattedData = {
      ...data,
      base_salary: Number(data.base_salary),
    };

    if (selectedEmployee) {
      updateMutation.mutate({ id: selectedEmployee.id, body: formattedData });
    } else {
      createMutation.mutate(formattedData);
    }
  };

  // Stat summary calculations
  const totalCount = employees?.length ?? 0;
  const officeCount = employees?.filter((e: any) => e.type === 'Office_Staff').length ?? 0;
  const operatorCount = employees?.filter((e: any) => e.type === 'Equipment_Operator').length ?? 0;
  const workerCount = employees?.filter((e: any) => e.type === 'Project_Worker').length ?? 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Data Karyawan</h2>
          <p className="page-subtitle">Kelola informasi staff, operator alat berat, dan pekerja lapangan</p>
        </div>
        {isEditable && (
          <button className="btn-primary" onClick={openAddModal}>
            <Plus size={16} /> Tambah Karyawan
          </button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Karyawan', value: totalCount, color: '#3b82f6' },
          { label: 'Staf Kantor', value: officeCount, color: '#60a5fa' },
          { label: 'Operator Alat', value: operatorCount, color: '#a855f7' },
          { label: 'Pekerja Lapangan', value: workerCount, color: '#f59e0b' },
        ].map((s) => (
          <div key={s.label} className="card p-4 text-center">
            <p className="text-2xl font-bold" style={{ color: s.color }}>
              {s.value}
            </p>
            <p className="text-xs text-slate-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="Cari nama karyawan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="w-full sm:w-48">
          <select
            className="select"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">Semua Tipe Karyawan</option>
            <option value="Office_Staff">Staf Kantor</option>
            <option value="Equipment_Operator">Operator Alat</option>
            <option value="Project_Worker">Pekerja Lapangan</option>
          </select>
        </div>
      </div>

      {/* Employee List Table */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={24} className="animate-spin text-brand-400" />
        </div>
      ) : (
        <div className="table-container card">
          <table className="table">
            <thead>
              <tr>
                <th>NIP</th>
                <th>Nama / Jabatan</th>
                <th>Tipe</th>
                <th>Gaji Pokok</th>
                <th>Rekening Bank</th>
                <th>Tgl Bergabung</th>
                <th>Status</th>
                {isEditable && <th className="text-center">Aksi</th>}
              </tr>
            </thead>
            <tbody>
              {employees?.map((emp: any) => (
                <tr key={emp.id} className="hover:bg-surface-200/50">
                  <td className="font-mono text-xs text-slate-400 font-semibold">{emp.employee_id}</td>
                  <td>
                    <div>
                      <p className="font-semibold text-white">{emp.name}</p>
                      <p className="text-xs text-slate-400">{emp.position || '—'}</p>
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${typeBadges[emp.type] ?? 'badge-slate'}`}>
                      {typeLabels[emp.type] ?? emp.type}
                    </span>
                  </td>
                  <td className="font-mono text-xs text-brand-400 font-medium">
                    {formatIDR(Number(emp.base_salary))}
                  </td>
                  <td>
                    {emp.bank_name ? (
                      <div>
                        <p className="text-slate-300 text-xs">{emp.bank_name}</p>
                        <p className="text-slate-400 text-xs font-mono">{emp.bank_account || '—'}</p>
                      </div>
                    ) : (
                      <span className="text-slate-500 text-xs">—</span>
                    )}
                  </td>
                  <td className="text-slate-400 text-xs">{formatDate(emp.join_date)}</td>
                  <td>
                    <span className={`badge ${emp.is_active ? 'badge-green' : 'badge-red'}`}>
                      {emp.is_active ? 'Aktif' : 'Non-aktif'}
                    </span>
                  </td>
                  {isEditable && (
                    <td className="text-center">
                      <div className="inline-flex gap-2">
                        <button
                          className="btn-icon"
                          onClick={() => openEditModal(emp)}
                          title="Ubah Data"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          className="btn-icon"
                          onClick={() =>
                            toggleStatusMutation.mutate({ id: emp.id, is_active: !emp.is_active })
                          }
                          title={emp.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                        >
                          {emp.is_active ? (
                            <ToggleRight size={18} className="text-green-400" />
                          ) : (
                            <ToggleLeft size={18} className="text-slate-500" />
                          )}
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {!employees?.length && (
                <tr>
                  <td colSpan={isEditable ? 8 : 7} className="text-center py-12 text-slate-500">
                    Tidak ada data karyawan ditemukan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="card w-full max-w-lg p-6 animate-slide-up">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2 border-b border-surface-300 pb-2">
              <Users size={18} className="text-brand-400" />
              {selectedEmployee ? 'Ubah Data Karyawan' : 'Tambah Karyawan Baru'}
            </h3>
            <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="form-group sm:col-span-2">
                  <label className="label">Nama Lengkap *</label>
                  <div className="relative">
                    <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      className="input pl-9"
                      placeholder="Contoh: Budi Santoso"
                      {...register('name', { required: 'Nama harus diisi' })}
                    />
                  </div>
                  {errors.name && <p className="text-xs text-red-400 mt-1">{errors.name.message}</p>}
                </div>

                <div className="form-group">
                  <label className="label">Tipe Karyawan *</label>
                  <select className="select" {...register('type', { required: true })}>
                    <option value="Office_Staff">Staf Kantor</option>
                    <option value="Equipment_Operator">Operator Alat</option>
                    <option value="Project_Worker">Pekerja Lapangan</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="label">Jabatan / Posisi</label>
                  <div className="relative">
                    <Briefcase size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      className="input pl-9"
                      placeholder="Contoh: Operator Excavator"
                      {...register('position')}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="label">Gaji Pokok (IDR) *</label>
                  <div className="relative">
                    <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      className="input pl-9"
                      type="number"
                      placeholder="5000000"
                      {...register('base_salary', { required: 'Gaji pokok harus diisi', min: 0 })}
                    />
                  </div>
                  {errors.base_salary && <p className="text-xs text-red-400 mt-1">{errors.base_salary.message}</p>}
                </div>

                <div className="form-group">
                  <label className="label">Tanggal Bergabung</label>
                  <div className="relative">
                    <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      className="input pl-9"
                      type="date"
                      {...register('join_date')}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="label">Nama Bank</label>
                  <input
                    className="input"
                    placeholder="Contoh: BCA / Mandiri"
                    {...register('bank_name')}
                  />
                </div>

                <div className="form-group">
                  <label className="label">Nomor Rekening</label>
                  <div className="relative">
                    <CreditCard size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      className="input pl-9"
                      placeholder="Contoh: 8012345678"
                      {...register('bank_account')}
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-surface-300">
                <button type="button" className="btn-secondary flex-1" onClick={closeModal}>
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-primary flex-1 justify-center"
                >
                  {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : null}
                  {selectedEmployee ? 'Simpan Perubahan' : 'Tambah Karyawan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
