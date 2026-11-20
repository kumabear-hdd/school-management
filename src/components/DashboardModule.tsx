import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Camera,
  CheckCircle2,
  ClipboardList,
  Clock,
  MapPin,
  Save,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useSims } from '../context/SimsContext';
import { computeAssignmentRecapStats } from '../utils/assignmentLogic';
import { SchoolLocationMapPicker } from './SchoolLocationMapPicker';

export type NavSection =
  | 'dashboard'
  | 'akademik'
  | 'e_tugas'
  | 'portal'
  | 'absensi'
  | 'manajemen_pengguna'
  | 'administrasi';

interface DashboardModuleProps {
  onNavigate: (section: NavSection) => void;
}

export const DashboardModule: React.FC<DashboardModuleProps> = ({ onNavigate }) => {
  const {
    data,
    currentUser,
    updateSchoolProfile,
    saveSchoolLocation,
    toggleSchoolLocationActive,
    deleteSchoolLocation,
  } = useSims();

  const canManageSettings =
    currentUser.role === 'school_admin' || currentUser.role === 'principal';

  const [showSchoolSettings, setShowSchoolSettings] = useState(
    currentUser.role === 'school_admin'
  );
  const [settingsTab, setSettingsTab] = useState<'identity' | 'location'>('identity');
  const [schoolName, setSchoolName] = useState(data.school.name);
  const [schoolNpsn, setSchoolNpsn] = useState(data.school.npsn);
  const [schoolAddress, setSchoolAddress] = useState(data.school.address);
  const [schoolWifi, setSchoolWifi] = useState(data.school.allowedWifiLabel);
  const [requireEmailVerificationForUsers, setRequireEmailVerificationForUsers] = useState(
    Boolean(data.school.requireEmailVerificationForUsers)
  );
  const [settingsFeedback, setSettingsFeedback] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);

  const parentChildIds =
    currentUser.role === 'parent'
      ? currentUser.linkedStudentIds?.length
        ? currentUser.linkedStudentIds
        : currentUser.childStudentId
        ? [currentUser.childStudentId]
        : []
      : [];
  const [selectedChildId, setSelectedChildId] = useState<string>(parentChildIds[0] || '');

  useEffect(() => {
    setSchoolName(data.school.name);
    setSchoolNpsn(data.school.npsn);
    setSchoolAddress(data.school.address);
    setSchoolWifi(data.school.allowedWifiLabel);
    setRequireEmailVerificationForUsers(Boolean(data.school.requireEmailVerificationForUsers));
  }, [data.school]);

  useEffect(() => {
    if (currentUser.role === 'school_admin') {
      setShowSchoolSettings(true);
    } else {
      setShowSchoolSettings(false);
    }
    setSettingsFeedback(null);
    if (parentChildIds.length > 0 && !parentChildIds.includes(selectedChildId)) {
      setSelectedChildId(parentChildIds[0]);
    }
  }, [currentUser.role, currentUser.uid]);

  const activeCurriculum = data.curriculums.find((c) => c.isActive);
  const recap = computeAssignmentRecapStats({
    assignments: data.assignments,
    submissions: data.submissions,
    classes: data.classes,
  });

  const unreadNotifications = data.notifications.filter(
    (n) => n.recipientId === currentUser.uid && !n.read
  );

  const roleLabels: Record<string, string> = {
    school_admin: 'Dashboard Admin Sekolah',
    principal: 'Dashboard Kepala Sekolah',
    teacher: 'Dashboard Guru',
    staff: 'Dashboard Staff / Tata Usaha',
    student: 'Portal & Dashboard Siswa',
    parent: 'Portal & Dashboard Orang Tua',
  };

  const parentChildren = parentChildIds
    .map((id) => data.users.find((u) => u.uid === id))
    .filter((u): u is NonNullable<typeof u> => Boolean(u));

  const linkedStudent =
    currentUser.role === 'parent'
      ? parentChildren.find((c) => c.uid === selectedChildId) || parentChildren[0] || null
      : currentUser.role === 'student'
      ? currentUser
      : null;

  const studentGrades = linkedStudent
    ? data.academicGrades.filter((g) => g.studentId === linkedStudent.uid)
    : [];

  const studentAvg =
    studentGrades.length > 0
      ? (
          studentGrades.reduce((sum, g) => sum + g.finalScore, 0) /
          studentGrades.length
        ).toFixed(1)
      : '-';

  const teacherSchedules = data.schedules.filter((s) =>
    currentUser.role === 'teacher' ? s.teacherId === currentUser.uid : true
  );

  const classSchedules = linkedStudent
    ? data.schedules.filter((s) => s.classId === linkedStudent.classId)
    : teacherSchedules;

  const pendingVerificationSubs = data.submissions.filter(
    (s) =>
      (s.status === 'submitted' || s.status === 'resubmitted' || s.status === 'late') &&
      (currentUser.role === 'principal' || s.teacherId === currentUser.uid)
  );

  const studentAssignments = linkedStudent
    ? data.assignments.filter(
        (a) => a.classId === linkedStudent.classId && a.status === 'active'
      )
    : [];

  const handleSaveSchoolSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const res = updateSchoolProfile({
      name: schoolName,
      npsn: schoolNpsn,
      address: schoolAddress,
      latitude: data.school.latitude,
      longitude: data.school.longitude,
      geofenceRadiusMeters: data.school.geofenceRadiusMeters,
      allowedWifiLabel: schoolWifi,
      requireEmailVerificationForUsers,
    });
    if (res.ok) {
      setSettingsFeedback({
        type: 'ok',
        text: 'Nama, data identitas, dan kebijakan verifikasi email sekolah berhasil diperbarui.',
      });
    } else {
      setSettingsFeedback({
        type: 'err',
        text: res.error || 'Gagal menyimpan data sekolah.',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header banner */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">
              {data.school.name} · Tenant {data.school.schoolId} ·{' '}
              {activeCurriculum
                ? `${activeCurriculum.name} (${activeCurriculum.academicYear} · ${activeCurriculum.semester})`
                : 'Periode Aktif'}
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
              {roleLabels[currentUser.role] || 'Dashboard SIMS'}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Masuk sebagai <strong className="font-semibold text-slate-900">{currentUser.name}</strong>
              {currentUser.isHomeroomTeacher && currentUser.homeroomClassId
                ? ` · Wali Kelas ${
                    data.classes.find((c) => c.id === currentUser.homeroomClassId)?.name || ''
                  }`
                : ''}
              {linkedStudent && currentUser.role === 'parent'
                ? ` · Memantau: ${linkedStudent.name}`
                : ''}
            </p>
            {currentUser.role === 'parent' && parentChildren.length > 1 && (
              <div className="mt-2 flex items-center gap-2">
                <label htmlFor="dash-child-select" className="text-xs font-medium text-slate-600">
                  Pilih Anak:
                </label>
                <select
                  id="dash-child-select"
                  value={linkedStudent?.uid || ''}
                  onChange={(e) => setSelectedChildId(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium"
                >
                  {parentChildren.map((ch) => (
                    <option key={ch.uid} value={ch.uid}>
                      {ch.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {currentUser.role === 'school_admin' && (
              <button
                type="button"
                onClick={() => onNavigate('manajemen_pengguna')}
                className="inline-flex items-center gap-2 rounded-lg bg-[#0F4C81] px-4 py-2 text-sm font-medium text-white hover:bg-[#0C3D68] whitespace-nowrap"
              >
                <Users className="h-4 w-4" aria-hidden="true" />
                Manajemen Pengguna
              </button>
            )}
            {canManageSettings && (
              <button
                type="button"
                onClick={() => setShowSchoolSettings((prev) => !prev)}
                aria-expanded={showSchoolSettings}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                  showSchoolSettings && currentUser.role !== 'school_admin'
                    ? 'bg-[#0F4C81] text-white hover:bg-[#0C3D68]'
                    : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Settings className="h-4 w-4" aria-hidden="true" />
                Pengaturan Sekolah
              </button>
            )}
            {currentUser.role !== 'staff' && (
              <button
                type="button"
                onClick={() => onNavigate('e_tugas')}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                  currentUser.role === 'school_admin'
                    ? 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    : 'bg-[#0F4C81] text-white hover:bg-[#0C3D68]'
                }`}
              >
                <Camera className="h-4 w-4" aria-hidden="true" />
                {currentUser.role === 'student' ? 'Buka Tugas Foto' : 'Kelola E-Tugas'}
              </button>
            )}
            <button
              type="button"
              onClick={() => onNavigate('akademik')}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
            >
              <BookOpen className="h-4 w-4" aria-hidden="true" />
              Akademik & Nilai
            </button>
          </div>
        </div>
      </div>

      {/* School Settings Menu Panel (school_admin & principal) */}
      {canManageSettings && showSchoolSettings && (
        <section
          aria-label="Pengaturan Nama dan Data Sekolah"
          className="rounded-xl border border-slate-200 bg-white p-6 space-y-5"
        >
          <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2.5">
              <Settings className="h-5 w-5 text-[#0F4C81]" aria-hidden="true" />
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Menu Pengaturan & Data Sekolah
                </h2>
                <p className="text-xs text-slate-500">
                  Kelola identitas sekolah, jaringan Wi-Fi resmi, serta titik lokasi & radius geofence absensi melalui peta interaktif.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Bagian Pengaturan Sekolah">
              <button
                type="button"
                role="tab"
                aria-selected={settingsTab === 'identity'}
                onClick={() => setSettingsTab('identity')}
                className={`rounded-lg px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                  settingsTab === 'identity'
                    ? 'bg-[#0F4C81] text-white'
                    : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                Data Sekolah & Wi-Fi
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={settingsTab === 'location'}
                onClick={() => setSettingsTab('location')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                  settingsTab === 'location'
                    ? 'bg-[#0F4C81] text-white'
                    : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                Lokasi Sekolah ({data.schoolLocations.filter((l) => l.isActive).length} Aktif)
              </button>
            </div>
          </div>

          {settingsTab === 'identity' ? (
            <>
              {settingsFeedback && (
                <div
                  role="alert"
                  className={`rounded-lg border px-4 py-3 text-sm ${
                    settingsFeedback.type === 'ok'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                      : 'border-red-200 bg-red-50 text-red-900'
                  }`}
                >
                  {settingsFeedback.text}
                </div>
              )}

              <form onSubmit={handleSaveSchoolSettings} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="sm:col-span-2">
                  <label htmlFor="school-name-input" className="block text-xs font-medium text-slate-700">
                    Nama Sekolah
                  </label>
                  <input
                    id="school-name-input"
                    type="text"
                    required
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="school-npsn-input" className="block text-xs font-medium text-slate-700">
                    NPSN
                  </label>
                  <input
                    id="school-npsn-input"
                    type="text"
                    required
                    value={schoolNpsn}
                    onChange={(e) => setSchoolNpsn(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="school-address-input" className="block text-xs font-medium text-slate-700">
                    Alamat Utama Sekolah
                  </label>
                  <input
                    id="school-address-input"
                    type="text"
                    required
                    value={schoolAddress}
                    onChange={(e) => setSchoolAddress(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="school-wifi-input" className="block text-xs font-medium text-slate-700">
                    Wi-Fi Resmi Sekolah
                  </label>
                  <input
                    id="school-wifi-input"
                    type="text"
                    required
                    value={schoolWifi}
                    onChange={(e) => setSchoolWifi(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>

                <div className="sm:col-span-2 lg:col-span-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                  <label
                    htmlFor="school-require-email-verification"
                    className="flex items-start gap-3 cursor-pointer"
                  >
                    <input
                      id="school-require-email-verification"
                      type="checkbox"
                      checked={requireEmailVerificationForUsers}
                      onChange={(e) => setRequireEmailVerificationForUsers(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#0F4C81] focus:ring-[#0F4C81]"
                    />
                    <div className="text-xs">
                      <span className="font-semibold text-slate-900">
                        Kebijakan Verifikasi Email untuk Akun Pengguna Lain (Kepala Sekolah, Guru, Staff, Siswa, Orang Tua)
                      </span>
                      <p className="mt-0.5 text-slate-600 leading-relaxed">
                        Admin Sekolah pertama selalu wajib verifikasi email saat registrasi awal. Jika opsi ini diaktifkan, akun lain yang menggunakan alamat email aktif wajib menyelesaikan verifikasi email sebelum masuk Dashboard (akun internal <span className="font-mono">@sims.local</span> tanpa email eksternal dikecualikan agar alur login tetap berjalan).
                      </p>
                    </div>
                  </label>
                </div>

                <div className="sm:col-span-2 lg:col-span-3 flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-xs text-slate-600">
                    <span className="font-semibold text-slate-900">
                      Titik Lokasi &amp; Radius Geofence GPS:
                    </span>{' '}
                    {data.schoolLocations.filter((l) => l.isActive).length} lokasi aktif terdaftar (pusat utama{' '}
                    <span className="font-mono text-slate-800">
                      {data.school.latitude.toFixed(5)}, {data.school.longitude.toFixed(5)}
                    </span>
                    , radius {data.school.geofenceRadiusMeters} m).
                  </div>
                  <button
                    type="button"
                    onClick={() => setSettingsTab('location')}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#0F4C81] bg-white px-3 py-1.5 text-xs font-medium text-[#0F4C81] hover:bg-sky-50 whitespace-nowrap"
                  >
                    <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                    Atur Titik di Peta Interaktif
                  </button>
                </div>

                <div className="sm:col-span-2 lg:col-span-3 flex justify-end pt-1">
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 rounded-lg bg-[#0F4C81] px-4 py-2 text-sm font-medium text-white hover:bg-[#0C3D68]"
                  >
                    <Save className="h-4 w-4" aria-hidden="true" />
                    Simpan Data Sekolah
                  </button>
                </div>
              </form>
            </>
          ) : (
            <SchoolLocationMapPicker
              school={data.school}
              locations={data.schoolLocations}
              onSaveLocation={saveSchoolLocation}
              onToggleActive={toggleSchoolLocationActive}
              onDeleteLocation={deleteSchoolLocation}
            />
          )}
        </section>
      )}

      {/* Role-Specific 4-Column Metric Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {currentUser.role === 'principal' || currentUser.role === 'school_admin' ? (
          <>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-medium text-slate-500">Total Siswa & Kelas</p>
              <p className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
                {data.users.filter((u) => u.role === 'student').length} Siswa
              </p>
              <p className="mt-1 text-xs text-slate-600 tabular-nums">
                Tersebar di {data.classes.length} rombongan belajar
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-medium text-slate-500">Menunggu Verifikasi E-Tugas</p>
              <p className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
                {recap.pendingVerification}
              </p>
              <p className="mt-1 text-xs text-slate-600 tabular-nums">
                {recap.approved} disetujui · {recap.needsRevision} perlu revisi
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-medium text-slate-500">Pendaftar PPDB</p>
              <p className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
                {data.ppdbRegistrations.length}
              </p>
              <p className="mt-1 text-xs text-slate-600 tabular-nums">
                {data.ppdbRegistrations.filter((p) => p.status === 'menunggu').length} menunggu verifikasi
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-medium text-slate-500">Akun Pengguna & Audit</p>
              <p className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
                {data.users.length} Akun
              </p>
              <p className="mt-1 text-xs text-slate-600 tabular-nums">
                {data.auditLogs.length} catatan audit · Multi-tenant {data.school.schoolId}
              </p>
            </div>
          </>
        ) : currentUser.role === 'staff' ? (
          <>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-medium text-slate-500">Antrean Verifikasi PPDB</p>
              <p className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
                {data.ppdbRegistrations.filter((p) => p.status === 'menunggu').length} Berkas
              </p>
              <p className="mt-1 text-xs text-slate-600 tabular-nums">
                Dari total {data.ppdbRegistrations.length} pendaftar
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-medium text-slate-500">Tamu Sedang Berkunjung</p>
              <p className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
                {data.guestbookEntries.filter((g) => g.status === 'bertamu').length} Tamu
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Buku Tamu Digital Tata Usaha
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-medium text-slate-500">Jadwal Pelajaran Aktif</p>
              <p className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
                {data.schedules.length} Sesi
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Administrasi jadwal & rombongan belajar
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-medium text-slate-500">Lokasi Absensi Terdaftar</p>
              <p className="mt-2 text-2xl font-bold text-emerald-700 tabular-nums">
                {data.schoolLocations.filter((l) => l.isActive).length} Titik
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Geofencing GPS & jaringan sekolah
              </p>
            </div>
          </>
        ) : currentUser.role === 'teacher' ? (
          <>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-medium text-slate-500">Mapel & Kelas Diampu</p>
              <p className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
                {data.teachingAssignments.filter((t) => t.teacherId === currentUser.uid).length} Penugasan
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Hak akses nilai & tugas terikat pengampu
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-medium text-slate-500">Perlu Verifikasi Foto</p>
              <p className="mt-2 text-2xl font-bold text-amber-700 tabular-nums">
                {pendingVerificationSubs.length}
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Jawaban siswa menunggu pemeriksaan
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-medium text-slate-500">Agenda Mengajar</p>
              <p className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
                {data.teachingAgendas.filter((a) => a.teacherId === currentUser.uid).length} Jurnal
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Tercatat pada semester aktif
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-medium text-slate-500">Notifikasi Belum Dibaca</p>
              <p className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
                {unreadNotifications.length}
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Aktivitas pengumpulan & revisi tugas
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-medium text-slate-500">Rata-Rata Nilai Akademik</p>
              <p className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">{studentAvg}</p>
              <p className="mt-1 text-xs text-slate-600 tabular-nums">
                Dari {studentGrades.length} mata pelajaran ternilai
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-medium text-slate-500">Tugas Kelas Aktif</p>
              <p className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
                {studentAssignments.length} Tugas
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Kelas{' '}
                {data.classes.find((c) => c.id === linkedStudent?.classId)?.name || '-'}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-medium text-slate-500">Perlu Revisi / Menunggu</p>
              <p className="mt-2 text-2xl font-bold text-amber-700 tabular-nums">
                {
                  data.submissions.filter(
                    (s) =>
                      s.studentId === linkedStudent?.uid &&
                      (s.status === 'revision_requested' || s.status === 'submitted')
                  ).length
                }
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Pantau catatan guru & status verifikasi
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-medium text-slate-500">Kehadiran Tercatat</p>
              <p className="mt-2 text-2xl font-bold text-emerald-700 tabular-nums">
                {
                  data.attendanceRecords.filter((a) => a.userId === linkedStudent?.uid)
                    .length
                }{' '}
                Hari
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Tervalidasi GPS, jaringan & wajah
              </p>
            </div>
          </>
        )}
      </div>

      {/* Main 2-column content grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left column: Schedule / Grades */}
        <div className="space-y-6 lg:col-span-7">
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-[#0F4C81]" aria-hidden="true" />
                <h2 className="text-base font-semibold text-slate-900">
                  {currentUser.role === 'teacher'
                    ? 'Jadwal Mengajar Guru'
                    : 'Jadwal Pelajaran Terkini'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('akademik')}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#0F4C81] hover:underline whitespace-nowrap"
              >
                Lihat Semua
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
            <div className="mt-4 divide-y divide-slate-100">
              {classSchedules.length === 0 ? (
                <p className="py-6 text-sm text-slate-500">Belum ada jadwal terdaftar.</p>
              ) : (
                classSchedules.slice(0, 5).map((item) => {
                  const subj = data.subjects.find((s) => s.id === item.subjectId);
                  const cls = data.classes.find((c) => c.id === item.classId);
                  const teacher = data.users.find((u) => u.uid === item.teacherId);
                  return (
                    <div
                      key={item.id}
                      className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {subj?.name || item.subjectId}
                        </p>
                        <p className="text-xs text-slate-500">
                          {cls?.name} · {teacher?.name} · {item.room}
                        </p>
                      </div>
                      <div className="text-xs font-medium text-slate-700 font-mono tabular-nums">
                        {item.day}, {item.startTime}–{item.endTime}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* If student or parent, show academic grades summary */}
          {linkedStudent && (
            <section className="rounded-xl border border-slate-200 bg-white p-6">
              <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-[#0F4C81]" aria-hidden="true" />
                  <h2 className="text-base font-semibold text-slate-900">
                    Ringkasan Nilai Akademik ({linkedStudent.name})
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('akademik')}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#0F4C81] hover:underline whitespace-nowrap"
                >
                  Rincian Nilai
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                      <th className="py-2 pr-4">Mata Pelajaran</th>
                      <th className="py-2 pr-4 text-right">KKM</th>
                      <th className="py-2 text-right">Nilai Akhir</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {studentGrades.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="py-4 text-slate-500">
                          Belum ada nilai akademik yang dipublikasikan.
                        </td>
                      </tr>
                    ) : (
                      studentGrades.map((grd) => {
                        const subj = data.subjects.find((s) => s.id === grd.subjectId);
                        const passed = grd.finalScore >= (subj?.kkm ?? 75);
                        return (
                          <tr key={grd.id}>
                            <td className="py-2.5 pr-4 font-medium text-slate-900">
                              {subj?.name || grd.subjectId}
                            </td>
                            <td className="py-2.5 pr-4 text-right font-mono tabular-nums text-slate-600">
                              {subj?.kkm ?? 75}
                            </td>
                            <td
                              className={`py-2.5 text-right font-mono font-semibold tabular-nums ${
                                passed ? 'text-emerald-700' : 'text-amber-700'
                              }`}
                            >
                              {grd.finalScore.toFixed(1)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>

        {/* Right column: E-Tugas Queue / Notifications & Quick Actions */}
        <div className="space-y-6 lg:col-span-5">
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-[#0F4C81]" aria-hidden="true" />
                <h2 className="text-base font-semibold text-slate-900">
                  Aktivitas Tugas Online (E-Tugas)
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('e_tugas')}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#0F4C81] hover:underline whitespace-nowrap"
              >
                Buka Modul
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {data.assignments.slice(0, 4).map((asg) => {
                const subj = data.subjects.find((s) => s.id === asg.subjectId);
                const cls = data.classes.find((c) => c.id === asg.classId);
                const subCount = data.submissions.filter(
                  (s) => s.assignmentId === asg.id
                ).length;
                return (
                  <div
                    key={asg.id}
                    className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3 last:border-b-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {asg.title}
                      </p>
                      <p className="text-xs text-slate-500">
                        {subj?.name} · {cls?.name} · Tenggat {asg.dueDate.replace('T', ' ')}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-mono text-slate-600 tabular-nums">
                      {subCount} kumpul
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-base font-semibold text-slate-900">
              Akses Cepat Layanan Sekolah
            </h2>
            <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => onNavigate('portal')}
                className="flex items-center justify-between rounded-lg border border-slate-200 px-3.5 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <span>Portal, PPDB & OSIS</span>
                <Users className="h-4 w-4 text-slate-400" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onNavigate('absensi')}
                className="flex items-center justify-between rounded-lg border border-slate-200 px-3.5 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <span>Absensi GPS & Wajah</span>
                <CheckCircle2 className="h-4 w-4 text-slate-400" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onNavigate('administrasi')}
                className="flex items-center justify-between rounded-lg border border-slate-200 px-3.5 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 sm:col-span-2"
              >
                <span>Audit Log, Keamanan & Backup Data</span>
                <ShieldCheck className="h-4 w-4 text-slate-400" aria-hidden="true" />
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
