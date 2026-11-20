import React, { useState } from 'react';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LogIn,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import { useSims } from '../context/SimsContext';
import {
  validateFirstAdminRegistration,
  validatePasswordStrength,
} from '../utils/authLogic';

type AuthTab = 'login' | 'register_admin';

export const AuthPortalScreen: React.FC = () => {
  const {
    loginWithUsernamePassword,
    registerFirstSchoolAdmin,
  } = useSims();

  const [tab, setTab] = useState<AuthTab>('login');
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPw, setShowLoginPw] = useState(false);
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Admin Sekolah & School Tenant Registration state
  const [adminName, setAdminName] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminConfirmPassword, setAdminConfirmPassword] = useState('');
  const [showRegPw, setShowRegPw] = useState(false);
  const [schoolName, setSchoolName] = useState('');
  const [schoolNpsn, setSchoolNpsn] = useState('');
  const [schoolAddress, setSchoolAddress] = useState('');
  const [regSubmitting, setRegSubmitting] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);

  const pwStrength = validatePasswordStrength(adminPassword);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginSubmitting(true);
    try {
      const res = await loginWithUsernamePassword(loginUsername, loginPassword);
      if (!res.ok) {
        setLoginError(res.error || 'Login gagal. Periksa username dan password Anda.');
      }
    } finally {
      setLoginSubmitting(false);
    }
  };

  const handleRegisterAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);

    const validation = validateFirstAdminRegistration({
      adminName,
      username: adminUsername,
      email: adminEmail,
      phoneNumber: adminPhone,
      password: adminPassword,
      confirmPassword: adminConfirmPassword,
      schoolName,
      npsn: schoolNpsn,
      schoolAddress,
    });
    if (!validation.valid) {
      setRegError(validation.error || 'Data registrasi belum valid.');
      return;
    }

    setRegSubmitting(true);
    try {
      const res = await registerFirstSchoolAdmin({
        adminName,
        username: adminUsername,
        email: adminEmail,
        phoneNumber: adminPhone,
        password: adminPassword,
        confirmPassword: adminConfirmPassword,
        schoolName,
        npsn: schoolNpsn,
        schoolAddress,
      });
      if (!res.ok) {
        setRegError(res.error || 'Gagal mendaftarkan sekolah pertama.');
      }
    } finally {
      setRegSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#0F4C81] text-white">
              <Building2 className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold tracking-tight text-slate-900">
                SIMS Terpadu
              </p>
              <p className="truncate text-xs text-slate-500">
                Sistem Informasi Manajemen Sekolah Multi-Tenant
              </p>
            </div>
          </div>

          <span className="shrink-0 rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-medium text-[#0F4C81] whitespace-nowrap">
            Portal Sekolah Multi-Tenant
          </span>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 gap-8 px-4 py-8 sm:px-6 lg:grid-cols-12 lg:items-start">
        {/* Left column: Security policy & access mode guide */}
        <section className="space-y-5 lg:col-span-5">
          <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#0F4C81]">
                Gerbang Autentikasi Multi-Perangkat
              </p>
              <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900">
                Masuk atau Daftarkan Sekolah
              </h1>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Setiap perangkat bebas memilih untuk masuk ke akun sekolah yang sudah ada atau mendaftarkan sekolah baru sebagai <strong>Admin Sekolah</strong> secara terisolasi per tenant (<span className="font-mono text-xs">schoolId</span>).
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2 text-xs text-slate-700">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-slate-900">Mode Akses Perangkat</span>
                <span className="font-semibold text-emerald-700">
                  Register &amp; Login Tersedia
                </span>
              </div>
              <p className="text-slate-600 leading-relaxed">
                <strong>Daftar Admin Sekolah:</strong> Membuat akun <span className="font-mono">school_admin</span> dan ruang sekolah baru.
                <br />
                <strong>Masuk Akun:</strong> Login menggunakan akun yang sudah ada atau akun buatan Admin Sekolah (Kepala Sekolah, Guru, Staff, Siswa, Orang Tua).
              </p>
            </div>

            <div className="space-y-2.5 border-t border-slate-100 pt-4 text-xs text-slate-600">
              <p className="font-semibold text-slate-900">
                Kebijakan Keamanan &amp; Verifikasi:
              </p>
              <ul className="space-y-1.5">
                <li className="flex items-start gap-2">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#0F4C81]" aria-hidden="true" />
                  <span>
                    <strong>Wajib verifikasi email Admin:</strong> Registrasi Admin Sekolah baru hanya aktif setelah tautan verifikasi email dikonfirmasi &amp; divalidasi di backend.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#0F4C81]" aria-hidden="true" />
                  <span>
                    <strong>Wajib ganti password saat login pertama:</strong> Kepala Sekolah, Guru, dan Staff.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
                  <span>
                    <strong>Langsung akses dashboard:</strong> Siswa, Orang Tua, dan Admin Sekolah (setelah email terverifikasi).
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Right column: Auth Card */}
        <section className="lg:col-span-7">
          <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
            <div
              role="tablist"
              aria-label="Mode Autentikasi"
              className="grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1"
            >
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'login'}
                onClick={() => {
                  setTab('login');
                  setLoginError(null);
                  setRegError(null);
                }}
                className={`inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 py-2 text-center text-xs sm:text-sm font-medium leading-tight transition-colors ${
                  tab === 'login'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LogIn className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Masuk Akun</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'register_admin'}
                onClick={() => {
                  setTab('register_admin');
                  setLoginError(null);
                  setRegError(null);
                }}
                className={`inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 py-2 text-center text-xs sm:text-sm font-medium leading-tight transition-colors ${
                  tab === 'register_admin'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <UserPlus className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Daftar Admin Sekolah</span>
              </button>
            </div>

            {tab === 'login' ? (
              <form onSubmit={handleLoginSubmit} className="mt-6 space-y-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Masuk ke SIMS</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Masukkan username sekolah dan password Anda. Role terdeteksi otomatis setelah verifikasi.
                  </p>
                </div>

                {loginError && (
                  <div
                    role="alert"
                    className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-900"
                  >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />
                    <span>{loginError}</span>
                  </div>
                )}

                <div>
                  <label
                    htmlFor="login-username"
                    className="block text-xs font-medium text-slate-700"
                  >
                    Username
                  </label>
                  <input
                    id="login-username"
                    type="text"
                    autoComplete="username"
                    required
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    placeholder="contoh: budi.admin atau siti.guru"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-[#0F4C81] focus:outline-none focus:ring-1 focus:ring-[#0F4C81]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="login-password"
                    className="block text-xs font-medium text-slate-700"
                  >
                    Password
                  </label>
                  <div className="relative mt-1">
                    <input
                      id="login-password"
                      type={showLoginPw ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Masukkan password"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 pr-10 text-sm focus:border-[#0F4C81] focus:outline-none focus:ring-1 focus:ring-[#0F4C81]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPw((v) => !v)}
                      aria-label={showLoginPw ? 'Sembunyikan password' : 'Lihat password'}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:bg-slate-100"
                    >
                      {showLoginPw ? (
                        <EyeOff className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                  Lupa password? Hubungi <strong>Admin Sekolah</strong> untuk mendapatkan reset password atau tautan pemulihan resmi.
                </div>

                <button
                  type="submit"
                  disabled={loginSubmitting}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#0F4C81] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0C3D68] disabled:opacity-60"
                >
                  <KeyRound className="h-4 w-4" aria-hidden="true" />
                  {loginSubmitting ? 'Memverifikasi Akun...' : 'Masuk dengan Username & Password'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegisterAdminSubmit} className="mt-6 space-y-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Daftar Akun Admin Sekolah &amp; Sekolah Baru
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Pendaftaran membuat akun <strong>Admin Sekolah (school_admin)</strong> dan ruang sekolah baru. Email verifikasi akan dikirim terlebih dahulu; jika pendaftaran belum selesai, isi email &amp; password yang sama untuk melanjutkan verifikasi.
                  </p>
                </div>

                {regError && (
                  <div
                    role="alert"
                    className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-900"
                  >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />
                    <span>{regError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label htmlFor="reg-admin-name" className="block text-xs font-medium text-slate-700">
                      Nama Lengkap Admin Sekolah
                    </label>
                    <input
                      id="reg-admin-name"
                      type="text"
                      required
                      value={adminName}
                      onChange={(e) => setAdminName(e.target.value)}
                      placeholder="contoh: Budi Hartono, S.Kom."
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label htmlFor="reg-username" className="block text-xs font-medium text-slate-700">
                      Username Admin
                    </label>
                    <input
                      id="reg-username"
                      type="text"
                      required
                      value={adminUsername}
                      onChange={(e) => setAdminUsername(e.target.value.toLowerCase())}
                      placeholder="contoh: budi.admin"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                    />
                  </div>

                  <div>
                    <label htmlFor="reg-phone" className="block text-xs font-medium text-slate-700">
                      Nomor HP Aktif
                    </label>
                    <input
                      id="reg-phone"
                      type="tel"
                      required
                      value={adminPhone}
                      onChange={(e) => setAdminPhone(e.target.value)}
                      placeholder="081234567890"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor="reg-email" className="block text-xs font-medium text-slate-700">
                      Email Aktif Admin Sekolah
                    </label>
                    <input
                      id="reg-email"
                      type="email"
                      required
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      placeholder="admin@sekolah.sch.id"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label htmlFor="reg-password" className="block text-xs font-medium text-slate-700">
                      Password
                    </label>
                    <div className="relative mt-1">
                      <input
                        id="reg-password"
                        type={showRegPw ? 'text' : 'password'}
                        required
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        placeholder="Min 8 karakter"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-9 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPw((v) => !v)}
                        aria-label={showRegPw ? 'Sembunyikan password' : 'Lihat password'}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:bg-slate-100"
                      >
                        {showRegPw ? (
                          <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                        ) : (
                          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="reg-confirm-password" className="block text-xs font-medium text-slate-700">
                      Konfirmasi Password
                    </label>
                    <input
                      id="reg-confirm-password"
                      type={showRegPw ? 'text' : 'password'}
                      required
                      value={adminConfirmPassword}
                      onChange={(e) => setAdminConfirmPassword(e.target.value)}
                      placeholder="Ulangi password"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>

                  {adminPassword && (
                    <div className="sm:col-span-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-700">Kekuatan Password</span>
                        <span
                          className={`font-semibold ${
                            pwStrength.valid ? 'text-emerald-700' : 'text-amber-700'
                          }`}
                        >
                          {pwStrength.valid ? 'Memenuhi Standar' : 'Perlu Dilengkapi'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-600 sm:grid-cols-4">
                        <span className={pwStrength.checks.minLength ? 'text-emerald-700 font-medium' : ''}>
                          {pwStrength.checks.minLength ? '✓' : '○'} Min 8 karakter
                        </span>
                        <span className={pwStrength.checks.hasUpper ? 'text-emerald-700 font-medium' : ''}>
                          {pwStrength.checks.hasUpper ? '✓' : '○'} Huruf besar
                        </span>
                        <span className={pwStrength.checks.hasLower ? 'text-emerald-700 font-medium' : ''}>
                          {pwStrength.checks.hasLower ? '✓' : '○'} Huruf kecil
                        </span>
                        <span className={pwStrength.checks.hasNumber ? 'text-emerald-700 font-medium' : ''}>
                          {pwStrength.checks.hasNumber ? '✓' : '○'} Angka
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="sm:col-span-2 border-t border-slate-100 pt-3">
                    <p className="text-xs font-semibold text-slate-900">Identitas Sekolah</p>
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor="reg-school-name" className="block text-xs font-medium text-slate-700">
                      Nama Sekolah
                    </label>
                    <input
                      id="reg-school-name"
                      type="text"
                      required
                      value={schoolName}
                      onChange={(e) => setSchoolName(e.target.value)}
                      placeholder="contoh: SMA Negeri 1 Nusantara"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label htmlFor="reg-npsn" className="block text-xs font-medium text-slate-700">
                      NPSN (Opsional)
                    </label>
                    <input
                      id="reg-npsn"
                      type="text"
                      value={schoolNpsn}
                      onChange={(e) => setSchoolNpsn(e.target.value)}
                      placeholder="8 digit NPSN"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums"
                    />
                  </div>

                  <div>
                    <label htmlFor="reg-school-address" className="block text-xs font-medium text-slate-700">
                      Alamat Sekolah
                    </label>
                    <input
                      id="reg-school-address"
                      type="text"
                      required
                      value={schoolAddress}
                      onChange={(e) => setSchoolAddress(e.target.value)}
                      placeholder="Jl. Pendidikan No. 1, Kota..."
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={regSubmitting}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#0F4C81] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0C3D68] disabled:opacity-60"
                >
                  <UserPlus className="h-4 w-4" aria-hidden="true" />
                  {regSubmitting
                    ? 'Membuat Akun & Mengirim Email Verifikasi...'
                    : 'Daftar & Kirim Email Verifikasi Admin'}
                </button>
              </form>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};
