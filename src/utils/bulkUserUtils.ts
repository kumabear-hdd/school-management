import * as XLSX from 'xlsx';
import type { SchoolClass, Subject, UserAccount, UserRole } from '../types/sims';
import {
  ROLE_LABELS,
  generateStrongTempPassword,
  generateUsernameFromName,
  mustChangePasswordForRole,
  normalizeUserRole,
  validatePasswordStrength,
  validateUsernameFormat,
} from './authLogic';

export type BulkRowErrorCode =
  | 'duplicate_username_in_file'
  | 'duplicate_username_existing'
  | 'duplicate_nis_nisn'
  | 'missing_required'
  | 'invalid_format'
  | 'class_not_found'
  | 'invalid_role'
  | 'student_not_found';

export interface BulkUserDraftRow {
  rowId: string;
  rowNumber: number;
  roleInput: string;
  name: string;
  username: string;
  password: string;
  email: string;
  phoneNumber: string;
  nisOrNip: string;
  nisn: string;
  classInput: string;
  entryYear: string;
  parentPhone: string;
  jobTitle: string;
  department: string;
  teachingSubjectsInput: string;
  linkedStudentInput: string;
  relationshipType: 'Ayah' | 'Ibu' | 'Wali';
}

export interface BulkValidatedRow extends BulkUserDraftRow {
  resolvedRole: Exclude<UserRole, 'school_admin'> | null;
  resolvedClassId?: string;
  resolvedSubjectIds: string[];
  resolvedStudentIds: string[];
  mustChangePassword: boolean;
  valid: boolean;
  errorCodes: BulkRowErrorCode[];
  errors: string[];
}

export interface BulkImportExecutionResult {
  rowNumber: number;
  name: string;
  roleLabel: string;
  username: string;
  tempPassword: string;
  mustChangePassword: boolean;
  status: 'Berhasil' | 'Gagal';
  message: string;
}

export function createEmptyDraftRow(rowNumber: number): BulkUserDraftRow {
  return {
    rowId: `row-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    rowNumber,
    roleInput: 'student',
    name: '',
    username: '',
    password: generateStrongTempPassword(10),
    email: '',
    phoneNumber: '',
    nisOrNip: '',
    nisn: '',
    classInput: '',
    entryYear: String(new Date().getFullYear()),
    parentPhone: '',
    jobTitle: '',
    department: '',
    teachingSubjectsInput: '',
    linkedStudentInput: '',
    relationshipType: 'Wali',
  };
}

export function validateBulkUserRows(
  rows: BulkUserDraftRow[],
  context: {
    classes: SchoolClass[];
    subjects: Subject[];
    existingUsers: UserAccount[];
  }
): BulkValidatedRow[] {
  const existingUsernames = new Set(
    context.existingUsers.map((u) => u.usernameKey.toLowerCase())
  );
  const existingNis = new Set(
    context.existingUsers
      .filter((u) => u.role === 'student')
      .map((u) => (u.nis || u.nisOrNip || '').trim().toLowerCase())
      .filter(Boolean)
  );
  const existingNisn = new Set(
    context.existingUsers
      .filter((u) => u.role === 'student')
      .map((u) => (u.nisn || '').trim().toLowerCase())
      .filter(Boolean)
  );

  const seenUsernames = new Map<string, number>();
  const seenNis = new Map<string, number>();
  const seenNisn = new Map<string, number>();

  for (const row of rows) {
    const uKey = row.username.trim().toLowerCase();
    if (uKey) {
      seenUsernames.set(uKey, (seenUsernames.get(uKey) || 0) + 1);
    }
    const role = normalizeUserRole(row.roleInput);
    if (role === 'student') {
      const nisKey = row.nisOrNip.trim().toLowerCase();
      if (nisKey) seenNis.set(nisKey, (seenNis.get(nisKey) || 0) + 1);
      const nisnKey = row.nisn.trim().toLowerCase();
      if (nisnKey) seenNisn.set(nisnKey, (seenNisn.get(nisnKey) || 0) + 1);
    }
  }

  const studentPool = context.existingUsers.filter((u) => u.role === 'student');

  return rows.map((row) => {
    const errorCodes: BulkRowErrorCode[] = [];
    const errors: string[] = [];

    const normalizedRole = normalizeUserRole(row.roleInput);
    let resolvedRole: Exclude<UserRole, 'school_admin'> | null = null;
    if (!normalizedRole || normalizedRole === 'school_admin') {
      errorCodes.push('invalid_role');
      errors.push(
        normalizedRole === 'school_admin'
          ? 'Role school_admin tidak boleh dibuat melalui impor massal.'
          : `Role "${row.roleInput || '-'}" tidak valid (gunakan principal, teacher, staff, student, parent).`
      );
    } else {
      resolvedRole = normalizedRole;
    }

    if (row.name.trim().length < 2) {
      errorCodes.push('missing_required');
      errors.push('Nama lengkap wajib diisi (minimal 2 karakter).');
    }

    const uCheck = validateUsernameFormat(row.username);
    if (!row.username.trim()) {
      errorCodes.push('missing_required');
      errors.push('Username wajib diisi.');
    } else if (!uCheck.valid) {
      errorCodes.push('invalid_format');
      errors.push(uCheck.error || 'Format username tidak valid.');
    } else {
      if ((seenUsernames.get(uCheck.normalized) || 0) > 1) {
        errorCodes.push('duplicate_username_in_file');
        errors.push(`Username "${uCheck.normalized}" duplikat di dalam tabel impor.`);
      }
      if (existingUsernames.has(uCheck.normalized)) {
        errorCodes.push('duplicate_username_existing');
        errors.push(`Username "${uCheck.normalized}" sudah terdaftar di sistem.`);
      }
    }

    if (!row.password.trim()) {
      errorCodes.push('missing_required');
      errors.push('Password awal wajib diisi.');
    } else {
      const pwCheck = validatePasswordStrength(row.password);
      if (!pwCheck.valid) {
        errorCodes.push('invalid_format');
        errors.push(pwCheck.error || 'Password terlalu lemah.');
      }
    }

    if (row.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email.trim())) {
      errorCodes.push('invalid_format');
      errors.push(`Format email "${row.email.trim()}" tidak valid.`);
    }

    let resolvedClassId: string | undefined;
    const resolvedSubjectIds: string[] = [];
    const resolvedStudentIds: string[] = [];

    if (resolvedRole === 'student') {
      const nisClean = row.nisOrNip.trim();
      const nisnClean = row.nisn.trim();
      if (!nisClean) {
        errorCodes.push('missing_required');
        errors.push('NIS wajib diisi untuk Siswa.');
      } else {
        const k = nisClean.toLowerCase();
        if (existingNis.has(k) || (seenNis.get(k) || 0) > 1) {
          errorCodes.push('duplicate_nis_nisn');
          errors.push(`NIS "${nisClean}" duplikat atau sudah terdaftar.`);
        }
      }
      if (nisnClean) {
        const k2 = nisnClean.toLowerCase();
        if (existingNisn.has(k2) || (seenNisn.get(k2) || 0) > 1) {
          errorCodes.push('duplicate_nis_nisn');
          errors.push(`NISN "${nisnClean}" duplikat atau sudah terdaftar.`);
        }
      }

      if (!row.classInput.trim()) {
        errorCodes.push('missing_required');
        errors.push('Kelas wajib diisi untuk Siswa.');
      } else {
        const clsMatch = context.classes.find(
          (c) =>
            c.id.toLowerCase() === row.classInput.trim().toLowerCase() ||
            c.name.toLowerCase() === row.classInput.trim().toLowerCase()
        );
        if (!clsMatch) {
          errorCodes.push('class_not_found');
          errors.push(`Kelas "${row.classInput.trim()}" tidak ditemukan di master kelas.`);
        } else {
          resolvedClassId = clsMatch.id;
        }
      }
    }

    if (resolvedRole === 'teacher' || resolvedRole === 'principal' || resolvedRole === 'staff') {
      if (!row.nisOrNip.trim()) {
        errorCodes.push('missing_required');
        errors.push(`NIP/NUPTK/ID Pegawai wajib diisi untuk ${ROLE_LABELS[resolvedRole]}.`);
      }
    }

    if (resolvedRole === 'teacher' && row.teachingSubjectsInput.trim()) {
      const tokens = row.teachingSubjectsInput
        .split(/[,;|]/)
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
      for (const tok of tokens) {
        const matchedSubj = context.subjects.find(
          (s) =>
            s.id.toLowerCase() === tok ||
            s.code.toLowerCase() === tok ||
            s.name.toLowerCase() === tok
        );
        if (matchedSubj && !resolvedSubjectIds.includes(matchedSubj.id)) {
          resolvedSubjectIds.push(matchedSubj.id);
        }
      }
    }

    if (resolvedRole === 'parent') {
      if (!row.linkedStudentInput.trim()) {
        errorCodes.push('missing_required');
        errors.push('Kolom NIS/Username/UID Siswa Terhubung wajib diisi untuk Orang Tua.');
      } else {
        const tokens = row.linkedStudentInput
          .split(/[,;|]/)
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean);
        for (const tok of tokens) {
          const match = studentPool.find(
            (st) =>
              st.uid.toLowerCase() === tok ||
              st.usernameKey.toLowerCase() === tok ||
              (st.nis || '').toLowerCase() === tok ||
              (st.nisOrNip || '').toLowerCase() === tok ||
              st.name.toLowerCase() === tok
          );
          if (match) {
            if (!resolvedStudentIds.includes(match.uid)) {
              resolvedStudentIds.push(match.uid);
            }
          }
        }
        if (resolvedStudentIds.length === 0) {
          errorCodes.push('student_not_found');
          errors.push(`Siswa terhubung "${row.linkedStudentInput.trim()}" tidak ditemukan.`);
        }
      }
    }

    return {
      ...row,
      resolvedRole,
      resolvedClassId,
      resolvedSubjectIds,
      resolvedStudentIds,
      mustChangePassword: resolvedRole ? mustChangePasswordForRole(resolvedRole) : false,
      valid: errors.length === 0,
      errorCodes: Array.from(new Set(errorCodes)),
      errors,
    };
  });
}

export function autoFillDraftUsernamesAndPasswords(
  rows: BulkUserDraftRow[],
  existingUsers: UserAccount[]
): BulkUserDraftRow[] {
  const taken = new Set(existingUsers.map((u) => u.usernameKey.toLowerCase()));
  return rows.map((row) => {
    let username = row.username.trim().toLowerCase();
    if (!username && row.name.trim()) {
      username = generateUsernameFromName(row.name, taken);
    }
    if (username) taken.add(username);
    const password = row.password.trim() || generateStrongTempPassword(10);
    return { ...row, username, password };
  });
}

function pickCell(record: Record<string, unknown>, keys: string[]): string {
  for (const key of Object.keys(record)) {
    const normalized = key.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (keys.includes(normalized)) {
      const val = record[key];
      return val === undefined || val === null ? '' : String(val).trim();
    }
  }
  return '';
}

export async function parseBulkImportFile(file: File): Promise<BulkUserDraftRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) return [];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
    workbook.Sheets[firstSheet],
    { defval: '' }
  );

  return rawRows
    .filter((r) => Object.values(r).some((v) => String(v ?? '').trim() !== ''))
    .map((r, idx) => {
      const relRaw = pickCell(r, ['hubungan', 'relationship', 'relationshiptype']);
      const relationshipType: 'Ayah' | 'Ibu' | 'Wali' =
        relRaw === 'Ayah' || relRaw === 'Ibu' ? relRaw : 'Wali';

      return {
        rowId: `imp-${Date.now()}-${idx}`,
        rowNumber: idx + 1,
        roleInput: pickCell(r, ['role', 'peran', 'jabatanrole']),
        name: pickCell(r, ['name', 'namalengkap', 'nama']),
        username: pickCell(r, ['username', 'namapengguna', 'user']).toLowerCase(),
        password: pickCell(r, ['password', 'passwordawal', 'katasandi']),
        email: pickCell(r, ['email', 'emailaktif']),
        phoneNumber: pickCell(r, ['phonenumber', 'nohp', 'nomorhp', 'hp', 'telepon']),
        nisOrNip: pickCell(r, ['nisornip', 'nis', 'nip', 'nipnuptk', 'idpegawai']),
        nisn: pickCell(r, ['nisn']),
        classInput: pickCell(r, ['class', 'kelas', 'classid', 'namakelas']),
        entryYear: pickCell(r, ['entryyear', 'tahunmasuk', 'angkatan']) || String(new Date().getFullYear()),
        parentPhone: pickCell(r, ['parentphone', 'nohportu', 'hportu', 'teleponortu']),
        jobTitle: pickCell(r, ['jobtitle', 'jabatan']),
        department: pickCell(r, ['department', 'bagian', 'unitkerja']),
        teachingSubjectsInput: pickCell(r, ['matapelajaran', 'mapel', 'subjects', 'teachingsubjects']),
        linkedStudentInput: pickCell(r, ['siswaterhubung', 'nissiswa', 'linkedstudent', 'studentnis']),
        relationshipType,
      };
    });
}

function getTemplateRowsForRole(
  targetRole: Exclude<UserRole, 'school_admin'> | 'all',
  classes: SchoolClass[]
): Record<string, string>[] {
  const sampleClass = classes[0]?.name || 'XI IPA 1';
  const rows: Record<string, string>[] = [];

  if (targetRole === 'all' || targetRole === 'principal') {
    rows.push({
      role: 'principal',
      nama_lengkap: 'Drs. Ahmad Hidayat, M.Pd.',
      username: 'ahmad.kepsek',
      password_awal: generateStrongTempPassword(10),
      email: 'ahmad.kepsek@sekolah.sch.id',
      no_hp: '081234560001',
      nis_atau_nip: '197501122000031002',
      nisn: '',
      kelas: '',
      tahun_masuk: '',
      no_hp_ortu: '',
      jabatan: 'Kepala Sekolah',
      bagian: 'Pimpinan Sekolah',
      mata_pelajaran: '',
      siswa_terhubung: '',
      hubungan: '',
    });
  }
  if (targetRole === 'all' || targetRole === 'teacher') {
    rows.push({
      role: 'teacher',
      nama_lengkap: 'Siti Nurhaliza, S.Pd.',
      username: 'siti.guru',
      password_awal: generateStrongTempPassword(10),
      email: 'siti.guru@sekolah.sch.id',
      no_hp: '081234560002',
      nis_atau_nip: '198803142015022004',
      nisn: '',
      kelas: '',
      tahun_masuk: '',
      no_hp_ortu: '',
      jabatan: 'Guru Mata Pelajaran',
      bagian: 'Akademik',
      mata_pelajaran: 'MAT-11',
      siswa_terhubung: '',
      hubungan: '',
    });
  }
  if (targetRole === 'all' || targetRole === 'staff') {
    rows.push({
      role: 'staff',
      nama_lengkap: 'Budi Santoso, A.Md.',
      username: 'budi.staff',
      password_awal: generateStrongTempPassword(10),
      email: 'budi.tu@sekolah.sch.id',
      no_hp: '081234560003',
      nis_atau_nip: '199107052019031008',
      nisn: '',
      kelas: '',
      tahun_masuk: '',
      no_hp_ortu: '',
      jabatan: 'Staf Tata Usaha',
      bagian: 'Administrasi & PPDB',
      mata_pelajaran: '',
      siswa_terhubung: '',
      hubungan: '',
    });
  }
  if (targetRole === 'all' || targetRole === 'student') {
    rows.push({
      role: 'student',
      nama_lengkap: 'Putra Pratama',
      username: 'putra.pratama',
      password_awal: generateStrongTempPassword(10),
      email: 'putra.pratama@siswa.sch.id',
      no_hp: '081234560004',
      nis_atau_nip: '20260101',
      nisn: '0099112233',
      kelas: sampleClass,
      tahun_masuk: '2026',
      no_hp_ortu: '081311223344',
      jabatan: '',
      bagian: '',
      mata_pelajaran: '',
      siswa_terhubung: '',
      hubungan: '',
    });
  }
  if (targetRole === 'all' || targetRole === 'parent') {
    rows.push({
      role: 'parent',
      nama_lengkap: 'Ratna Wijaya',
      username: 'ratna.ortu',
      password_awal: generateStrongTempPassword(10),
      email: 'ratna.wijaya@gmail.com',
      no_hp: '081311223344',
      nis_atau_nip: '',
      nisn: '',
      kelas: '',
      tahun_masuk: '',
      no_hp_ortu: '',
      jabatan: '',
      bagian: '',
      mata_pelajaran: '',
      siswa_terhubung: '20250101',
      hubungan: 'Ibu',
    });
  }

  return rows;
}

export function downloadBulkTemplateExcel(
  targetRole: Exclude<UserRole, 'school_admin'> | 'all',
  classes: SchoolClass[]
): void {
  const wb = XLSX.utils.book_new();
  const sampleRows = getTemplateRowsForRole(targetRole, classes);
  const ws = XLSX.utils.json_to_sheet(sampleRows);
  XLSX.utils.book_append_sheet(wb, ws, 'Template_Akun_SIMS');

  const guideRows = [
    { Kolom: 'role', Keterangan: 'Wajib: principal | teacher | staff | student | parent' },
    { Kolom: 'nama_lengkap', Keterangan: 'Wajib diisi, minimal 2 karakter' },
    { Kolom: 'username', Keterangan: 'Wajib unik, huruf kecil/angka/titik/underscore/strip (3-40 karakter)' },
    { Kolom: 'password_awal', Keterangan: 'Wajib >= 8 karakter, berisi huruf besar, huruf kecil, dan angka' },
    { Kolom: 'nis_atau_nip', Keterangan: 'Wajib untuk siswa (NIS), guru (NIP/NUPTK), kepala sekolah, dan staff' },
    { Kolom: 'kelas', Keterangan: `Wajib untuk siswa. Contoh kelas tersedia: ${classes.map((c) => c.name).join(', ')}` },
    { Kolom: 'siswa_terhubung', Keterangan: 'Wajib untuk parent: isi NIS, username, atau UID siswa (pisahkan koma jika >1 anak)' },
    { Kolom: 'Kebijakan Login Pertama', Keterangan: 'principal, teacher, staff WAJIB ganti password saat login pertama; student & parent TIDAK wajib.' },
  ];
  const guideSheet = XLSX.utils.json_to_sheet(guideRows);
  XLSX.utils.book_append_sheet(wb, guideSheet, 'Panduan_Pengisian');

  XLSX.writeFile(wb, `Template_Import_Akun_${targetRole}.xlsx`);
}

export function downloadBulkTemplateCsv(
  targetRole: Exclude<UserRole, 'school_admin'> | 'all',
  classes: SchoolClass[]
): void {
  const sampleRows = getTemplateRowsForRole(targetRole, classes);
  if (sampleRows.length === 0) return;
  const headers = Object.keys(sampleRows[0]);
  const escape = (val: string) => `"${String(val).replace(/"/g, '""')}"`;
  const csv = [
    headers.join(','),
    ...sampleRows.map((row) => headers.map((h) => escape(row[h] || '')).join(',')),
  ].join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Template_Import_Akun_${targetRole}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportBulkImportReportExcel(results: BulkImportExecutionResult[]): void {
  const wb = XLSX.utils.book_new();
  const sheetRows = results.map((r) => ({
    Baris: r.rowNumber,
    Nama: r.name,
    Role: r.roleLabel,
    Username: r.username,
    Password_Sementara: r.status === 'Berhasil' ? r.tempPassword : '-',
    Wajib_Ganti_Password_Awal: r.mustChangePassword ? 'Ya' : 'Tidak',
    Status: r.status,
    Keterangan: r.message,
  }));
  const ws = XLSX.utils.json_to_sheet(sheetRows);
  XLSX.utils.book_append_sheet(wb, ws, 'Laporan_Import_Akun');
  XLSX.writeFile(wb, `Laporan_Import_Akun_SIMS_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
