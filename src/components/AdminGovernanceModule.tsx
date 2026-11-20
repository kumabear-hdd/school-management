import React, { useState } from 'react';
import {
  Database,
  Download,
  FileCode2,
  ShieldCheck,
  Upload,
  UserPlus,
} from 'lucide-react';
import { useSims } from '../context/SimsContext';

import { ROLE_LABELS } from '../utils/authLogic';
import type { NavSection } from './DashboardModule';

type AdminTab = 'ringkasan_rbac' | 'audit_log' | 'keamanan_backup' | 'arsitektur_docs';

interface AdminGovernanceModuleProps {
  onNavigate?: (section: NavSection) => void;
}

export const AdminGovernanceModule: React.FC<AdminGovernanceModuleProps> = ({
  onNavigate,
}) => {
  const {
    data,
    currentUser,
    exportFullBackupJson,
    restoreFullBackupJson,
  } = useSims();

  const [tab, setTab] = useState<AdminTab>('ringkasan_rbac');
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const handleDownloadBackup = () => {
    const json = exportFullBackupJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SIMS_Backup_${data.school.schoolId}_${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setFeedback({ type: 'ok', text: 'File backup JSON berhasil diunduh.' });
  };

  const handleRestoreFile = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    const res = restoreFullBackupJson(text);
    setFeedback(
      res.ok
        ? { type: 'ok', text: 'Pemulihan data dari file backup JSON berhasil.' }
        : { type: 'err', text: res.error || 'Gagal memulihkan backup.' }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Administrasi Sistem, Keamanan, Audit & Dokumentasi
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Pengelolaan akun siswa & orang tua, audit log, arsitektur Firestore, backup/restore, serta panduan operator & kebijakan privasi.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Navigasi Administrasi"
          className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1"
        >
          {(
            [
              ['ringkasan_rbac', 'Ringkasan RBAC & Akun'],
              ['audit_log', 'Audit Log'],
              ['keamanan_backup', 'Keamanan & Backup'],
              ['arsitektur_docs', 'Struktur DB & Panduan'],
            ] as [AdminTab, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => {
                setTab(key);
                setFeedback(null);
              }}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                tab === key
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {feedback && (
        <div
          role="alert"
          className={`rounded-lg border px-4 py-3 text-sm ${
            feedback.type === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-red-200 bg-red-50 text-red-900'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* TAB 1: RINGKASAN RBAC & DIREKTORI AKUN */}
      {tab === 'ringkasan_rbac' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <section className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-5 space-y-4">
            <div className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-[#0F4C81]" aria-hidden="true" />
              <h2 className="text-base font-semibold text-slate-900">
                Pengelolaan Akun Terpusat
              </h2>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Pembuatan akun Kepala Sekolah, Guru, Staff, Siswa, dan Orang Tua (tunggal maupun impor massal Excel/CSV) serta penautan relasi keluarga dikelola melalui menu <strong>Manajemen Pengguna</strong> oleh Admin Sekolah.
            </p>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs space-y-1.5 text-slate-700">
              <p className="font-semibold text-slate-900">Kebijakan Login Pertama:</p>
              <p>• <strong>Wajib ganti password:</strong> Kepala Sekolah, Guru, Staff</p>
              <p>• <strong>Tidak wajib ganti password:</strong> Admin Sekolah, Siswa, Orang Tua</p>
            </div>
            {currentUser.role === 'school_admin' && onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('manajemen_pengguna')}
                className="w-full rounded-lg bg-[#0F4C81] px-4 py-2 text-sm font-medium text-white hover:bg-[#0C3D68]"
              >
                Buka Manajemen Pengguna
              </button>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-7">
            <h2 className="text-base font-semibold text-slate-900">
              Ringkasan Direktori Pengguna ({data.users.length})
            </h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                    <th className="py-2 pr-3">Nama & Username</th>
                    <th className="py-2 pr-3">Peran</th>
                    <th className="py-2">Relasi Kelas / Anak</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.users.map((u) => {
                    const linkedIds =
                      u.linkedStudentIds?.length
                        ? u.linkedStudentIds
                        : u.childStudentId
                        ? [u.childStudentId]
                        : [];
                    return (
                      <tr key={u.uid}>
                        <td className="py-2.5 pr-3">
                          <p className="font-medium text-slate-900">{u.name}</p>
                          <p className="text-xs font-mono text-slate-500">
                            @{u.username} · {u.email}
                          </p>
                        </td>
                        <td className="py-2.5 pr-3 text-xs font-semibold text-slate-700 whitespace-nowrap">
                          {ROLE_LABELS[u.role]}
                        </td>
                        <td className="py-2.5 text-xs text-slate-600">
                          {u.classId
                            ? `Kelas ${
                                data.classes.find((c) => c.id === u.classId)?.name || u.classId
                              }`
                            : linkedIds.length > 0
                            ? `Wali dari ${linkedIds
                                .map((id) => data.users.find((s) => s.uid === id)?.name || id)
                                .join(', ')}`
                            : u.isHomeroomTeacher
                            ? `Wali Kelas ${
                                data.classes.find((c) => c.id === u.homeroomClassId)?.name || ''
                              }`
                            : u.jobTitle || 'Manajemen Sekolah'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* TAB 2: AUDIT LOG */}
      {tab === 'audit_log' && (
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-base font-semibold text-slate-900">
            Audit Log Perubahan Nilai & Status Tugas
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Seluruh perubahan nilai akademik penting dan verifikasi E-Tugas dicatat secara permanen.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                  <th className="py-2.5 pr-4">Waktu</th>
                  <th className="py-2.5 pr-4">Aktor</th>
                  <th className="py-2.5 pr-4">Modul</th>
                  <th className="py-2.5 pr-4">Aksi</th>
                  <th className="py-2.5">Ringkasan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="py-2.5 pr-4 font-mono text-xs text-slate-500 tabular-nums whitespace-nowrap">
                      {log.createdAt.slice(0, 19).replace('T', ' ')}
                    </td>
                    <td className="py-2.5 pr-4 text-xs font-medium text-slate-900">
                      {log.actorName} ({log.actorRole})
                    </td>
                    <td className="py-2.5 pr-4 text-xs text-slate-600">{log.module}</td>
                    <td className="py-2.5 pr-4 font-mono text-xs text-slate-600">
                      {log.action}
                    </td>
                    <td className="py-2.5 text-xs text-slate-700">{log.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB 3: KEAMANAN & BACKUP */}
      {tab === 'keamanan_backup' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-700" aria-hidden="true" />
              <h2 className="text-base font-semibold text-slate-900">
                Audit Keamanan & Firebase Security Rules
              </h2>
            </div>
            <ul className="space-y-2 text-xs text-slate-700 leading-relaxed">
              <li>
                <strong>Isolasi Multi-Tenant (`schoolId`):</strong> Seluruh dokumen Firestore diikat dengan `schoolId` dan validasi ID (`^[a-zA-Z0-9_\-]+$`).
              </li>
              <li>
                <strong>Proteksi E-Tugas:</strong> Siswa hanya dapat mengirim jawaban atas akunnya sendiri pada kelasnya, tidak dapat mengubah status menjadi `approved` atau memodifikasi `teacherFeedback`/`score`.
              </li>
              <li>
                <strong>Riwayat Append-Only:</strong> Koleksi `submission_history` dan `audit_logs` melarang operasi `update` maupun `delete` dari sisi klien.
              </li>
              <li>
                <strong>Satu Siswa Satu Suara OSIS:</strong> Dokumen `osis_votes` memakai kunci deterministik {'`{schoolId}_{uid}`'} dan mengunci penulisan ganda.
              </li>
              <li>
                <strong>Pembatasan Modul:</strong> Tidak terdapat modul E-Rapor, CBT/Ujian Online, Keuangan/Bendahara, maupun Sarpras/Inventaris.
              </li>
            </ul>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-[#0F4C81]" aria-hidden="true" />
              <h2 className="text-base font-semibold text-slate-900">
                Backup & Pemulihan Data Sekolah
              </h2>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Unduh snapshot lengkap database sekolah ({data.school.schoolId}) dalam format JSON untuk cadangan lokal, atau pulihkan data dari file cadangan sebelumnya.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleDownloadBackup}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F4C81] px-4 py-2 text-xs font-medium text-white hover:bg-[#0C3D68]"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                Unduh Backup JSON
              </button>
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">
                <Upload className="h-4 w-4" aria-hidden="true" />
                Pulihkan dari JSON
                <input
                  type="file"
                  accept="application/json"
                  className="sr-only"
                  onChange={(e) => handleRestoreFile(e.target.files?.[0])}
                />
              </label>
            </div>
          </section>
        </div>
      )}

      {/* TAB 4: TINJAUAN STRUKTUR FIRESTORE & DOKUMENTASI */}
      {tab === 'arsitektur_docs' && (
        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-3">
            <div className="flex items-center gap-2">
              <FileCode2 className="h-5 w-5 text-[#0F4C81]" aria-hidden="true" />
              <h2 className="text-base font-semibold text-slate-900">
                Tinjauan Struktur Firestore (Fase 1 → Fase 2–5)
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3 text-xs text-slate-700">
              <div className="rounded-lg border border-slate-200 p-4 space-y-1.5">
                <p className="font-semibold text-slate-900">Digunakan Kembali (Fase 1)</p>
                <p>
                  `schools` (konfigurasi tenant & koordinat geofence), `users` (profil & RBAC), `classes` (anggota siswa & wali kelas), dan `audit_logs` (catatan perubahan).
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 p-4 space-y-1.5">
                <p className="font-semibold text-slate-900">Ditambahkan (Fase 2–4)</p>
                <p>
                  `subjects`, `curriculums`, `teaching_assignments`, `schedules`, `teaching_agendas`, `assessment_components`, `academic_grades`, `assignments`, `assignment_submissions`, `submission_history`, `assignment_notifications`, `ppdb_registrations`, `osis_votes`, `guestbook_entries`, `attendance_records`.
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 p-4 space-y-1.5">
                <p className="font-semibold text-slate-900">Diubah / Diperketat</p>
                <p>
                  `users` diperkaya dengan relasi `classId`, `childStudentId`, dan `homeroomClassId`; `schools` ditambah radius geofence GPS & SSID Wi-Fi resmi untuk Modul Absensi Lanjutan.
                </p>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-2">
              <h3 className="text-sm font-semibold text-slate-900">Dokumentasi Operator</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                1. Kelola master mata pelajaran, kelas, jadwal, dan guru pengampu di Modul Akademik.
                <br />
                2. Verifikasi berkas pendaftar baru pada tab PPDB Online dan perbarui status seleksi.
                <br />
                3. Pantau kunjungan tamu harian melalui Buku Tamu Digital dan lakukan check-out saat tamu selesai.
              </p>
            </section>
            <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-2">
              <h3 className="text-sm font-semibold text-slate-900">
                Dokumentasi Administrator & Deployment
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                1. Pastikan Firebase Firestore, Storage, dan Auth terkonfigurasi melalui `firebase-applet-config.json`.
                <br />
                2. Validasi aturan keamanan dengan ESLint dan deploy `firestore.rules`.
                <br />
                3. Build produksi dengan `npm run build` untuk deployment ke Vercel atau Firebase Hosting.
              </p>
            </section>
            <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-2">
              <h3 className="text-sm font-semibold text-slate-900">Kebijakan Privasi</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Data identitas siswa, foto jawaban E-Tugas, lokasi GPS absensi, dan foto verifikasi wajah hanya digunakan untuk kepentingan operasional pendidikan sekolah pada tenant `schoolId` terkait dan dilindungi oleh kontrol akses berbasis peran (RBAC).
              </p>
            </section>
          </div>
        </div>
      )}
    </div>
  );
};
