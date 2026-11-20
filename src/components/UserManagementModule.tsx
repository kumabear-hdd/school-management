import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  Download,
  Edit3,
  FileSpreadsheet,
  KeyRound,
  Link2,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Unlink,
  Upload,
  UserCheck,
  UserPlus,
  Users,
  UserX,
  X,
} from 'lucide-react';
import { useSims } from '../context/SimsContext';
import {
  ROLE_LABELS,
  generateStrongTempPassword,
  generateUsernameFromName,
  mustChangePasswordForRole,
} from '../utils/authLogic';
import {
  autoFillDraftUsernamesAndPasswords,
  createEmptyDraftRow,
  downloadBulkTemplateCsv,
  downloadBulkTemplateExcel,
  exportBulkImportReportExcel,
  parseBulkImportFile,
  validateBulkUserRows,
  type BulkImportExecutionResult,
  type BulkUserDraftRow,
} from '../utils/bulkUserUtils';
import type { UserAccount, UserRole } from '../types/sims';

type UserMgmtTab = 'directory' | 'create_single' | 'bulk_import' | 'relations' | 'history';

const CREATABLE_ROLES: { value: Exclude<UserRole, 'school_admin'>; label: string }[] = [
  { value: 'principal', label: 'Kepala Sekolah' },
  { value: 'teacher', label: 'Guru' },
  { value: 'staff', label: 'Staff / TU' },
  { value: 'student', label: 'Siswa' },
  { value: 'parent', label: 'Orang Tua / Wali' },
];

export const UserManagementModule: React.FC = () => {
  const {
    data,
    currentUser,
    createSingleUserAccount,
    bulkCreateUsers,
    updateUserAccountProfile,
    toggleUserActiveStatus,
    resetUserPasswordAction,
    deleteUserAccount,
    linkParentAndStudent,
    unlinkParentAndStudent,
  } = useSims();

  const [tab, setTab] = useState<UserMgmtTab>('directory');
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Directory filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [classFilter, setClassFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Modals in Directory
  const [detailUser, setDetailUser] = useState<UserAccount | null>(null);
  const [editUser, setEditUser] = useState<UserAccount | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editClassId, setEditClassId] = useState('');
  const [editJobTitle, setEditJobTitle] = useState('');
  const [confirmAction, setConfirmAction] = useState<{
    type: 'toggle' | 'reset' | 'delete';
    user: UserAccount;
  } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  // Single User Creation state
  const [singleRole, setSingleRole] = useState<Exclude<UserRole, 'school_admin'>>('student');
  const [singleName, setSingleName] = useState('');
  const [singleUsername, setSingleUsername] = useState('');
  const [singlePassword, setSinglePassword] = useState(() => generateStrongTempPassword(10));
  const [singleEmail, setSingleEmail] = useState('');
  const [singlePhone, setSinglePhone] = useState('');
  const [singleNisOrNip, setSingleNisOrNip] = useState('');
  const [singleNisn, setSingleNisn] = useState('');
  const [singleClassId, setSingleClassId] = useState(data.classes[0]?.id || '');
  const [singleEntryYear, setSingleEntryYear] = useState(String(new Date().getFullYear()));
  const [singleParentPhone, setSingleParentPhone] = useState('');
  const [singleJobTitle, setSingleJobTitle] = useState('');
  const [singleDepartment, setSingleDepartment] = useState('');
  const [singleSubjectIds, setSingleSubjectIds] = useState<string[]>([]);
  const [singleTeachingClassIds, setSingleTeachingClassIds] = useState<string[]>([]);
  const [singleLinkedStudentIds, setSingleLinkedStudentIds] = useState<string[]>([]);
  const [singleRelationship, setSingleRelationship] = useState<'Ayah' | 'Ibu' | 'Wali'>('Wali');
  const [singleSubmitting, setSingleSubmitting] = useState(false);
  const [createdCredential, setCreatedCredential] = useState<{
    name: string;
    role: UserRole;
    username: string;
    password: string;
    mustChange: boolean;
  } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Bulk Import state
  const [templateRole, setTemplateRole] = useState<Exclude<UserRole, 'school_admin'> | 'all'>('all');
  const [draftRows, setDraftRows] = useState<BulkUserDraftRow[]>(() => [
    createEmptyDraftRow(1),
    createEmptyDraftRow(2),
  ]);
  const [bulkViewFilter, setBulkViewFilter] = useState<'all' | 'valid' | 'error'>('all');
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  const [bulkResults, setBulkResults] = useState<BulkImportExecutionResult[] | null>(null);

  // Parent-student relation state
  const [relParentUid, setRelParentUid] = useState(
    data.users.find((u) => u.role === 'parent')?.uid || ''
  );
  const [relStudentUid, setRelStudentUid] = useState(
    data.users.find((u) => u.role === 'student')?.uid || ''
  );
  const [relType, setRelType] = useState<'Ayah' | 'Ibu' | 'Wali'>('Ibu');

  const students = useMemo(
    () => data.users.filter((u) => u.role === 'student'),
    [data.users]
  );
  const parents = useMemo(
    () => data.users.filter((u) => u.role === 'parent'),
    [data.users]
  );

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return data.users.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (classFilter !== 'all' && u.classId !== classFilter) return false;
      if (statusFilter === 'active' && !u.isActive) return false;
      if (statusFilter === 'inactive' && u.isActive) return false;
      if (q) {
        const hay = `${u.name} ${u.username} ${u.nis || ''} ${u.nisOrNip || ''} ${u.email}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [data.users, searchQuery, roleFilter, classFilter, statusFilter]);

  const validatedBulkRows = useMemo(
    () =>
      validateBulkUserRows(draftRows, {
        classes: data.classes,
        subjects: data.subjects,
        existingUsers: data.users,
      }),
    [draftRows, data.classes, data.subjects, data.users]
  );

  const validBulkCount = validatedBulkRows.filter((r) => r.valid).length;
  const errorBulkCount = validatedBulkRows.length - validBulkCount;

  if (currentUser.role !== 'school_admin') {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-900">
        Hanya <strong>Admin Sekolah</strong> yang berhak mengelola akun pengguna.
      </div>
    );
  }

  const copyText = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(label);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      setFeedback({ type: 'err', text: 'Gagal menyalin ke clipboard browser.' });
    }
  };

  const openEditModal = (user: UserAccount) => {
    setEditUser(user);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditPhone(user.phoneNumber || '');
    setEditClassId(user.classId || '');
    setEditJobTitle(user.jobTitle || '');
  };

  const handleSaveEditModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    const res = await updateUserAccountProfile(editUser.uid, {
      name: editName.trim(),
      email: editEmail.trim(),
      phoneNumber: editPhone.trim(),
      classId: editUser.role === 'student' ? editClassId : undefined,
      jobTitle: editJobTitle.trim(),
    });
    if (res.ok) {
      setFeedback({ type: 'ok', text: `Profil ${editName.trim()} berhasil diperbarui.` });
      setEditUser(null);
    } else {
      setFeedback({ type: 'err', text: res.error || 'Gagal memperbarui akun.' });
    }
  };

  const executeConfirmAction = async () => {
    if (!confirmAction) return;
    setConfirmBusy(true);
    try {
      const target = confirmAction.user;
      if (confirmAction.type === 'toggle') {
        const res = await toggleUserActiveStatus(target.uid);
        setFeedback(
          res.ok
            ? {
                type: 'ok',
                text: `Akun ${target.name} kini ${target.isActive ? 'Nonaktif' : 'Aktif'}.`,
              }
            : { type: 'err', text: res.error || 'Gagal mengubah status akun.' }
        );
      } else if (confirmAction.type === 'reset') {
        const res = await resetUserPasswordAction(target.uid);
        setFeedback({ type: res.ok ? 'ok' : 'err', text: res.message });
      } else if (confirmAction.type === 'delete') {
        const res = await deleteUserAccount(target.uid);
        setFeedback(
          res.ok
            ? { type: 'ok', text: `Akun ${target.name} berhasil dihapus dari sistem.` }
            : { type: 'err', text: res.error || 'Gagal menghapus akun.' }
        );
      }
      setConfirmAction(null);
    } finally {
      setConfirmBusy(false);
    }
  };

  const handleCreateSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setCreatedCredential(null);
    setSingleSubmitting(true);
    try {
      const res = await createSingleUserAccount({
        role: singleRole,
        name: singleName,
        username: singleUsername,
        password: singlePassword,
        email: singleEmail,
        phoneNumber: singlePhone,
        nisOrNip: singleNisOrNip,
        nis: singleRole === 'student' ? singleNisOrNip : undefined,
        nisn: singleRole === 'student' ? singleNisn : undefined,
        classId: singleRole === 'student' ? singleClassId : undefined,
        entryYear: singleRole === 'student' ? singleEntryYear : undefined,
        parentPhone: singleRole === 'student' ? singleParentPhone : undefined,
        jobTitle: singleJobTitle,
        department: singleDepartment,
        teachingSubjectIds: singleRole === 'teacher' ? singleSubjectIds : undefined,
        teachingClassIds: singleRole === 'teacher' ? singleTeachingClassIds : undefined,
        linkedStudentIds: singleRole === 'parent' ? singleLinkedStudentIds : undefined,
        relationshipType: singleRole === 'parent' ? singleRelationship : undefined,
      });

      if (!res.ok || !res.user) {
        setFeedback({ type: 'err', text: res.error || 'Gagal membuat akun pengguna.' });
        return;
      }

      setCreatedCredential({
        name: res.user.name,
        role: res.user.role,
        username: res.user.username,
        password: res.tempPassword || singlePassword,
        mustChange: res.user.mustChangePassword,
      });
      setFeedback({
        type: 'ok',
        text: `Akun ${ROLE_LABELS[res.user.role]} (${res.user.username}) berhasil dibuat.`,
      });
      setSingleName('');
      setSingleUsername('');
      setSinglePassword(generateStrongTempPassword(10));
      setSingleEmail('');
      setSinglePhone('');
      setSingleNisOrNip('');
      setSingleNisn('');
      setSingleJobTitle('');
      setSingleDepartment('');
      setSingleSubjectIds([]);
      setSingleTeachingClassIds([]);
      setSingleLinkedStudentIds([]);
    } finally {
      setSingleSubmitting(false);
    }
  };

  const handleBulkFileUpload = async (file: File | undefined) => {
    if (!file) return;
    setFeedback(null);
    setBulkResults(null);
    try {
      const parsed = await parseBulkImportFile(file);
      if (parsed.length === 0) {
        setFeedback({
          type: 'err',
          text: 'File kosong atau tidak memiliki baris data yang valid.',
        });
        return;
      }
      setDraftRows(parsed);
      setFeedback({
        type: 'ok',
        text: `${parsed.length} baris berhasil dibaca dari "${file.name}". Periksa pratinjau validasi sebelum eksekusi.`,
      });
    } catch {
      setFeedback({
        type: 'err',
        text: 'Gagal membaca file Excel/CSV. Pastikan memakai template resmi SIMS.',
      });
    }
  };

  const updateDraftCell = (
    rowId: string,
    field: keyof BulkUserDraftRow,
    value: string
  ) => {
    setDraftRows((prev) =>
      prev.map((row) => (row.rowId === rowId ? { ...row, [field]: value } : row))
    );
  };

  const handleExecuteBulkImport = async (sourceType: 'excel_csv' | 'dynamic_table') => {
    const readyRows = validatedBulkRows.filter((r) => r.valid);
    if (readyRows.length === 0) {
      setFeedback({
        type: 'err',
        text: 'Tidak ada baris valid untuk diproses. Perbaiki error validasi terlebih dahulu.',
      });
      return;
    }

    setBulkProgress({ done: 0, total: readyRows.length });
    setBulkResults(null);
    const { results, job } = await bulkCreateUsers({
      rows: readyRows,
      sourceType,
      onProgress: (done, total) => setBulkProgress({ done, total }),
    });
    setBulkProgress(null);
    setBulkResults(results);

    // Keep only failed rows + any previously invalid draft rows in draft table for easy retry
    const failedRowNumbers = new Set(
      results.filter((r) => r.status === 'Gagal').map((r) => r.rowNumber)
    );
    const invalidDrafts = validatedBulkRows
      .filter((r) => !r.valid || failedRowNumbers.has(r.rowNumber))
      .map((r, idx) => ({ ...r, rowNumber: idx + 1 }));
    setDraftRows(invalidDrafts.length > 0 ? invalidDrafts : [createEmptyDraftRow(1)]);

    setFeedback({
      type: job.failedCount === 0 ? 'ok' : 'err',
      text: `Import selesai: ${job.successCount} berhasil, ${job.failedCount} gagal.`,
    });
  };

  const visibleValidatedRows = validatedBulkRows.filter((r) => {
    if (bulkViewFilter === 'valid') return r.valid;
    if (bulkViewFilter === 'error') return !r.valid;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header & Tabs */}
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Manajemen Pengguna Multi-Role & Relasi Keluarga
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Kelola akun Kepala Sekolah, Guru, Staff, Siswa, dan Orang Tua dalam tenant{' '}
              <span className="font-mono font-semibold text-slate-800">
                {data.school.schoolId}
              </span>
              .
            </p>
          </div>
          <div className="text-xs text-slate-600 tabular-nums">
            Total Akun: <strong className="text-slate-900">{data.users.length}</strong> · Aktif:{' '}
            <strong className="text-emerald-700">
              {data.users.filter((u) => u.isActive).length}
            </strong>
          </div>
        </div>

        <div
          role="tablist"
          aria-label="Navigasi Manajemen Pengguna"
          className="inline-flex flex-wrap w-full sm:w-fit items-center gap-1 rounded-lg bg-slate-100 p-1"
        >
          {(
            [
              ['directory', 'Direktori Pengguna'],
              ['create_single', 'Tambah Akun Tunggal'],
              ['bulk_import', 'Import Massal (Excel / Tabel)'],
              ['relations', 'Relasi Orang Tua–Siswa'],
              ['history', 'Riwayat Import'],
            ] as [UserMgmtTab, string][]
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
          className={`flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-xs sm:text-sm ${
            feedback.type === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-red-200 bg-red-50 text-red-900'
          }`}
        >
          <div className="flex items-start gap-2">
            {feedback.type === 'ok' ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            ) : (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            aria-label="Tutup pesan"
            className="text-current opacity-70 hover:opacity-100"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* TAB 1: DIRECTORY */}
      {tab === 'directory' && (
        <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="search"
                aria-label="Cari pengguna berdasarkan nama, username, NIS, atau NIP"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama, username, NIS, NIP, atau email..."
                className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Filter role"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700"
              >
                <option value="all">Semua Role</option>
                <option value="school_admin">Admin Sekolah</option>
                <option value="principal">Kepala Sekolah</option>
                <option value="teacher">Guru</option>
                <option value="staff">Staff / TU</option>
                <option value="student">Siswa</option>
                <option value="parent">Orang Tua / Wali</option>
              </select>

              <select
                aria-label="Filter kelas"
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700"
              >
                <option value="all">Semua Kelas</option>
                {data.classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              <select
                aria-label="Filter status akun"
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')
                }
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700"
              >
                <option value="all">Semua Status</option>
                <option value="active">Aktif</option>
                <option value="inactive">Nonaktif</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                  <th className="py-2.5 pr-3">Pengguna</th>
                  <th className="py-2.5 pr-3">Username</th>
                  <th className="py-2.5 pr-3">Role</th>
                  <th className="py-2.5 pr-3">Kelas / Relasi</th>
                  <th className="py-2.5 pr-3">Status</th>
                  <th className="py-2.5 pr-3">Password Pertama</th>
                  <th className="py-2.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-xs text-slate-500">
                      Tidak ada pengguna yang cocok dengan filter pencarian.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const clsName = u.classId
                      ? data.classes.find((c) => c.id === u.classId)?.name || u.classId
                      : null;
                    const linkedNames =
                      u.role === 'parent'
                        ? (u.linkedStudentIds || (u.childStudentId ? [u.childStudentId] : []))
                            .map((id) => data.users.find((s) => s.uid === id)?.name || id)
                            .join(', ')
                        : null;

                    return (
                      <tr key={u.uid} className={!u.isActive ? 'bg-slate-50/70 opacity-75' : ''}>
                        <td className="py-3 pr-3">
                          <p className="font-medium text-slate-900">{u.name}</p>
                          <p className="text-xs text-slate-500 font-mono">
                            {u.nis || u.nisOrNip || u.email}
                          </p>
                        </td>
                        <td className="py-3 pr-3 font-mono text-xs text-slate-800">
                          {u.username}
                        </td>
                        <td className="py-3 pr-3 text-xs font-semibold text-slate-700 whitespace-nowrap">
                          {ROLE_LABELS[u.role]}
                        </td>
                        <td className="py-3 pr-3 text-xs text-slate-600">
                          {clsName
                            ? `Kelas ${clsName}`
                            : linkedNames
                            ? `Wali dari: ${linkedNames}`
                            : u.jobTitle || (u.isHomeroomTeacher ? 'Wali Kelas' : '-')}
                        </td>
                        <td className="py-3 pr-3 text-xs font-semibold whitespace-nowrap">
                          <span className={u.isActive ? 'text-emerald-700' : 'text-red-700'}>
                            {u.isActive ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </td>
                        <td className="py-3 pr-3 text-xs whitespace-nowrap">
                          {u.mustChangePassword ? (
                            <span className="font-semibold text-amber-700">
                              Wajib ganti saat login
                            </span>
                          ) : (
                            <span className="text-slate-600">Siap digunakan</span>
                          )}
                        </td>
                        <td className="py-3 text-right">
                          <div className="inline-flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => setDetailUser(u)}
                              className="rounded border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              Detail
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditModal(u)}
                              title="Edit Profil"
                              aria-label={`Edit ${u.name}`}
                              className="rounded border border-slate-200 p-1 text-slate-600 hover:bg-slate-50"
                            >
                              <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                            {u.uid !== currentUser.uid && u.role !== 'school_admin' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setConfirmAction({ type: 'reset', user: u })}
                                  title="Reset Password"
                                  aria-label={`Reset password ${u.name}`}
                                  className="rounded border border-slate-200 p-1 text-slate-600 hover:bg-slate-50"
                                >
                                  <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmAction({ type: 'toggle', user: u })}
                                  title={u.isActive ? 'Nonaktifkan Akun' : 'Aktifkan Akun'}
                                  aria-label={
                                    u.isActive ? `Nonaktifkan ${u.name}` : `Aktifkan ${u.name}`
                                  }
                                  className="rounded border border-slate-200 p-1 text-slate-600 hover:bg-slate-50"
                                >
                                  {u.isActive ? (
                                    <UserX className="h-3.5 w-3.5 text-amber-700" aria-hidden="true" />
                                  ) : (
                                    <UserCheck className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmAction({ type: 'delete', user: u })}
                                  title="Hapus Akun"
                                  aria-label={`Hapus ${u.name}`}
                                  className="rounded border border-red-200 p-1 text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                </button>
                              </>
                            )}
                          </div>
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

      {/* TAB 2: CREATE SINGLE USER */}
      {tab === 'create_single' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <section className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-8">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
              <UserPlus className="h-5 w-5 text-[#0F4C81]" aria-hidden="true" />
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Buat Akun Pengguna Tunggal
                </h2>
                <p className="text-xs text-slate-500">
                  {mustChangePasswordForRole(singleRole)
                    ? `Role ${ROLE_LABELS[singleRole]} otomatis wajib mengganti password sementara saat login pertama.`
                    : `Role ${ROLE_LABELS[singleRole]} dapat langsung menggunakan password awal tanpa paksaan ganti password.`}
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateSingleSubmit} className="mt-5 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="single-role" className="block text-xs font-medium text-slate-700">
                    Role Pengguna
                  </label>
                  <select
                    id="single-role"
                    value={singleRole}
                    onChange={(e) =>
                      setSingleRole(e.target.value as Exclude<UserRole, 'school_admin'>)
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    {CREATABLE_ROLES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="single-name" className="block text-xs font-medium text-slate-700">
                    Nama Lengkap
                  </label>
                  <input
                    id="single-name"
                    type="text"
                    required
                    value={singleName}
                    onChange={(e) => setSingleName(e.target.value)}
                    placeholder="Nama lengkap sesuai data sekolah"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label htmlFor="single-username" className="block text-xs font-medium text-slate-700">
                      Username Login
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setSingleUsername(
                          generateUsernameFromName(
                            singleName || 'pengguna',
                            data.users.map((u) => u.usernameKey)
                          )
                        )
                      }
                      className="text-[11px] font-medium text-[#0F4C81] hover:underline"
                    >
                      Generate otomatis
                    </button>
                  </div>
                  <input
                    id="single-username"
                    type="text"
                    required
                    value={singleUsername}
                    onChange={(e) => setSingleUsername(e.target.value.toLowerCase())}
                    placeholder="contoh: andi.guru"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label htmlFor="single-password" className="block text-xs font-medium text-slate-700">
                      Password Sementara
                    </label>
                    <button
                      type="button"
                      onClick={() => setSinglePassword(generateStrongTempPassword(10))}
                      className="text-[11px] font-medium text-[#0F4C81] hover:underline"
                    >
                      Acak Password Kuat
                    </button>
                  </div>
                  <input
                    id="single-password"
                    type="text"
                    required
                    value={singlePassword}
                    onChange={(e) => setSinglePassword(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                  />
                </div>

                <div>
                  <label htmlFor="single-email" className="block text-xs font-medium text-slate-700">
                    Email (Opsional untuk siswa/ortu)
                  </label>
                  <input
                    id="single-email"
                    type="email"
                    value={singleEmail}
                    onChange={(e) => setSingleEmail(e.target.value)}
                    placeholder="nama@sekolah.sch.id"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="single-phone" className="block text-xs font-medium text-slate-700">
                    Nomor HP
                  </label>
                  <input
                    id="single-phone"
                    type="tel"
                    value={singlePhone}
                    onChange={(e) => setSinglePhone(e.target.value)}
                    placeholder="0812..."
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums"
                  />
                </div>

                {(singleRole === 'principal' ||
                  singleRole === 'teacher' ||
                  singleRole === 'staff') && (
                  <>
                    <div>
                      <label htmlFor="single-nip" className="block text-xs font-medium text-slate-700">
                        NIP / NUPTK / ID Pegawai
                      </label>
                      <input
                        id="single-nip"
                        type="text"
                        required
                        value={singleNisOrNip}
                        onChange={(e) => setSingleNisOrNip(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums"
                      />
                    </div>
                    <div>
                      <label htmlFor="single-job" className="block text-xs font-medium text-slate-700">
                        Jabatan / Bagian
                      </label>
                      <input
                        id="single-job"
                        type="text"
                        value={singleJobTitle}
                        onChange={(e) => setSingleJobTitle(e.target.value)}
                        placeholder={
                          singleRole === 'staff'
                            ? 'contoh: Staf Tata Usaha / Kurikulum'
                            : 'contoh: Guru Matematika'
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                  </>
                )}

                {singleRole === 'staff' && (
                  <div className="sm:col-span-2">
                    <label htmlFor="single-dept" className="block text-xs font-medium text-slate-700">
                      Unit Kerja / Bagian Staff
                    </label>
                    <input
                      id="single-dept"
                      type="text"
                      value={singleDepartment}
                      onChange={(e) => setSingleDepartment(e.target.value)}
                      placeholder="Tata Usaha, PPDB, Layanan Tamu"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                )}

                {singleRole === 'teacher' && (
                  <div className="sm:col-span-2 grid grid-cols-1 gap-4 sm:grid-cols-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div>
                      <p className="text-xs font-semibold text-slate-800 mb-2">
                        Mata Pelajaran Diampu
                      </p>
                      <div className="max-h-32 overflow-y-auto space-y-1.5">
                        {data.subjects.map((subj) => (
                          <label key={subj.id} className="flex items-center gap-2 text-xs text-slate-700">
                            <input
                              type="checkbox"
                              checked={singleSubjectIds.includes(subj.id)}
                              onChange={(e) =>
                                setSingleSubjectIds((prev) =>
                                  e.target.checked
                                    ? [...prev, subj.id]
                                    : prev.filter((id) => id !== subj.id)
                                )
                              }
                            />
                            <span>
                              {subj.code} · {subj.name}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-800 mb-2">
                        Kelas Diajar
                      </p>
                      <div className="max-h-32 overflow-y-auto space-y-1.5">
                        {data.classes.map((cls) => (
                          <label key={cls.id} className="flex items-center gap-2 text-xs text-slate-700">
                            <input
                              type="checkbox"
                              checked={singleTeachingClassIds.includes(cls.id)}
                              onChange={(e) =>
                                setSingleTeachingClassIds((prev) =>
                                  e.target.checked
                                    ? [...prev, cls.id]
                                    : prev.filter((id) => id !== cls.id)
                                )
                              }
                            />
                            <span>{cls.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {singleRole === 'student' && (
                  <>
                    <div>
                      <label htmlFor="single-nis" className="block text-xs font-medium text-slate-700">
                        NIS (Nomor Induk Siswa)
                      </label>
                      <input
                        id="single-nis"
                        type="text"
                        required
                        value={singleNisOrNip}
                        onChange={(e) => setSingleNisOrNip(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums"
                      />
                    </div>
                    <div>
                      <label htmlFor="single-nisn" className="block text-xs font-medium text-slate-700">
                        NISN
                      </label>
                      <input
                        id="single-nisn"
                        type="text"
                        value={singleNisn}
                        onChange={(e) => setSingleNisn(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums"
                      />
                    </div>
                    <div>
                      <label htmlFor="single-class" className="block text-xs font-medium text-slate-700">
                        Kelas Tujuan
                      </label>
                      <select
                        id="single-class"
                        value={singleClassId}
                        onChange={(e) => setSingleClassId(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      >
                        {data.classes.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="single-year" className="block text-xs font-medium text-slate-700">
                        Tahun Masuk / No. HP Ortu
                      </label>
                      <div className="mt-1 grid grid-cols-2 gap-2">
                        <input
                          id="single-year"
                          type="text"
                          value={singleEntryYear}
                          onChange={(e) => setSingleEntryYear(e.target.value)}
                          placeholder="2026"
                          className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm tabular-nums"
                        />
                        <input
                          type="tel"
                          aria-label="Nomor HP Orang Tua"
                          value={singleParentPhone}
                          onChange={(e) => setSingleParentPhone(e.target.value)}
                          placeholder="HP Ortu"
                          className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm tabular-nums"
                        />
                      </div>
                    </div>
                  </>
                )}

                {singleRole === 'parent' && (
                  <div className="sm:col-span-2 rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs font-semibold text-slate-800">
                        Hubungkan ke Siswa (Anak)
                      </p>
                      <select
                        aria-label="Hubungan keluarga"
                        value={singleRelationship}
                        onChange={(e) =>
                          setSingleRelationship(e.target.value as 'Ayah' | 'Ibu' | 'Wali')
                        }
                        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                      >
                        <option value="Ayah">Ayah</option>
                        <option value="Ibu">Ibu</option>
                        <option value="Wali">Wali</option>
                      </select>
                    </div>
                    <div className="max-h-36 overflow-y-auto grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                      {students.map((st) => {
                        const clsName =
                          data.classes.find((c) => c.id === st.classId)?.name || '-';
                        return (
                          <label key={st.uid} className="flex items-center gap-2 text-xs text-slate-700">
                            <input
                              type="checkbox"
                              checked={singleLinkedStudentIds.includes(st.uid)}
                              onChange={(e) =>
                                setSingleLinkedStudentIds((prev) =>
                                  e.target.checked
                                    ? [...prev, st.uid]
                                    : prev.filter((id) => id !== st.uid)
                                )
                              }
                            />
                            <span>
                              {st.name} ({clsName})
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={singleSubmitting}
                className="inline-flex items-center gap-2 rounded-lg bg-[#0F4C81] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0C3D68] disabled:opacity-60"
              >
                <UserPlus className="h-4 w-4" aria-hidden="true" />
                {singleSubmitting ? 'Membuat Akun...' : 'Buat Akun & Terbitkan Kredensial'}
              </button>
            </form>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-4 space-y-4">
            <h2 className="text-base font-semibold text-slate-900">
              Kartu Kredensial Sementara
            </h2>
            {!createdCredential ? (
              <p className="text-xs text-slate-500 leading-relaxed">
                Setelah akun dibuat, kredensial sementara (username & password awal) akan ditampilkan di sini satu kali agar dapat dibagikan kepada pengguna. Password tidak pernah disimpan di Firestore.
              </p>
            ) : (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 space-y-3">
                <div>
                  <p className="text-xs font-semibold text-emerald-900">
                    {createdCredential.name}
                  </p>
                  <p className="text-[11px] text-emerald-800">
                    Role: {ROLE_LABELS[createdCredential.role]}
                  </p>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between rounded bg-white px-3 py-2 border border-emerald-200">
                    <div>
                      <span className="block text-[10px] text-slate-500">Username</span>
                      <span className="font-mono font-semibold text-slate-900">
                        {createdCredential.username}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => void copyText('user', createdCredential.username)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-[#0F4C81]"
                    >
                      {copiedKey === 'user' ? (
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      {copiedKey === 'user' ? 'Tersalin' : 'Salin'}
                    </button>
                  </div>

                  <div className="flex items-center justify-between rounded bg-white px-3 py-2 border border-emerald-200">
                    <div>
                      <span className="block text-[10px] text-slate-500">Password Awal</span>
                      <span className="font-mono font-semibold text-slate-900">
                        {createdCredential.password}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => void copyText('pw', createdCredential.password)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-[#0F4C81]"
                    >
                      {copiedKey === 'pw' ? (
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      {copiedKey === 'pw' ? 'Tersalin' : 'Salin'}
                    </button>
                  </div>
                </div>

                <p className="text-[11px] text-emerald-900">
                  {createdCredential.mustChange
                    ? 'Pengguna ini WAJIB mengganti password pada login pertama.'
                    : 'Pengguna ini tidak dipaksa mengganti password saat login pertama.'}
                </p>
              </div>
            )}
          </section>
        </div>
      )}

      {/* TAB 3: BULK IMPORT */}
      {tab === 'bulk_import' && (
        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Import Massal via Excel / CSV atau Tabel Input Dinamis
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Unduh template resmi, unggah file `.xlsx`/`.csv`, atau tambah baris langsung di tabel. Sistem memvalidasi duplikasi username, NIS/NISN, kelas, dan siswa terhubung sebelum akun dibuat.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label="Pilih role template"
                  value={templateRole}
                  onChange={(e) =>
                    setTemplateRole(
                      e.target.value as Exclude<UserRole, 'school_admin'> | 'all'
                    )
                  }
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium"
                >
                  <option value="all">Template Semua Role</option>
                  <option value="student">Template Siswa</option>
                  <option value="teacher">Template Guru</option>
                  <option value="staff">Template Staff</option>
                  <option value="principal">Template Kepala Sekolah</option>
                  <option value="parent">Template Orang Tua</option>
                </select>
                <button
                  type="button"
                  onClick={() => downloadBulkTemplateExcel(templateRole, data.classes)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" />
                  Template Excel
                </button>
                <button
                  type="button"
                  onClick={() => downloadBulkTemplateCsv(templateRole, data.classes)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  Template CSV
                </button>
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#0F4C81] px-3 py-2 text-xs font-semibold text-white hover:bg-[#0C3D68] whitespace-nowrap">
                  <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                  Unggah Excel / CSV
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="sr-only"
                    onChange={(e) => void handleBulkFileUpload(e.target.files?.[0])}
                  />
                </label>
              </div>
            </div>

            {/* Dynamic Table Controls & Validation Summary */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setDraftRows((prev) => [
                      ...prev,
                      createEmptyDraftRow(prev.length + 1),
                    ])
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  Tambah Baris
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setDraftRows((prev) =>
                      autoFillDraftUsernamesAndPasswords(prev, data.users)
                    )
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  Auto-Generate Username & Password
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs tabular-nums">
                <button
                  type="button"
                  onClick={() => setBulkViewFilter('all')}
                  className={`rounded-md px-2.5 py-1 font-medium ${
                    bulkViewFilter === 'all'
                      ? 'bg-slate-900 text-white'
                      : 'border border-slate-200 text-slate-600'
                  }`}
                >
                  Semua ({validatedBulkRows.length})
                </button>
                <button
                  type="button"
                  onClick={() => setBulkViewFilter('valid')}
                  className={`rounded-md px-2.5 py-1 font-medium ${
                    bulkViewFilter === 'valid'
                      ? 'bg-emerald-700 text-white'
                      : 'border border-emerald-200 text-emerald-800'
                  }`}
                >
                  Siap Eksekusi ({validBulkCount})
                </button>
                <button
                  type="button"
                  onClick={() => setBulkViewFilter('error')}
                  className={`rounded-md px-2.5 py-1 font-medium ${
                    bulkViewFilter === 'error'
                      ? 'bg-red-700 text-white'
                      : 'border border-red-200 text-red-800'
                  }`}
                >
                  Perlu Perbaikan ({errorBulkCount})
                </button>
              </div>
            </div>

            {/* Editable Preview & Validation Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="p-2">#</th>
                    <th className="p-2">Role</th>
                    <th className="p-2">Nama Lengkap</th>
                    <th className="p-2">Username</th>
                    <th className="p-2">Password Awal</th>
                    <th className="p-2">NIS / NIP</th>
                    <th className="p-2">Kelas (Siswa)</th>
                    <th className="p-2">Siswa Terhubung (Ortu)</th>
                    <th className="p-2">Status Validasi</th>
                    <th className="p-2 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleValidatedRows.map((row) => (
                    <tr key={row.rowId} className={row.valid ? '' : 'bg-red-50/40'}>
                      <td className="p-2 font-mono tabular-nums text-slate-500">
                        {row.rowNumber}
                      </td>
                      <td className="p-2">
                        <select
                          aria-label={`Role baris ${row.rowNumber}`}
                          value={row.roleInput}
                          onChange={(e) =>
                            updateDraftCell(row.rowId, 'roleInput', e.target.value)
                          }
                          className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                        >
                          <option value="student">student</option>
                          <option value="teacher">teacher</option>
                          <option value="staff">staff</option>
                          <option value="principal">principal</option>
                          <option value="parent">parent</option>
                        </select>
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={row.name}
                          onChange={(e) =>
                            updateDraftCell(row.rowId, 'name', e.target.value)
                          }
                          placeholder="Nama lengkap"
                          className="w-36 rounded border border-slate-300 px-2 py-1 text-xs"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={row.username}
                          onChange={(e) =>
                            updateDraftCell(
                              row.rowId,
                              'username',
                              e.target.value.toLowerCase()
                            )
                          }
                          placeholder="username"
                          className="w-28 rounded border border-slate-300 px-2 py-1 text-xs font-mono"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={row.password}
                          onChange={(e) =>
                            updateDraftCell(row.rowId, 'password', e.target.value)
                          }
                          placeholder="Password"
                          className="w-28 rounded border border-slate-300 px-2 py-1 text-xs font-mono"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={row.nisOrNip}
                          onChange={(e) =>
                            updateDraftCell(row.rowId, 'nisOrNip', e.target.value)
                          }
                          placeholder="NIS/NIP"
                          className="w-28 rounded border border-slate-300 px-2 py-1 text-xs font-mono"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={row.classInput}
                          onChange={(e) =>
                            updateDraftCell(row.rowId, 'classInput', e.target.value)
                          }
                          placeholder={data.classes[0]?.name || 'XI IPA 1'}
                          className="w-24 rounded border border-slate-300 px-2 py-1 text-xs"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={row.linkedStudentInput}
                          onChange={(e) =>
                            updateDraftCell(row.rowId, 'linkedStudentInput', e.target.value)
                          }
                          placeholder="NIS siswa"
                          className="w-28 rounded border border-slate-300 px-2 py-1 text-xs"
                        />
                      </td>
                      <td className="p-2 min-w-[200px]">
                        {row.valid ? (
                          <span className="font-semibold text-emerald-700">
                            Valid {row.mustChangePassword ? '(Wajib ganti pw awal)' : ''}
                          </span>
                        ) : (
                          <ul className="space-y-0.5 text-[11px] text-red-700">
                            {row.errors.map((err, i) => (
                              <li key={i}>• {err}</li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td className="p-2 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() =>
                            setDraftRows((prev) => [
                              ...prev,
                              {
                                ...row,
                                rowId: `dup-${Date.now()}`,
                                rowNumber: prev.length + 1,
                                username: row.username ? `${row.username}2` : '',
                              },
                            ])
                          }
                          title="Duplikat baris"
                          className="mr-1 rounded border border-slate-200 px-1.5 py-1 text-[11px] text-slate-600 hover:bg-slate-50"
                        >
                          Duplikat
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setDraftRows((prev) =>
                              prev
                                .filter((r) => r.rowId !== row.rowId)
                                .map((r, idx) => ({ ...r, rowNumber: idx + 1 }))
                            )
                          }
                          title="Hapus baris"
                          className="rounded border border-red-200 px-1.5 py-1 text-[11px] text-red-700 hover:bg-red-50"
                        >
                          Hapus
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {bulkProgress && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-700">
                  <span>Membuat akun pengguna...</span>
                  <span className="font-mono tabular-nums">
                    {bulkProgress.done} / {bulkProgress.total}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full bg-[#0F4C81] transition-all"
                    style={{
                      width: `${Math.round(
                        (bulkProgress.done / Math.max(1, bulkProgress.total)) * 100
                      )}%`,
                    }}
                  />
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <p className="text-xs text-slate-500">
                Baris dengan error tidak akan diproses dan tetap tersedia di tabel untuk perbaikan ulang.
              </p>
              <button
                type="button"
                disabled={validBulkCount === 0 || !!bulkProgress}
                onClick={() => void handleExecuteBulkImport('dynamic_table')}
                className="inline-flex items-center gap-2 rounded-lg bg-[#0F4C81] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0C3D68] disabled:opacity-50"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                Proses {validBulkCount} Baris Valid Sekarang
              </button>
            </div>
          </section>

          {bulkResults && (
            <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    Hasil Eksekusi Import ({bulkResults.length} Baris)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Unduh laporan hasil import untuk membagikan kredensial sementara secara aman.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => exportBulkImportReportExcel(bulkResults)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  Unduh Laporan Hasil (.xlsx)
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2 pr-3">Baris</th>
                      <th className="py-2 pr-3">Nama</th>
                      <th className="py-2 pr-3">Role</th>
                      <th className="py-2 pr-3">Username</th>
                      <th className="py-2 pr-3">Password Sementara</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2">Keterangan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {bulkResults.map((res, idx) => (
                      <tr key={idx}>
                        <td className="py-2 pr-3 font-mono tabular-nums">{res.rowNumber}</td>
                        <td className="py-2 pr-3 font-medium text-slate-900">{res.name}</td>
                        <td className="py-2 pr-3">{res.roleLabel}</td>
                        <td className="py-2 pr-3 font-mono">{res.username}</td>
                        <td className="py-2 pr-3 font-mono">
                          {res.status === 'Berhasil' ? res.tempPassword : '-'}
                        </td>
                        <td className="py-2 pr-3 font-semibold">
                          <span
                            className={
                              res.status === 'Berhasil' ? 'text-emerald-700' : 'text-red-700'
                            }
                          >
                            {res.status}
                          </span>
                        </td>
                        <td className="py-2 text-slate-600">{res.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}

      {/* TAB 4: PARENT-STUDENT RELATIONS */}
      {tab === 'relations' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <section className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-5 space-y-4">
            <div className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-[#0F4C81]" aria-hidden="true" />
              <h2 className="text-base font-semibold text-slate-900">
                Hubungkan Orang Tua & Siswa
              </h2>
            </div>
            <p className="text-xs text-slate-500">
              Orang Tua hanya dapat melihat nilai akademik, E-Tugas, dan absensi siswa yang ditautkan di sini.
            </p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const res = await linkParentAndStudent({
                  parentUid: relParentUid,
                  studentUid: relStudentUid,
                  relationship: relType,
                });
                setFeedback(
                  res.ok
                    ? { type: 'ok', text: 'Relasi Orang Tua–Siswa berhasil disimpan.' }
                    : { type: 'err', text: res.error || 'Gagal menyimpan relasi.' }
                );
              }}
              className="space-y-3"
            >
              <div>
                <label htmlFor="rel-parent" className="block text-xs font-medium text-slate-700">
                  Akun Orang Tua / Wali
                </label>
                <select
                  id="rel-parent"
                  value={relParentUid}
                  onChange={(e) => setRelParentUid(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {parents.map((p) => (
                    <option key={p.uid} value={p.uid}>
                      {p.name} ({p.username})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="rel-student" className="block text-xs font-medium text-slate-700">
                  Akun Siswa
                </label>
                <select
                  id="rel-student"
                  value={relStudentUid}
                  onChange={(e) => setRelStudentUid(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {students.map((s) => (
                    <option key={s.uid} value={s.uid}>
                      {s.name} ({data.classes.find((c) => c.id === s.classId)?.name || '-'})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="rel-type" className="block text-xs font-medium text-slate-700">
                  Hubungan
                </label>
                <select
                  id="rel-type"
                  value={relType}
                  onChange={(e) => setRelType(e.target.value as 'Ayah' | 'Ibu' | 'Wali')}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="Ayah">Ayah</option>
                  <option value="Ibu">Ibu</option>
                  <option value="Wali">Wali</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={!relParentUid || !relStudentUid}
                className="w-full rounded-lg bg-[#0F4C81] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0C3D68] disabled:opacity-50"
              >
                Simpan Relasi
              </button>
            </form>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-7 space-y-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-[#0F4C81]" aria-hidden="true" />
              <h2 className="text-base font-semibold text-slate-900">
                Daftar Relasi Orang Tua–Siswa ({data.parentStudentRelations.length})
              </h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                    <th className="py-2 pr-3">Orang Tua / Wali</th>
                    <th className="py-2 pr-3">Hubungan</th>
                    <th className="py-2 pr-3">Siswa</th>
                    <th className="py-2 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.parentStudentRelations.map((rel) => {
                    const parent = data.users.find((u) => u.uid === rel.parentUid);
                    const student = data.users.find((u) => u.uid === rel.studentUid);
                    const cls = data.classes.find((c) => c.id === student?.classId);
                    return (
                      <tr key={rel.id}>
                        <td className="py-2.5 pr-3">
                          <p className="font-medium text-slate-900">
                            {parent?.name || rel.parentUid}
                          </p>
                          <p className="text-xs font-mono text-slate-500">
                            {parent?.username || '-'}
                          </p>
                        </td>
                        <td className="py-2.5 pr-3 text-xs font-semibold text-slate-700">
                          {rel.relationship}
                        </td>
                        <td className="py-2.5 pr-3">
                          <p className="font-medium text-slate-900">
                            {student?.name || rel.studentUid}
                          </p>
                          <p className="text-xs text-slate-500">
                            {cls?.name || '-'} · NIS {student?.nis || '-'}
                          </p>
                        </td>
                        <td className="py-2.5 text-right">
                          <button
                            type="button"
                            onClick={async () => {
                              const res = await unlinkParentAndStudent(rel.id);
                              setFeedback(
                                res.ok
                                  ? { type: 'ok', text: 'Relasi berhasil dilepas.' }
                                  : { type: 'err', text: res.error || 'Gagal melepas relasi.' }
                              );
                            }}
                            className="inline-flex items-center gap-1 rounded border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                          >
                            <Unlink className="h-3 w-3" aria-hidden="true" />
                            Lepas
                          </button>
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

      {/* TAB 5: IMPORT HISTORY */}
      {tab === 'history' && (
        <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <h2 className="text-base font-semibold text-slate-900">
            Riwayat Import Pengguna Massal
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                  <th className="py-2 pr-3">Waktu</th>
                  <th className="py-2 pr-3">Admin Pelaksana</th>
                  <th className="py-2 pr-3">Sumber</th>
                  <th className="py-2 pr-3 text-right">Total</th>
                  <th className="py-2 pr-3 text-right">Berhasil</th>
                  <th className="py-2 pr-3 text-right">Gagal</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.importJobs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-xs text-slate-500">
                      Belum ada riwayat import massal.
                    </td>
                  </tr>
                ) : (
                  data.importJobs.map((job) => (
                    <tr key={job.id}>
                      <td className="py-2.5 pr-3 font-mono text-xs text-slate-600 tabular-nums">
                        {job.createdAt.slice(0, 16).replace('T', ' ')}
                      </td>
                      <td className="py-2.5 pr-3 text-xs font-medium text-slate-900">
                        {job.createdByName}
                      </td>
                      <td className="py-2.5 pr-3 text-xs text-slate-600">
                        {job.sourceType === 'excel_csv' ? 'Excel / CSV' : 'Tabel Dinamis'}
                      </td>
                      <td className="py-2.5 pr-3 text-right font-mono tabular-nums">
                        {job.totalRows}
                      </td>
                      <td className="py-2.5 pr-3 text-right font-mono tabular-nums text-emerald-700">
                        {job.successCount}
                      </td>
                      <td className="py-2.5 pr-3 text-right font-mono tabular-nums text-red-700">
                        {job.failedCount}
                      </td>
                      <td className="py-2.5 text-xs font-semibold capitalize text-slate-700">
                        {job.status}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Detail Modal */}
      {detailUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Detail Pengguna</h3>
              <button
                type="button"
                onClick={() => setDetailUser(null)}
                aria-label="Tutup detail"
                className="rounded p-1 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <dt className="text-slate-500">Nama</dt>
                <dd className="font-semibold text-slate-900">{detailUser.name}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Username</dt>
                <dd className="font-mono font-semibold text-slate-900">{detailUser.username}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Role</dt>
                <dd className="font-semibold text-slate-900">{ROLE_LABELS[detailUser.role]}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Status Akun</dt>
                <dd className={detailUser.isActive ? 'font-semibold text-emerald-700' : 'font-semibold text-red-700'}>
                  {detailUser.isActive ? 'Aktif' : 'Nonaktif'}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Email</dt>
                <dd className="text-slate-800 break-all">{detailUser.email || '-'}</dd>
              </div>
              <div>
                <dt className="text-slate-500">No. HP</dt>
                <dd className="text-slate-800 tabular-nums">{detailUser.phoneNumber || '-'}</dd>
              </div>
              <div>
                <dt className="text-slate-500">NIS / NIP</dt>
                <dd className="font-mono text-slate-800">{detailUser.nis || detailUser.nisOrNip || '-'}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Login Terakhir</dt>
                <dd className="font-mono text-slate-800 tabular-nums">
                  {detailUser.lastLoginAt ? detailUser.lastLoginAt.slice(0, 16).replace('T', ' ') : '-'}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleSaveEditModal}
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                Edit Profil ({editUser.username})
              </h3>
              <button
                type="button"
                onClick={() => setEditUser(null)}
                aria-label="Tutup edit"
                className="rounded p-1 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Email</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Nomor HP</label>
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              {editUser.role === 'student' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700">Kelas</label>
                  <select
                    value={editClassId}
                    onChange={(e) => setEditClassId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    {data.classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {(editUser.role === 'teacher' ||
                editUser.role === 'staff' ||
                editUser.role === 'principal') && (
                <div>
                  <label className="block text-xs font-medium text-slate-700">Jabatan</label>
                  <input
                    type="text"
                    value={editJobTitle}
                    onChange={(e) => setEditJobTitle(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditUser(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700"
              >
                Batal
              </button>
              <button
                type="submit"
                className="rounded-lg bg-[#0F4C81] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0C3D68]"
              >
                Simpan Perubahan
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmAction && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              {confirmAction.type === 'toggle'
                ? confirmAction.user.isActive
                  ? 'Konfirmasi Nonaktifkan Akun'
                  : 'Konfirmasi Aktifkan Akun'
                : confirmAction.type === 'reset'
                ? 'Konfirmasi Reset Password'
                : 'Konfirmasi Hapus Akun'}
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              {confirmAction.type === 'toggle' &&
                (confirmAction.user.isActive
                  ? `Akun ${confirmAction.user.name} (${confirmAction.user.username}) tidak akan bisa mengakses data sekolah hingga diaktifkan kembali.`
                  : `Aktifkan kembali akses akun ${confirmAction.user.name} (${confirmAction.user.username})?`)}
              {confirmAction.type === 'reset' &&
                `Sistem akan menandai wajib ganti password pada akun ${confirmAction.user.name} dan mengirimkan email reset password Firebase Auth jika email aktif valid tersedia (Starter Tier tanpa Admin SDK tidak menimpa password pengguna lain secara langsung).`}
              {confirmAction.type === 'delete' &&
                `Menghapus akun ${confirmAction.user.name} (${confirmAction.user.username}) akan mencabut indeks username dan profil sekolahnya secara permanen.`}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={confirmBusy}
                onClick={() => setConfirmAction(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={confirmBusy}
                onClick={() => void executeConfirmAction()}
                className={`rounded-lg px-4 py-2 text-xs font-semibold text-white ${
                  confirmAction.type === 'delete'
                    ? 'bg-red-700 hover:bg-red-800'
                    : 'bg-[#0F4C81] hover:bg-[#0C3D68]'
                }`}
              >
                {confirmBusy ? 'Memproses...' : 'Ya, Lanjutkan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
