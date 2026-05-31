import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Plus, Search, Edit2, Trash2, Loader2, Phone, Mail, MapPin, FileText, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import api from '../../api/axios';
import { useAuthStore } from '../../store/authStore';

interface ContactForm {
  name: string;
  type: 'Client' | 'Vendor' | 'Both';
  phone: string;
  email: string;
  address: string;
  tax_id: string;
  notes: string;
}

const typeLabels: Record<string, string> = {
  Client: 'Client',
  Vendor: 'Vendor',
  Both: 'Client & Vendor',
};

const typeBadges: Record<string, string> = {
  Client: 'badge-blue',
  Vendor: 'badge-amber',
  Both: 'badge-purple',
};

export default function ContactList() {
  const qc = useQueryClient();
  const { user: currentUser } = useAuthStore();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedContact, setSelectedContact] = useState<any | null>(null);

  const isEditable = currentUser?.role === 'Admin' || currentUser?.role === 'Staf_Keuangan' || currentUser?.role === 'Manajer_Proyek';
  const isDeletable = currentUser?.role === 'Admin';

  const { data: contacts, isLoading } = useQuery({
    queryKey: ['contacts', search, typeFilter],
    queryFn: () =>
      api
        .get('/contacts', {
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
    formState: { errors, isSubmitting },
  } = useForm<ContactForm>();

  const createMutation = useMutation({
    mutationFn: (data: ContactForm) => api.post('/contacts', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Partner berhasil ditambahkan!');
      closeModal();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Gagal menambahkan partner'),
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; body: Partial<ContactForm> }) =>
      api.put(`/contacts/${data.id}`, data.body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Data partner berhasil diubah!');
      closeModal();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Gagal mengubah data partner'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/contacts/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Partner berhasil dihapus!');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Gagal menghapus partner'),
  });

  const openAddModal = () => {
    setSelectedContact(null);
    reset({
      name: '',
      type: 'Client',
      phone: '',
      email: '',
      address: '',
      tax_id: '',
      notes: '',
    });
    setShowModal(true);
  };

  const openEditModal = (contact: any) => {
    setSelectedContact(contact);
    reset({
      name: contact.name,
      type: contact.type,
      phone: contact.phone || '',
      email: contact.email || '',
      address: contact.address || '',
      tax_id: contact.tax_id || '',
      notes: contact.notes || '',
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedContact(null);
    reset();
  };

  const handleFormSubmit = (data: ContactForm) => {
    if (selectedContact) {
      updateMutation.mutate({ id: selectedContact.id, body: data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Apakah Anda yakin ingin menghapus partner ${name}?`)) {
      deleteMutation.mutate(id);
    }
  };

  // Stat summary calculations
  const totalCount = contacts?.length ?? 0;
  const clientCount = contacts?.filter((c: any) => c.type === 'Client').length ?? 0;
  const vendorCount = contacts?.filter((c: any) => c.type === 'Vendor').length ?? 0;
  const bothCount = contacts?.filter((c: any) => c.type === 'Both').length ?? 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Data Client & Vendor</h2>
          <p className="page-subtitle">Kelola informasi kontak client, vendor supplier, dan sub-kontraktor</p>
        </div>
        {isEditable && (
          <button className="btn-primary" onClick={openAddModal}>
            <Plus size={16} /> Tambah Partner
          </button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Partner', value: totalCount, color: '#3b82f6' },
          { label: 'Client', value: clientCount, color: '#60a5fa' },
          { label: 'Vendor / Supplier', value: vendorCount, color: '#f59e0b' },
          { label: 'Dual Akses (Both)', value: bothCount, color: '#a855f7' },
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
            placeholder="Cari nama partner/perusahaan..."
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
            <option value="">Semua Tipe Partner</option>
            <option value="Client">Client</option>
            <option value="Vendor">Vendor</option>
            <option value="Both">Client & Vendor (Both)</option>
          </select>
        </div>
      </div>

      {/* Contacts List Table */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={24} className="animate-spin text-brand-400" />
        </div>
      ) : (
        <div className="table-container card">
          <table className="table">
            <thead>
              <tr>
                <th>Nama Partner</th>
                <th>Tipe</th>
                <th>Telepon</th>
                <th>Email</th>
                <th>NPWP</th>
                <th>Alamat</th>
                <th>Catatan</th>
                {(isEditable || isDeletable) && <th className="text-center">Aksi</th>}
              </tr>
            </thead>
            <tbody>
              {contacts?.map((contact: any) => (
                <tr key={contact.id} className="hover:bg-surface-50">
                  <td>
                    <p className="font-semibold text-white">{contact.name}</p>
                  </td>
                  <td>
                    <span className={`badge ${typeBadges[contact.type] ?? 'badge-slate'}`}>
                      {typeLabels[contact.type] ?? contact.type}
                    </span>
                  </td>
                  <td className="font-mono text-xs text-slate-300">
                    {contact.phone || <span className="text-slate-500">—</span>}
                  </td>
                  <td className="text-xs text-slate-300">
                    {contact.email || <span className="text-slate-500">—</span>}
                  </td>
                  <td className="font-mono text-xs text-slate-400">
                    {contact.tax_id || <span className="text-slate-500">—</span>}
                  </td>
                  <td className="text-xs text-slate-300 max-w-[200px] truncate" title={contact.address}>
                    {contact.address || <span className="text-slate-500">—</span>}
                  </td>
                  <td className="text-xs text-slate-400 max-w-[150px] truncate" title={contact.notes}>
                    {contact.notes || <span className="text-slate-500">—</span>}
                  </td>
                  {(isEditable || isDeletable) && (
                    <td className="text-center">
                      <div className="inline-flex gap-2">
                        {isEditable && (
                          <button
                            className="btn-icon"
                            onClick={() => openEditModal(contact)}
                            title="Ubah Data"
                          >
                            <Edit2 size={14} />
                          </button>
                        )}
                        {isDeletable && (
                          <button
                            className="btn-icon text-slate-400 hover:text-red-400"
                            onClick={() => handleDelete(contact.id, contact.name)}
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
              {!contacts?.length && (
                <tr>
                  <td colSpan={(isEditable || isDeletable) ? 8 : 7} className="text-center py-12 text-slate-500">
                    Tidak ada data partner ditemukan.
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
              {selectedContact ? 'Ubah Data Partner' : 'Tambah Partner Baru'}
            </h3>
            <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="form-group sm:col-span-2">
                  <label className="label">Nama Partner / Perusahaan *</label>
                  <input
                    className="input"
                    placeholder="Contoh: PT. Jaya Konstruksi"
                    {...register('name', { required: 'Nama partner harus diisi' })}
                  />
                  {errors.name && <p className="text-xs text-red-400 mt-1">{errors.name.message}</p>}
                </div>

                <div className="form-group">
                  <label className="label">Tipe Partner *</label>
                  <select className="select" {...register('type', { required: true })}>
                    <option value="Client">Client</option>
                    <option value="Vendor">Vendor / Supplier</option>
                    <option value="Both">Client & Vendor (Both)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="label">Nomor Telepon</label>
                  <div className="relative">
                    <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      className="input pl-9"
                      placeholder="Contoh: 021-1234567"
                      {...register('phone')}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="label">Alamat Email</label>
                  <div className="relative">
                    <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      className="input pl-9"
                      type="email"
                      placeholder="Contoh: info@ptjaya.com"
                      {...register('email')}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="label">NPWP (Tax ID)</label>
                  <div className="relative">
                    <FileText size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      className="input pl-9"
                      placeholder="Contoh: 01.234.567.8-999.000"
                      {...register('tax_id')}
                    />
                  </div>
                </div>

                <div className="form-group sm:col-span-2">
                  <label className="label">Alamat Lengkap</label>
                  <div className="relative">
                    <MapPin size={14} className="absolute left-3 top-4 text-slate-500" />
                    <textarea
                      className="input pl-9 h-20"
                      placeholder="Masukkan alamat kantor/perusahaan..."
                      {...register('address')}
                    />
                  </div>
                </div>

                <div className="form-group sm:col-span-2">
                  <label className="label">Catatan Tambahan</label>
                  <div className="relative">
                    <Info size={14} className="absolute left-3 top-4 text-slate-500" />
                    <textarea
                      className="input pl-9 h-20"
                      placeholder="Catatan pengerjaan proyek, tempo pembayaran, atau info penting lainnya..."
                      {...register('notes')}
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
                  {selectedContact ? 'Simpan Perubahan' : 'Tambah Partner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
