import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  LogOut,
  MailCheck,
  RefreshCw,
  Send,
  ShieldCheck,
} from 'lucide-react';
import { useSims } from '../context/SimsContext';
import type { PendingAdminBootstrapDraft } from '../types/sims';
import {
  buildDeterministicSchoolId,
  checkResendRateLimit,
  RESEND_MAX_ATTEMPTS_PER_WINDOW,
  validatePendingAdminDraftCompletion,
} from '../utils/emailVerificationLogic';

export const EmailVerificationScreen: React.FC = () => {
  const {
    data,
    firebaseUser,
    pendingAdminDraft,
    pendingVerificationContext,
    resendRateLimitState,
    statusMessage,
    resendVerificationEmail,
    checkEmailVerificationAndProceed,
    cancelPendingVerification,
  } = useSims();

  const isBootstrapFlow = pendingVerificationContext !== 'policy_login';
  const targetEmail = (
    firebaseUser?.email ||
    pendingAdminDraft?.email ||
    ''
  ).trim();

  const isDraftComplete = Boolean(
    pendingAdminDraft?.adminName?.trim() &&
      pendingAdminDraft?.username?.trim() &&
      pendingAdminDraft?.phoneNumber?.trim() &&
      pendingAdminDraft?.schoolName?.trim() &&
      pendingAdminDraft?.schoolAddress?.trim()
  );

  // Inline resume form state when Auth account exists without local draft metadata
  const [adminName, setAdminName] = useState(
    pendingAdminDraft?.adminName || firebaseUser?.displayName || ''
  );
  const [username, setUsername] = useState(pendingAdminDraft?.username || '');
  const [phoneNumber, setPhoneNumber] = useState(
    pendingAdminDraft?.phoneNumber || ''
  );
  const [schoolName, setSchoolName] = useState(pendingAdminDraft?.schoolName || '');
  const [npsn, setNpsn] = useState(pendingAdminDraft?.npsn || '');
  const [schoolAddress, setSchoolAddress] = useState(
    pendingAdminDraft?.schoolAddress || ''
  );

  const [nowMs, setNowMs] = useState(() => Date.now());
  const [serverCooldownUntilMs, setServerCooldownUntilMs] = useState<number>(0);
  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoNotice, setInfoNotice] = useState<string | null>(null);

  useEffect(() => {
    if (pendingAdminDraft) {
      if (pendingAdminDraft.adminName) setAdminName(pendingAdminDraft.adminName);
      if (pendingAdminDraft.username) setUsername(pendingAdminDraft.username);
      if (pendingAdminDraft.phoneNumber) setPhoneNumber(pendingAdminDraft.phoneNumber);
      if (pendingAdminDraft.schoolName) setSchoolName(pendingAdminDraft.schoolName);
      if (pendingAdminDraft.npsn) setNpsn(pendingAdminDraft.npsn);
      if (pendingAdminDraft.schoolAddress) setSchoolAddress(pendingAdminDraft.schoolAddress);
    }
  }, [pendingAdminDraft]);

  const clientLimit = checkResendRateLimit(resendRateLimitState, nowMs);
  const serverRemainingSeconds =
    serverCooldownUntilMs > nowMs
      ? Math.ceil((serverCooldownUntilMs - nowMs) / 1000)
      : 0;
  const activeCooldownSeconds = Math.max(
    clientLimit.allowed ? 0 : clientLimit.retryAfterSeconds,
    serverRemainingSeconds
  );
  const isResendBlocked = activeCooldownSeconds > 0 || !clientLimit.allowed;

  useEffect(() => {
    if (!isResendBlocked) return;
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isResendBlocked]);

  const handleCheckVerification = async () => {
    setError(null);
    setInfoNotice(null);

    let overrideDraft: PendingAdminBootstrapDraft | undefined;
    if (isBootstrapFlow && !isDraftComplete) {
      const uid = firebaseUser?.uid || pendingAdminDraft?.uid || '';
      const check = validatePendingAdminDraftCompletion({
        adminName,
        username,
        email: targetEmail,
        phoneNumber,
        schoolName,
        npsn,
        schoolAddress,
      });
      if (!check.valid) {
        setError(
          check.error ||
            'Lengkapi identitas Admin Sekolah dan Sekolah untuk melanjutkan bootstrap.'
        );
        return;
      }
      overrideDraft = {
        uid,
        schoolId: buildDeterministicSchoolId(schoolName, npsn, uid),
        email: targetEmail.toLowerCase(),
        adminName: adminName.trim(),
        username: check.normalizedUsername,
        phoneNumber: phoneNumber.trim(),
        schoolName: schoolName.trim(),
        npsn: npsn.trim(),
        schoolAddress: schoolAddress.trim(),
        createdAt: pendingAdminDraft?.createdAt || new Date().toISOString(),
      };
    }

    setChecking(true);
    try {
      const res = await checkEmailVerificationAndProceed(overrideDraft);
      if (!res.ok) {
        setError(
          res.error ||
            'Email Anda belum terverifikasi. Klik tautan verifikasi di email lalu coba lagi.'
        );
      }
    } finally {
      setChecking(false);
    }
  };

  const handleResend = async () => {
    setError(null);
    setInfoNotice(null);
    setResending(true);
    try {
      const res = await resendVerificationEmail();
      setNowMs(Date.now());
      if (res.ok && res.alreadyVerified) {
        setInfoNotice('Email sudah terverifikasi. Melanjutkan ke Dashboard...');
        return;
      }
      if (!res.ok) {
        if (typeof res.retryAfterSeconds === 'number' && res.retryAfterSeconds > 0) {
          setServerCooldownUntilMs(Date.now() + res.retryAfterSeconds * 1000);
        }
        setError(res.error || 'Gagal mengirim ulang email verifikasi.');
        return;
      }
      setInfoNotice(
        `Email verifikasi baru telah dikirim ke ${targetEmail || 'email Anda'}. Periksa Kotak Masuk maupun folder Spam/Junk.`
      );
    } finally {
      setResending(false);
    }
  };

  const handleExitRegistration = async () => {
    setError(null);
    setExiting(true);
    try {
      await cancelPendingVerification();
    } finally {
      setExiting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-6 sm:p-8 space-y-6">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-sky-200 bg-sky-50 text-[#0F4C81]">
              <MailCheck className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#0F4C81]">
                {isBootstrapFlow
                  ? 'Tahap Wajib Registrasi Admin Sekolah'
                  : 'Kebijakan Verifikasi Email Sekolah'}
              </p>
              <h1 className="mt-1 text-xl font-bold text-slate-900">
                Verifikasi Email Diperlukan
              </h1>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-slate-600">Alamat Email Tujuan:</span>
            <span className="font-mono font-semibold text-slate-900">
              {targetEmail || '(Email tidak tersedia)'}
            </span>
          </div>
          {(pendingAdminDraft?.schoolName || data.school.name) && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-slate-600">Sekolah:</span>
              <span className="font-semibold text-slate-900">
                {pendingAdminDraft?.schoolName || data.school.name}
              </span>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-slate-600">Status Verifikasi Firebase:</span>
            <span className="font-semibold text-amber-800">
              Belum Terverifikasi (Akses Dashboard Dikunci)
            </span>
          </div>
        </div>

        <div className="space-y-2.5 text-xs text-slate-600 leading-relaxed">
          <p>
            Kami telah mengirimkan tautan verifikasi resmi melalui Firebase Authentication ke{' '}
            <strong className="text-slate-900">{targetEmail || 'email Anda'}</strong>.
            {isBootstrapFlow
              ? ' Demi keamanan multi-tenant, inisialisasi sekolah (bootstrap) dan akses Dashboard Admin hanya dapat diselesaikan setelah email terverifikasi dan divalidasi di backend.'
              : ' Sekolah Anda mewajibkan verifikasi email aktif sebelum akun dapat mengakses Dashboard SIMS.'}
          </p>
          <ol className="list-decimal pl-4 space-y-1 text-slate-700">
            <li>Buka aplikasi email Anda dan periksa Kotak Masuk atau folder Spam/Junk.</li>
            <li>Klik tautan konfirmasi verifikasi email dari SIMS / Firebase.</li>
            <li>
              Kembali ke halaman ini lalu tekan tombol{' '}
              <strong>&ldquo;Saya sudah melakukan verifikasi&rdquo;</strong>.
            </li>
          </ol>
        </div>

        {(infoNotice || statusMessage) && !error && (
          <div
            role="status"
            className="flex items-start gap-2.5 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-950"
          >
            <CheckCircle2
              className="mt-0.5 h-4 w-4 shrink-0 text-[#0F4C81]"
              aria-hidden="true"
            />
            <span>{infoNotice || statusMessage}</span>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-900"
          >
            <AlertCircle
              className="mt-0.5 h-4 w-4 shrink-0 text-red-700"
              aria-hidden="true"
            />
            <span>{error}</span>
          </div>
        )}

        {isBootstrapFlow && !isDraftComplete && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 space-y-3">
            <div className="flex items-start gap-2">
              <ShieldCheck
                className="mt-0.5 h-4 w-4 shrink-0 text-amber-800"
                aria-hidden="true"
              />
              <div className="text-xs text-amber-950">
                <p className="font-semibold">
                  Lanjutkan Registrasi: Lengkapi Profil Sekolah &amp; Admin
                </p>
                <p className="mt-0.5 text-amber-900">
                  Akun Firebase Authentication Anda sudah dibuat namun data sekolah belum tersimpan di sesi perangkat ini. Lengkapi data berikut agar proses bootstrap dapat diselesaikan setelah email terverifikasi.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label
                  htmlFor="verify-admin-name"
                  className="block text-xs font-medium text-slate-700"
                >
                  Nama Lengkap Admin Sekolah
                </label>
                <input
                  id="verify-admin-name"
                  type="text"
                  required
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  placeholder="contoh: Budi Hartono, S.Kom."
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label
                  htmlFor="verify-username"
                  className="block text-xs font-medium text-slate-700"
                >
                  Username Admin
                </label>
                <input
                  id="verify-username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase())}
                  placeholder="budi.admin"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono"
                />
              </div>
              <div>
                <label
                  htmlFor="verify-phone"
                  className="block text-xs font-medium text-slate-700"
                >
                  Nomor HP Aktif
                </label>
                <input
                  id="verify-phone"
                  type="tel"
                  required
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="081234567890"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm tabular-nums"
                />
              </div>
              <div className="sm:col-span-2">
                <label
                  htmlFor="verify-school-name"
                  className="block text-xs font-medium text-slate-700"
                >
                  Nama Sekolah
                </label>
                <input
                  id="verify-school-name"
                  type="text"
                  required
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  placeholder="SMA Negeri 1 Nusantara"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label
                  htmlFor="verify-npsn"
                  className="block text-xs font-medium text-slate-700"
                >
                  NPSN (Opsional)
                </label>
                <input
                  id="verify-npsn"
                  type="text"
                  value={npsn}
                  onChange={(e) => setNpsn(e.target.value)}
                  placeholder="8 digit NPSN"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono tabular-nums"
                />
              </div>
              <div>
                <label
                  htmlFor="verify-school-address"
                  className="block text-xs font-medium text-slate-700"
                >
                  Alamat Sekolah
                </label>
                <input
                  id="verify-school-address"
                  type="text"
                  required
                  value={schoolAddress}
                  onChange={(e) => setSchoolAddress(e.target.value)}
                  placeholder="Jl. Pendidikan No. 1"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3 pt-1">
          <button
            type="button"
            disabled={checking || resending || exiting}
            onClick={() => void handleCheckVerification()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#0F4C81] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0C3D68] disabled:opacity-60"
          >
            <RefreshCw
              className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            {checking
              ? 'Memeriksa & Memvalidasi Token...'
              : 'Saya sudah melakukan verifikasi'}
          </button>

          <button
            type="button"
            disabled={resending || checking || exiting || isResendBlocked}
            onClick={() => void handleResend()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#0F4C81] bg-white px-4 py-2.5 text-sm font-semibold text-[#0F4C81] hover:bg-sky-50 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400"
          >
            {isResendBlocked ? (
              <Clock className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Send className="h-4 w-4" aria-hidden="true" />
            )}
            {resending
              ? 'Mengirim Ulang Email...'
              : activeCooldownSeconds > 0
              ? `Kirim ulang email verifikasi (${activeCooldownSeconds}d)`
              : 'Kirim ulang email verifikasi'}
          </button>

          <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
            <span>
              Pembatasan anti-spam: maksimal {RESEND_MAX_ATTEMPTS_PER_WINDOW}x per 15 menit
            </span>
            <span className="font-mono tabular-nums">
              Sisa kuota: {clientLimit.remainingAttemptsInWindow}/{RESEND_MAX_ATTEMPTS_PER_WINDOW}
            </span>
          </div>

          <div className="border-t border-slate-100 pt-3">
            <button
              type="button"
              disabled={exiting || checking}
              onClick={() => void handleExitRegistration()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              {exiting ? 'Keluar...' : 'Keluar dari proses registrasi'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
