import React, { useState } from 'react';
import {
  AlertCircle,
  Eye,
  EyeOff,
  KeyRound,
  LogOut,
  ShieldAlert,
} from 'lucide-react';
import { useSims } from '../context/SimsContext';
import { ROLE_LABELS, validatePasswordStrength } from '../utils/authLogic';

export const ForcePasswordChangeScreen: React.FC = () => {
  const {
    data,
    currentUser,
    completeFirstLoginPasswordChange,
    logoutSession,
  } = useSims();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const strength = validatePasswordStrength(newPassword);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!strength.valid) {
      setError(strength.error || 'Password baru belum memenuhi kriteria keamanan.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Konfirmasi password baru tidak cocok.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await completeFirstLoginPasswordChange(newPassword);
      if (!res.ok) {
        setError(res.error || 'Gagal memperbarui password awal.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 sm:p-8 space-y-6">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
              <ShieldAlert className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-800">
                Kewajiban Keamanan Login Pertama
              </p>
              <h1 className="mt-1 text-xl font-bold text-slate-900">
                Wajib Mengganti Password Awal
              </h1>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void logoutSession()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
            Keluar
          </button>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs space-y-1">
          <p className="text-slate-600">
            Sekolah: <strong className="text-slate-900">{data.school.name}</strong>
          </p>
          <p className="text-slate-600">
            Pengguna: <strong className="text-slate-900">{currentUser.name}</strong> (
            <span className="font-mono">{currentUser.username}</span>)
          </p>
          <p className="text-slate-600">
            Peran: <strong className="text-slate-900">{ROLE_LABELS[currentUser.role]}</strong>
          </p>
          <p className="pt-1 text-slate-500">
            Akun Kepala Sekolah, Guru, dan Staff wajib mengganti password sementara sebelum dapat membuka dashboard dan modul SIMS.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-900"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="force-new-pw" className="block text-xs font-medium text-slate-700">
              Password Baru
            </label>
            <div className="relative mt-1">
              <input
                id="force-new-pw"
                type={showPw ? 'text' : 'password'}
                required
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimal 8 karakter, huruf besar, kecil & angka"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 pr-10 text-sm focus:border-[#0F4C81] focus:outline-none focus:ring-1 focus:ring-[#0F4C81]"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? 'Sembunyikan password' : 'Lihat password'}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:bg-slate-100"
              >
                {showPw ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="force-confirm-pw" className="block text-xs font-medium text-slate-700">
              Konfirmasi Password Baru
            </label>
            <input
              id="force-confirm-pw"
              type={showPw ? 'text' : 'password'}
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Ulangi password baru"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-[#0F4C81] focus:outline-none focus:ring-1 focus:ring-[#0F4C81]"
            />
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-700">Persyaratan Password</span>
              <span className={strength.valid ? 'font-semibold text-emerald-700' : 'text-amber-700'}>
                {strength.valid ? 'Kuat & Valid' : 'Belum Lengkap'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-600">
              <span className={strength.checks.minLength ? 'text-emerald-700 font-medium' : ''}>
                {strength.checks.minLength ? '✓' : '○'} Minimal 8 karakter
              </span>
              <span className={strength.checks.hasUpper ? 'text-emerald-700 font-medium' : ''}>
                {strength.checks.hasUpper ? '✓' : '○'} Huruf kapital (A-Z)
              </span>
              <span className={strength.checks.hasLower ? 'text-emerald-700 font-medium' : ''}>
                {strength.checks.hasLower ? '✓' : '○'} Huruf kecil (a-z)
              </span>
              <span className={strength.checks.hasNumber ? 'text-emerald-700 font-medium' : ''}>
                {strength.checks.hasNumber ? '✓' : '○'} Angka (0-9)
              </span>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#0F4C81] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0C3D68] disabled:opacity-60"
          >
            <KeyRound className="h-4 w-4" aria-hidden="true" />
            {submitting ? 'Menyimpan Password Baru...' : 'Simpan Password Baru & Buka Dashboard'}
          </button>
        </form>
      </div>
    </div>
  );
};
