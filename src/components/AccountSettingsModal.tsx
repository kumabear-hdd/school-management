import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, KeyRound, UserCheck, X } from 'lucide-react';
import { useSims } from '../context/SimsContext';
import { ROLE_LABELS, validatePasswordStrength } from '../utils/authLogic';

interface AccountSettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export const AccountSettingsModal: React.FC<AccountSettingsModalProps> = ({
  open,
  onClose,
}) => {
  const { currentUser, data, changeMyPassword } = useSims();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);

  if (!open) return null;

  const strength = validatePasswordStrength(newPassword);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!strength.valid) {
      setFeedback({
        type: 'err',
        text: strength.error || 'Password baru belum memenuhi syarat.',
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      setFeedback({ type: 'err', text: 'Konfirmasi password baru tidak cocok.' });
      return;
    }

    setSubmitting(true);
    try {
      const res = await changeMyPassword(currentPassword, newPassword);
      if (res.ok) {
        setFeedback({ type: 'ok', text: 'Password akun Anda berhasil diperbarui.' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setFeedback({ type: 'err', text: res.error || 'Gagal mengganti password.' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-settings-title"
    >
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl space-y-5">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <UserCheck className="h-5 w-5 text-[#0F4C81]" aria-hidden="true" />
            <div>
              <h2 id="account-settings-title" className="text-base font-bold text-slate-900">
                Profil Akun & Pengaturan Password
              </h2>
              <p className="text-xs text-slate-500">
                {data.school.name} · Terhubung ke Firebase Auth
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal akun"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs">
          <div>
            <p className="text-slate-500">Nama Lengkap</p>
            <p className="font-semibold text-slate-900">{currentUser.name}</p>
          </div>
          <div>
            <p className="text-slate-500">Peran (Role)</p>
            <p className="font-semibold text-slate-900">{ROLE_LABELS[currentUser.role]}</p>
          </div>
          <div>
            <p className="text-slate-500">Username</p>
            <p className="font-mono font-semibold text-slate-900">{currentUser.username}</p>
          </div>
          <div>
            <p className="text-slate-500">Login Terakhir</p>
            <p className="font-mono text-slate-700 tabular-nums">
              {currentUser.lastLoginAt
                ? currentUser.lastLoginAt.slice(0, 16).replace('T', ' ')
                : '-'}
            </p>
          </div>
        </div>

        {feedback && (
          <div
            role="alert"
            className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-xs ${
              feedback.type === 'ok'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border-red-200 bg-red-50 text-red-900'
            }`}
          >
            {feedback.type === 'ok' ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            ) : (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            )}
            <span>{feedback.text}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <p className="text-xs font-semibold text-slate-900">
            Ubah Password Secara Mandiri
          </p>

          <div>
            <label htmlFor="acc-cur-pw" className="block text-xs font-medium text-slate-700">
              Password Saat Ini
            </label>
            <input
              id="acc-cur-pw"
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Masukkan password saat ini"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="acc-new-pw" className="block text-xs font-medium text-slate-700">
                Password Baru
              </label>
              <input
                id="acc-new-pw"
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min 8 karakter"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="acc-confirm-pw" className="block text-xs font-medium text-slate-700">
                Konfirmasi Password Baru
              </label>
              <input
                id="acc-confirm-pw"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ulangi password baru"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Tutup
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F4C81] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0C3D68] disabled:opacity-60"
            >
              <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
              {submitting ? 'Memperbarui...' : 'Simpan Password Baru'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
