import type {
  LegacyUserRole,
  SchoolClass,
  UserAccount,
  UserRole,
} from '../types/sims';

export const CANONICAL_ROLES: UserRole[] = [
  'school_admin',
  'principal',
  'teacher',
  'staff',
  'student',
  'parent',
];

export const ROLE_LABELS: Record<UserRole, string> = {
  school_admin: 'Admin Sekolah',
  principal: 'Kepala Sekolah',
  teacher: 'Guru',
  staff: 'Staff / TU',
  student: 'Siswa',
  parent: 'Orang Tua / Wali',
};

export function normalizeUserRole(raw: string | undefined | null): UserRole | null {
  if (!raw) return null;
  const cleaned = raw.trim().toLowerCase().replace(/\s+/g, '_');
  const map: Record<string, UserRole> = {
    school_admin: 'school_admin',
    admin: 'school_admin',
    admin_sekolah: 'school_admin',
    operator: 'school_admin',
    principal: 'principal',
    kepala_sekolah: 'principal',
    kepsek: 'principal',
    teacher: 'teacher',
    guru: 'teacher',
    guru_pengampu: 'teacher',
    staff: 'staff',
    staf: 'staff',
    tu: 'staff',
    tata_usaha: 'staff',
    student: 'student',
    siswa: 'student',
    murid: 'student',
    parent: 'parent',
    orang_tua: 'parent',
    ortu: 'parent',
    wali: 'parent',
  };
  return map[cleaned] ?? null;
}

export function isLegacyRole(role: string): role is LegacyUserRole {
  return ['operator', 'kepala_sekolah', 'guru', 'siswa', 'orang_tua'].includes(role);
}

/**
 * Ketentuan wajib ganti password saat login pertama:
 * - Wajib: principal (Kepala Sekolah), teacher (Guru), staff (Staff)
 * - Tidak wajib: school_admin, student (Siswa), parent (Orang Tua)
 */
export function mustChangePasswordForRole(role: UserRole): boolean {
  return role === 'principal' || role === 'teacher' || role === 'staff';
}

export function sanitizeUsername(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9._-]/g, '')
    .replace(/\.{2,}/g, '.')
    .replace(/^[._-]+|[._-]+$/g, '');
}

export function validateUsernameFormat(username: string): {
  valid: boolean;
  normalized: string;
  error?: string;
} {
  const trimmed = username.trim().toLowerCase();
  if (trimmed.length < 3 || trimmed.length > 40) {
    return {
      valid: false,
      normalized: trimmed,
      error: 'Username harus terdiri dari 3 hingga 40 karakter.',
    };
  }
  if (!/^[a-z0-9][a-z0-9._-]{1,38}[a-z0-9]$/.test(trimmed)) {
    return {
      valid: false,
      normalized: trimmed,
      error: 'Username hanya boleh huruf kecil, angka, titik (.), underscore (_), atau tanda hubung (-).',
    };
  }
  return { valid: true, normalized: trimmed };
}

export function buildUsernameLookupKey(username: string): string {
  return username.trim().toLowerCase();
}

export function buildSchoolSlug(schoolName: string, npsn?: string): string {
  const base = schoolName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
  const cleanNpsn = (npsn || '').replace(/[^a-zA-Z0-9]/g, '');
  const suffix = cleanNpsn
    ? cleanNpsn.slice(-4)
    : Math.random().toString(36).slice(2, 6);
  return `${base || 'sekolah'}-${suffix || '0001'}`;
}

export function resolveAuthEmailForAccount(params: {
  usernameKey: string;
  schoolId: string;
  personalEmail?: string;
  existingAuthEmails?: Iterable<string>;
}): string {
  const candidate = (params.personalEmail || '').trim().toLowerCase();
  const used = new Set(
    Array.from(params.existingAuthEmails || []).map((e) => e.trim().toLowerCase())
  );
  if (candidate && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate) && !used.has(candidate)) {
    return candidate;
  }
  const safeUser = params.usernameKey.replace(/[^a-z0-9._-]/g, '');
  const safeSchool = params.schoolId.replace(/[^a-z0-9_-]/g, '');
  return `${safeUser}.${safeSchool}@sims.local`;
}

export function generateUsernameFromName(
  fullName: string,
  existingKeys: Iterable<string>
): string {
  const existing = new Set(Array.from(existingKeys).map((k) => k.toLowerCase()));
  const words = fullName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0 && !['dr', 'drs', 'ir', 'h', 'hj', 'spd', 'mpd', 'msi', 'skom'].includes(w));

  let base = '';
  if (words.length >= 2) {
    base = `${words[0]}.${words[1]}`.slice(0, 24);
  } else if (words.length === 1) {
    base = words[0].slice(0, 24);
  } else {
    base = 'pengguna';
  }
  base = sanitizeUsername(base);
  if (base.length < 3) base = `${base}01`;

  if (!existing.has(base)) {
    return base;
  }
  let counter = 2;
  while (existing.has(`${base}${counter}`)) {
    counter += 1;
  }
  return `${base}${counter}`;
}

export function generateStrongTempPassword(length = 12): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%&*';
  const all = upper + lower + digits + symbols;

  const chars = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    digits[Math.floor(Math.random() * digits.length)],
    symbols[Math.floor(Math.random() * symbols.length)],
  ];
  while (chars.length < Math.max(10, length)) {
    chars.push(all[Math.floor(Math.random() * all.length)]);
  }
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = chars[i];
    chars[i] = chars[j];
    chars[j] = tmp;
  }
  return chars.join('');
}

export interface PasswordStrengthResult {
  valid: boolean;
  score: number;
  checks: {
    minLength: boolean;
    hasUpper: boolean;
    hasLower: boolean;
    hasNumber: boolean;
    hasSymbol: boolean;
  };
  error?: string;
}

export function validatePasswordStrength(password: string): PasswordStrengthResult {
  const checks = {
    minLength: password.length >= 8,
    hasUpper: /[A-Z]/.test(password),
    hasLower: /[a-z]/.test(password),
    hasNumber: /\d/.test(password),
    hasSymbol: /[^A-Za-z0-9]/.test(password),
  };
  const score = Object.values(checks).filter(Boolean).length;
  const valid = checks.minLength && checks.hasUpper && checks.hasLower && checks.hasNumber;
  let error: string | undefined;
  if (!checks.minLength) {
    error = 'Password minimal 8 karakter.';
  } else if (!checks.hasUpper || !checks.hasLower || !checks.hasNumber) {
    error = 'Password harus mengandung huruf besar, huruf kecil, dan angka.';
  }
  return { valid, score, checks, error };
}

export interface FirstAdminRegistrationInput {
  adminName: string;
  username: string;
  email: string;
  phoneNumber: string;
  password: string;
  confirmPassword: string;
  schoolName: string;
  npsn?: string;
  schoolAddress: string;
}

export function validateFirstAdminRegistration(
  input: FirstAdminRegistrationInput
): { valid: boolean; error?: string } {
  if (input.adminName.trim().length < 2) {
    return { valid: false, error: 'Nama lengkap Admin Sekolah minimal 2 karakter.' };
  }
  const userCheck = validateUsernameFormat(input.username);
  if (!userCheck.valid) {
    return { valid: false, error: userCheck.error };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
    return { valid: false, error: 'Format email aktif Admin Sekolah tidak valid.' };
  }
  if (!/^[0-9+\-\s]{8,20}$/.test(input.phoneNumber.trim())) {
    return { valid: false, error: 'Nomor HP Admin Sekolah minimal 8 digit angka.' };
  }
  const pwCheck = validatePasswordStrength(input.password);
  if (!pwCheck.valid) {
    return { valid: false, error: pwCheck.error };
  }
  if (input.password !== input.confirmPassword) {
    return { valid: false, error: 'Konfirmasi password tidak cocok.' };
  }
  if (input.schoolName.trim().length < 3) {
    return { valid: false, error: 'Nama sekolah minimal 3 karakter.' };
  }
  if (input.npsn && input.npsn.trim().length > 0 && !/^\d{8,16}$/.test(input.npsn.trim())) {
    return { valid: false, error: 'NPSN opsional harus berupa 8–16 digit angka.' };
  }
  if (input.schoolAddress.trim().length < 5) {
    return { valid: false, error: 'Alamat sekolah minimal 5 karakter.' };
  }
  return { valid: true };
}

export interface SingleUserCreateInput {
  role: Exclude<UserRole, 'school_admin'>;
  name: string;
  username: string;
  password: string;
  email?: string;
  phoneNumber?: string;
  nisOrNip?: string;
  nis?: string;
  nisn?: string;
  classId?: string;
  entryYear?: string;
  parentPhone?: string;
  jobTitle?: string;
  department?: string;
  teachingSubjectIds?: string[];
  teachingClassIds?: string[];
  linkedStudentIds?: string[];
  relationshipType?: 'Ayah' | 'Ibu' | 'Wali';
}

export function validateSingleUserInput(
  input: SingleUserCreateInput,
  existingUsers: UserAccount[],
  classes: SchoolClass[]
): { valid: boolean; error?: string } {
  if (input.name.trim().length < 2) {
    return { valid: false, error: 'Nama lengkap minimal 2 karakter.' };
  }
  const uCheck = validateUsernameFormat(input.username);
  if (!uCheck.valid) {
    return { valid: false, error: uCheck.error };
  }
  const duplicateUsername = existingUsers.some(
    (u) => u.usernameKey.toLowerCase() === uCheck.normalized
  );
  if (duplicateUsername) {
    return { valid: false, error: `Username "${uCheck.normalized}" sudah digunakan.` };
  }
  const pwCheck = validatePasswordStrength(input.password);
  if (!pwCheck.valid) {
    return { valid: false, error: pwCheck.error };
  }
  if (input.email && input.email.trim().length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
    return { valid: false, error: 'Format email tidak valid.' };
  }

  if (input.role === 'student') {
    if (!input.nis?.trim()) {
      return { valid: false, error: 'NIS wajib diisi untuk akun Siswa.' };
    }
    const dupNis = existingUsers.some(
      (u) => u.role === 'student' && (u.nis === input.nis?.trim() || u.nisOrNip === input.nis?.trim())
    );
    if (dupNis) {
      return { valid: false, error: `NIS "${input.nis.trim()}" sudah terdaftar.` };
    }
    if (input.nisn?.trim()) {
      const dupNisn = existingUsers.some((u) => u.role === 'student' && u.nisn === input.nisn?.trim());
      if (dupNisn) {
        return { valid: false, error: `NISN "${input.nisn.trim()}" sudah terdaftar.` };
      }
    }
    if (!input.classId || !classes.some((c) => c.id === input.classId)) {
      return { valid: false, error: 'Kelas tujuan wajib dipilih untuk akun Siswa.' };
    }
  }

  if (input.role === 'parent') {
    if (!input.linkedStudentIds || input.linkedStudentIds.length === 0) {
      return { valid: false, error: 'Minimal pilih 1 siswa yang dihubungkan dengan Orang Tua.' };
    }
  }

  if ((input.role === 'principal' || input.role === 'teacher' || input.role === 'staff') && !input.nisOrNip?.trim()) {
    return {
      valid: false,
      error: `NIP / NUPTK / ID Pegawai wajib diisi untuk ${ROLE_LABELS[input.role]}.`,
    };
  }

  return { valid: true };
}

export interface LoginRateLimitState {
  failedCount: number;
  lockedUntilMs: number;
}

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 60_000;

export function checkLoginRateLimit(
  state: LoginRateLimitState | undefined,
  nowMs = Date.now()
): { allowed: boolean; remainingSeconds: number } {
  if (!state) return { allowed: true, remainingSeconds: 0 };
  if (state.lockedUntilMs > nowMs) {
    return {
      allowed: false,
      remainingSeconds: Math.ceil((state.lockedUntilMs - nowMs) / 1000),
    };
  }
  return { allowed: true, remainingSeconds: 0 };
}

export function recordFailedLoginAttempt(
  state: LoginRateLimitState | undefined,
  nowMs = Date.now()
): LoginRateLimitState {
  const prevCount = state && state.lockedUntilMs <= nowMs && state.failedCount >= MAX_FAILED_ATTEMPTS
    ? 0
    : state?.failedCount || 0;
  const nextCount = prevCount + 1;
  return {
    failedCount: nextCount,
    lockedUntilMs: nextCount >= MAX_FAILED_ATTEMPTS ? nowMs + LOCKOUT_DURATION_MS : 0,
  };
}

export function canManageUsers(role: UserRole): boolean {
  return role === 'school_admin';
}

export function canManageSchoolSettings(role: UserRole): boolean {
  return role === 'school_admin' || role === 'principal';
}

export function canAccessNavSection(
  role: UserRole,
  section:
    | 'dashboard'
    | 'akademik'
    | 'e_tugas'
    | 'portal'
    | 'absensi'
    | 'manajemen_pengguna'
    | 'administrasi'
): boolean {
  if (section === 'manajemen_pengguna') {
    return role === 'school_admin';
  }
  if (section === 'administrasi') {
    return role === 'school_admin' || role === 'principal' || role === 'staff';
  }
  if (section === 'e_tugas') {
    return role !== 'staff';
  }
  return true;
}
