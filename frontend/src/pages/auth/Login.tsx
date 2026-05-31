import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Eye, EyeOff, Loader2, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { useAuthStore } from '../../store/authStore';
import logoImg from '../../assets/logo.png';

interface LoginForm {
  email: string;
  password: string;
}

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginForm>();
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  const onSubmit = async (data: LoginForm) => {
    try {
      const res = await api.post('/auth/login', data);
      const { token, user } = res.data.data;
      setAuth(user, token);
      toast.success(`Selamat datang kembali, ${user.name}!`);
      navigate('/');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal masuk. Silakan periksa kembali email dan kata sandi Anda.');
    }
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-brand-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md animate-slide-up">
        {/* Card */}
        <div className="card p-8">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-24 h-24 rounded-2xl bg-white flex items-center justify-center p-2 shadow-glow-blue mb-4">
              <img src={logoImg} alt="El Jaya Pondasi Logo" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-2xl font-bold text-white text-gradient">El Jaya Pondasi</h1>
            <p className="text-slate-400 text-sm mt-1">Sistem ERP Konstruksi & Rental Alat</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="form-group">
              <label className="label">Alamat Email</label>
              <input
                type="email"
                className="input"
                placeholder="user@ejp.com"
                {...register('email', { required: 'Email wajib diisi' })}
              />
              {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
            </div>

            <div className="form-group">
              <label className="label">Kata Sandi</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="input pr-10"
                  placeholder="••••••••"
                  {...register('password', { required: 'Kata sandi wajib diisi' })}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full justify-center py-3 text-base"
            >
              {isSubmitting ? (
                <><Loader2 size={16} className="animate-spin" /> Masuk...</>
              ) : 'Masuk'}
            </button>
          </form>

          <div className="mt-6 p-4 rounded-lg bg-surface-200 border border-surface-300">
            <p className="text-xs text-slate-400 font-medium mb-1">Masukkan username dan password Anda</p>
          </div>
        </div>

        <p className="text-center text-xs text-slate-600 mt-4">
          © 2026 El Jaya Pondasi. Hak cipta dilindungi undang-undang.
        </p>
      </div>
    </div>
  );
}
