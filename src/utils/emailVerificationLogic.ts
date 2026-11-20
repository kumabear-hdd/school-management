import type { UserRole } from '../types/sims';

export const RESEND_COOLDOWN_SECONDS = 60;
export const RESEND_WINDOW_MS = 15 * 60 * 1000;
export const RESEND_MAX_ATTEMPTS_PER_WINDOW = 5;

export interface ResendRateLimitState {
  lastSentAtMs: number;
  attemptTimestampsMs: number[];
}

export interface ResendRateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
  remainingAttemptsInWindow: number;
  reason?: 'cooldown' | 'window_quota';
  message?: string;
}

export function checkResendRateLimit(
  state: ResendRateLimitState | undefined,
  nowMs = Date.now()
): ResendRateLimitResult {
  if (!state) {
    return {
      allowed: true,
      retryAfterSeconds: 0,
      remainingAttemptsInWindow: RESEND_MAX_ATTEMPTS_PER_WINDOW,
    };
  }

  const recentAttempts = (state.attemptTimestampsMs || []).filter(
    (ts) => nowMs - ts < RESEND_WINDOW_MS && ts <= nowMs
  );

  const cooldownMs = RESEND_COOLDOWN_SECONDS * 1000;
  const elapsedSinceLast = nowMs - (state.lastSentAtMs || 0);
  if (state.lastSentAtMs > 0 && elapsedSinceLast < cooldownMs) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((cooldownMs - elapsedSinceLast) / 1000)
    );
    return {
      allowed: false,
      retryAfterSeconds,
      remainingAttemptsInWindow: Math.max(
        0,
        RESEND_MAX_ATTEMPTS_PER_WINDOW - recentAttempts.length
      ),
      reason: 'cooldown',
      message: `Harap tunggu ${retryAfterSeconds} detik sebelum mengirim ulang email verifikasi.`,
    };
  }

  if (recentAttempts.length >= RESEND_MAX_ATTEMPTS_PER_WINDOW) {
    const oldestInWindow = Math.min(...recentAttempts);
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((oldestInWindow + RESEND_WINDOW_MS - nowMs) / 1000)
    );
    return {
      allowed: false,
      retryAfterSeconds,
      remainingAttemptsInWindow: 0,
      reason: 'window_quota',
      message: `Batas pengiriman ulang email verifikasi (${RESEND_MAX_ATTEMPTS_PER_WINDOW}x per 15 menit) tercapai. Coba lagi dalam ${Math.ceil(
        retryAfterSeconds / 60
      )} menit.`,
    };
  }

  return {
    allowed: true,
    retryAfterSeconds: 0,
    remainingAttemptsInWindow: RESEND_MAX_ATTEMPTS_PER_WINDOW - recentAttempts.length,
  };
}

export function recordResendAttempt(
  state: ResendRateLimitState | undefined,
  nowMs = Date.now()
): ResendRateLimitState {
  const recentAttempts = (state?.attemptTimestampsMs || []).filter(
    (ts) => nowMs - ts < RESEND_WINDOW_MS && ts <= nowMs
  );
  return {
    lastSentAtMs: nowMs,
    attemptTimestampsMs: [...recentAttempts, nowMs],
  };
}

export function isSyntheticSimsEmail(email: string | undefined | null): boolean {
  if (!email) return true;
  const normalized = email.trim().toLowerCase();
  if (!normalized || !normalized.includes('@')) return true;
  return normalized.endsWith('@sims.local');
}

export function shouldRequireEmailVerificationForLogin(params: {
  role: UserRole;
  authEmail?: string | null;
  schoolRequireEmailVerification?: boolean;
}): boolean {
  if (!params.schoolRequireEmailVerification) {
    return false;
  }
  // Akun internal sintetis (@sims.local) tidak dapat menerima email eksternal
  if (isSyntheticSimsEmail(params.authEmail)) {
    return false;
  }
  return true;
}

export function validateBackendDecodedTokenClaims(claims: {
  uid?: unknown;
  email?: unknown;
  email_verified?: unknown;
}): {
  valid: boolean;
  emailVerified: boolean;
  uid?: string;
  email?: string;
  error?: string;
} {
  if (typeof claims.uid !== 'string' || claims.uid.trim().length === 0) {
    return {
      valid: false,
      emailVerified: false,
      error: 'Token Firebase tidak memiliki UID pengguna yang valid.',
    };
  }
  if (claims.email_verified !== true) {
    return {
      valid: false,
      emailVerified: false,
      uid: claims.uid,
      email: typeof claims.email === 'string' ? claims.email : undefined,
      error:
        'Email belum terverifikasi pada klaim token Firebase (email_verified != true).',
    };
  }
  return {
    valid: true,
    emailVerified: true,
    uid: claims.uid,
    email: typeof claims.email === 'string' ? claims.email : undefined,
  };
}

export function buildDeterministicSchoolId(
  schoolName: string,
  npsn: string | undefined,
  adminUid: string
): string {
  const base = schoolName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 28);
  const cleanNpsn = (npsn || '').replace(/[^a-zA-Z0-9]/g, '');
  const cleanUid = adminUid.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const uidSuffix = cleanUid.slice(0, 6) || '000001';
  if (cleanNpsn) {
    return `${base || 'sekolah'}-${cleanNpsn.slice(-4)}-${uidSuffix}`;
  }
  return `${base || 'sekolah'}-${uidSuffix}`;
}

export function validatePendingAdminDraftCompletion(input: {
  adminName: string;
  username: string;
  email: string;
  phoneNumber: string;
  schoolName: string;
  npsn?: string;
  schoolAddress: string;
}): { valid: boolean; normalizedUsername: string; error?: string } {
  if (input.adminName.trim().length < 2) {
    return {
      valid: false,
      normalizedUsername: '',
      error: 'Nama lengkap Admin Sekolah minimal 2 karakter.',
    };
  }
  const trimmedUser = input.username.trim().toLowerCase();
  if (
    trimmedUser.length < 3 ||
    trimmedUser.length > 40 ||
    !/^[a-z0-9][a-z0-9._-]{1,38}[a-z0-9]$/.test(trimmedUser)
  ) {
    return {
      valid: false,
      normalizedUsername: trimmedUser,
      error:
        'Username Admin harus 3–40 karakter (huruf kecil, angka, titik, underscore, atau tanda hubung).',
    };
  }
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || isSyntheticSimsEmail(email)) {
    return {
      valid: false,
      normalizedUsername: trimmedUser,
      error: 'Email Admin Sekolah harus berupa alamat email aktif yang valid.',
    };
  }
  if (!/^[0-9+\-\s]{8,20}$/.test(input.phoneNumber.trim())) {
    return {
      valid: false,
      normalizedUsername: trimmedUser,
      error: 'Nomor HP Admin Sekolah minimal 8 digit angka.',
    };
  }
  if (input.schoolName.trim().length < 3) {
    return {
      valid: false,
      normalizedUsername: trimmedUser,
      error: 'Nama sekolah minimal 3 karakter.',
    };
  }
  if (input.npsn && input.npsn.trim().length > 0 && !/^\d{8,16}$/.test(input.npsn.trim())) {
    return {
      valid: false,
      normalizedUsername: trimmedUser,
      error: 'NPSN opsional harus berupa 8–16 digit angka.',
    };
  }
  if (input.schoolAddress.trim().length < 5) {
    return {
      valid: false,
      normalizedUsername: trimmedUser,
      error: 'Alamat sekolah minimal 5 karakter.',
    };
  }
  return { valid: true, normalizedUsername: trimmedUser };
}

