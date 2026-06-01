import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileCheck, Plus, Search, Edit2, Trash2, Loader2, Calendar, DollarSign, FileText, Info, ExternalLink, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import api from '../../api/axios';
import { useAuthStore } from '../../store/authStore';

interface ContractForm {
  contract_number: string;
  name: string;
  project_id: string;
  contract_value: number;
  start_date: string;
  end_date: string;
  status: 'Active' | 'Terminated' | 'Completed' | 'Expired';
  description: string;
}

const statusLabels: Record<string, string> = {
  Active: 'Aktif',
  Terminated: 'Diputus',
  Completed: 'Selesai',
  Expired: 'Kedaluwarsa',
};

const statusBadges: Record<string, string> = {
  Active: 'badge-blue',
  Terminated: 'badge-red',
  Completed: 'badge-emerald',
  Expired: 'badge-slate',
};

export default function ContractList() {
  const qc = useQueryClient();
  const { user: currentUser } = useAuthStore();
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedContract, setSelectedContract] = useState<any | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const isEditable = currentUser?.role === 'Admin' || currentUser?.role === 'Staf_Keuangan' || currentUser?.role === 'Manajer_Proyek';
  const isDeletable = currentUser?.role === 'Admin';

  const { data: contracts, isLoading } = useQuery({
    queryKey: ['contracts', search, projectFilter],
    queryFn: () =>
      api
        .get('/contracts', {
          params: {
            search: search || undefined,
            project_id: projectFilter || undefined,
          },
        })
        .then((r) => r.data.data),
  });

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get('/projects').then((r) => r.data.data),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContractForm>();

  const createMutation = useMutation({
    mutationFn: (fd: FormData) => api.post('/contracts', fd),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contracts'] });
      toast.success('Kontrak berhasil ditambahkan!');
      closeModal();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Gagal menambahkan kontrak'),
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; fd: FormData }) =>
      api.put(`/contracts/${data.id}`, data.fd),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contracts'] });
      toast.success('Data kontrak berhasil diubah!');
      closeModal();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Gagal mengubah data kontrak'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/contracts/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contracts'] });
      toast.success('Kontrak berhasil dihapus!');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Gagal menghapus kontrak'),
  });

  const openAddModal = () => {
    setSelectedContract(null);
    setSelectedFile(null);
    reset({
      contract_number: '',
      name: '',
      project_id: '',
      contract_value: 0,
      start_date: '',
      end_date: '',
      status: 'Active',
      description: '',
    });
    setShowModal(true);
  };

  const openEditModal = (contract: any) => {
    setSelectedContract(contract);
    setSelectedFile(null);
    reset({
      contract_number: contract.contract_number,
      name: contract.name,
      project_id: contract.project_id,
      contract_value: Number(contract.contract_value),
      start_date: contract.start_date ? new Date(contract.start_date).toISOString().split('T')[0] : '',
      end_date: contract.end_date ? new Date(contract.end_date).toISOString().split('T')[0] : '',
      status: contract.status,
      description: contract.description || '',
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedContract(null);
    setSelectedFile(null);
    reset();
  };

  const handleFormSubmit = (data: ContractForm) => {
    const fd = new FormData();
    fd.append('contract_number', data.contract_number);
    fd.append('name', data.name);
    fd.append('project_id', data.project_id);
    fd.append('contract_value', String(data.contract_value));
    fd.append('start_date', data.start_date);
    fd.append('end_date', data.end_date);
    fd.append('status', data.status);
    if (data.description) fd.append('description', data.description);
    if (selectedFile) fd.append('document', selectedFile);

    if (selectedContract) {
      updateMutation.mutate({ id: selectedContract.id, fd });
    } else {
      createMutation.mutate(fd);
    }
  };

  const handleDelete = (id: string, number: string) => {
    if (confirm(`Apakah Anda yakin ingin menghapus kontrak nomor ${number}?`)) {
      deleteMutation.mutate(id);
    }
  };

  const formatIDR = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(val);
  };

  const getDocumentUrl = (filePath: string) => {
    if (!filePath) return '';
    const apiBase = import.meta.env.VITE_API_URL || '';
    if (apiBase.startsWith('http')) {
      const host = apiBase.replace(/\/api$/, '');
      return `${host}${filePath}`;
    }
    return `${window.location.origin}${filePath}`;
  };

  // Stat calculations
  const totalCount = contracts?.length ?? 0;
  const activeCount = contracts?.filter((c: any) => c.status === 'Active').length ?? 0;
  const completedCount = contracts?.filter((c: any) => c.status === 'Completed').length ?? 0;
  const totalValue = contracts?.reduce((s: number, c: any) => s + Number(c.contract_value), 0) ?? 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Data Kontrak Kerja</h2>
          <p className="page-subtitle">Kelola kontrak kerja proyek beserta dokumen legalitas kontrak</p>
        </div>
        {isEditable && (
          <button className="btn-primary" onClick={openAddModal}>
            <Plus size={16} /> Tambah Kontrak
          </button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-brand-400">{totalCount}</p>
          <p className="text-xs text-slate-400 mt-1">Total Kontrak</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-blue-400">{activeCount}</p>
          <p className="text-xs text-slate-400 mt-1">Kontrak Aktif</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-emerald-400">{completedCount}</p>
          <p className="text-xs text-slate-400 mt-1">Kontrak Selesai</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-lg font-bold text-purple-400 truncate" title={formatIDR(totalValue)}>
            {formatIDR(totalValue)}
          </p>
          <p className="text-xs text-slate-400 mt-1">Total Nilai Kontrak</p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="Cari nomor kontrak atau nama..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="w-full sm:w-64">
          <select
            className="select"
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
          >
            <option value="">Semua Proyek</option>
            {projects?.map((proj: any) => (
              <option key={proj.id} value={proj.id}>
                {proj.project_code} — {proj.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* List Table */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={24} className="animate-spin text-brand-400" />
        </div>
      ) : (
        <div className="table-container card">
          <table className="table">
            <thead>
              <tr>
                <th>Nomor Kontrak</th>
                <th>Nama Kontrak</th>
                <th>Proyek</th>
                <th>Nilai Kontrak</th>
                <th>Masa Berlaku</th>
                <th>Status</th>
                <th>Dokumen</th>
                {(isEditable || isDeletable) && <th className="text-center">Aksi</th>}
              </tr>
            </thead>
            <tbody>
              {contracts?.map((contract: any) => (
                <tr key={contract.id} className="hover:bg-surface-50">
                  <td>
                    <p className="font-semibold text-white font-mono text-xs">{contract.contract_number}</p>
                  </td>
                  <td>
                    <p className="font-semibold text-slate-200">{contract.name}</p>
                  </td>
                  <td>
                    <p className="text-xs text-slate-300 font-semibold">{contract.project?.project_code}</p>
                    <p className="text-[10px] text-slate-500 max-w-[150px] truncate" title={contract.project?.name}>
                      {contract.project?.name}
                    </p>
                  </td>
                  <td className="font-mono text-xs text-brand-400 font-bold">
                    {formatIDR(Number(contract.contract_value))}
                  </td>
                  <td className="text-xs text-slate-300">
                    <div className="flex flex-col">
                      <span>Mulai: {contract.start_date ? new Date(contract.start_date).toLocaleDateString('id-ID') : '—'}</span>
                      <span className="text-slate-500 text-[10px]">
                        Selesai: {contract.end_date ? new Date(contract.end_date).toLocaleDateString('id-ID') : '—'}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${statusBadges[contract.status] ?? 'badge-slate'}`}>
                      {statusLabels[contract.status] ?? contract.status}
                    </span>
                  </td>
                  <td>
                    {contract.document_path ? (
                      <a
                        href={getDocumentUrl(contract.document_path)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 font-semibold hover:underline"
                      >
                        <Download size={12} /> Dokumen
                      </a>
                    ) : (
                      <span className="text-xs text-slate-500 italic">Belum diunggah</span>
                    )}
                  </td>
                  {(isEditable || isDeletable) && (
                    <td className="text-center">
                      <div className="inline-flex gap-2">
                        {isEditable && (
                          <button
                            className="btn-icon"
                            onClick={() => openEditModal(contract)}
                            title="Ubah Data"
                          >
                            <Edit2 size={14} />
                          </button>
                        )}
                        {isDeletable && (
                          <button
                            className="btn-icon text-slate-400 hover:text-red-400"
                            onClick={() => handleDelete(contract.id, contract.contract_number)}
                            title="Hapus"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {!contracts?.length && (
                <tr>
                  <td colSpan={(isEditable || isDeletable) ? 8 : 7} className="text-center py-12 text-slate-500">
                    Tidak ada data kontrak ditemukan.
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
              <FileCheck size={18} className="text-brand-400" />
              {selectedContract ? 'Ubah Data Kontrak' : 'Tambah Kontrak Baru'}
            </h3>
            <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="label">Nomor Kontrak *</label>
                  <input
                    className="input font-mono"
                    placeholder="Contoh: CTR/EJP/VI/2026-001"
                    {...register('contract_number', { required: 'Nomor kontrak wajib diisi' })}
                  />
                  {errors.contract_number && <p className="text-xs text-red-400 mt-1">{errors.contract_number.message}</p>}
                </div>

                <div className="form-group">
                  <label className="label">Nama Kontrak *</label>
                  <input
                    className="input"
                    placeholder="Contoh: Pekerjaan Pondasi Sewa Beko"
                    {...register('name', { required: 'Nama kontrak wajib diisi' })}
                  />
                  {errors.name && <p className="text-xs text-red-400 mt-1">{errors.name.message}</p>}
                </div>

                <div className="form-group">
                  <label className="label">Relasi Proyek *</label>
                  <select className="select" {...register('project_id', { required: 'Pilih salah satu proyek' })}>
                    <option value="">Pilih Proyek...</option>
                    {projects?.map((p: any) => (
                      <option key={p.id} value={p.id}>
                        {p.project_code} — {p.name}
                      </option>
                    ))}
                  </select>
                  {errors.project_id && <p className="text-xs text-red-400 mt-1">{errors.project_id.message}</p>}
                </div>

                <div className="form-group">
                  <label className="label">Nilai Kontrak (Rupiah) *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-semibold">Rp</span>
                    <input
                      className="input pl-8 font-mono text-right"
                      type="number"
                      placeholder="0"
                      {...register('contract_value', {
                        required: 'Nilai kontrak wajib diisi',
                        min: { value: 1, message: 'Nilai kontrak harus lebih dari 0' }
                      })}
                    />
                  </div>
                  {errors.contract_value && <p className="text-xs text-red-400 mt-1">{errors.contract_value.message}</p>}
                </div>

                <div className="form-group">
                  <label className="label">Tanggal Mulai *</label>
                  <div className="relative">
                    <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      className="input pl-9"
                      type="date"
                      {...register('start_date', { required: 'Tanggal mulai wajib diisi' })}
                    />
                  </div>
                  {errors.start_date && <p className="text-xs text-red-400 mt-1">{errors.start_date.message}</p>}
                </div>

                <div className="form-group">
                  <label className="label">Tanggal Selesai *</label>
                  <div className="relative">
                    <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      className="input pl-9"
                      type="date"
                      {...register('end_date', { required: 'Tanggal selesai wajib diisi' })}
                    />
                  </div>
                  {errors.end_date && <p className="text-xs text-red-400 mt-1">{errors.end_date.message}</p>}
                </div>

                <div className="form-group">
                  <label className="label">Status Kontrak *</label>
                  <select className="select" {...register('status', { required: true })}>
                    <option value="Active">Aktif</option>
                    <option value="Completed">Selesai</option>
                    <option value="Terminated">Diputus</option>
                    <option value="Expired">Kedaluwarsa</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="label">Unggah Dokumen Kontrak</label>
                  <input
                    type="file"
                    className="file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-brand-500/10 file:text-brand-400 hover:file:bg-brand-500/20 text-xs text-slate-400 w-full"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setSelectedFile(e.target.files[0]);
                      }
                    }}
                  />
                  {selectedContract?.document_path && !selectedFile && (
                    <p className="text-[10px] text-brand-400 mt-1 flex items-center gap-1">
                      <Info size={10} /> Dokumen sudah ada. Unggah file untuk mengganti.
                    </p>
                  )}
                </div>

                <div className="form-group sm:col-span-2">
                  <label className="label">Deskripsi / Catatan Kontrak</label>
                  <div className="relative">
                    <Info size={14} className="absolute left-3 top-4 text-slate-500" />
                    <textarea
                      className="input pl-9 h-20"
                      placeholder="Masukkan perincian, amandemen, atau keterangan tambahan kontrak..."
                      {...register('description')}
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
                  {selectedContract ? 'Simpan Perubahan' : 'Tambah Kontrak'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
