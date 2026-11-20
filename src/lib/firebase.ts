import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  getAuth,
  GoogleAuthProvider,
  inMemoryPersistence,
  reauthenticateWithCredential,
  sendEmailVerification,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updatePassword,
  updateProfile,
  type Auth,
  type User,
} from 'firebase/auth';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getFirestore,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';
import type {
  BootstrapConfig,
  ImportJobRecord,
  ParentStudentRelation,
  PendingAdminBootstrapDraft,
  School,
  UserAccount,
} from '../types/sims';
import {
  buildUsernameLookupKey,
  mustChangePasswordForRole,
  resolveAuthEmailForAccount,
} from '../utils/authLogic';
import { buildDeterministicSchoolId } from '../utils/emailVerificationLogic';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

// Initialize App Check safely when a reCAPTCHA site key is configured
if (typeof window !== 'undefined' && firebaseConfig.recaptchaSiteKey) {
  try {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(firebaseConfig.recaptchaSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
  } catch {
    // Ignore duplicate App Check init during hot reload
  }
}

let secondaryAppInstance: FirebaseApp | null = null;
let secondaryAuthInstance: Auth | null = null;

async function getSecondaryProvisioningAuth(): Promise<Auth> {
  if (!secondaryAppInstance) {
    const existing = getApps().find((a) => a.name === 'sims-provisioning-worker');
    secondaryAppInstance =
      existing || initializeApp(firebaseConfig, 'sims-provisioning-worker');
  }
  if (!secondaryAuthInstance) {
    secondaryAuthInstance = getAuth(secondaryAppInstance);
  }
  await setPersistence(secondaryAuthInstance, inMemoryPersistence);
  return secondaryAuthInstance;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      clean[key] = value;
    }
  }
  return clean as T;
}

export function formatFirebaseAuthError(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: string }).code)
      : '';
  const msg = error instanceof Error ? error.message : String(error);

  if (code === 'auth/operation-not-allowed' || code === 'auth/configuration-not-found') {
    return 'Provider Email/Password belum diaktifkan di Firebase Console (Authentication → Sign-in method → Email/Password). Aktifkan terlebih dahulu agar login & pembuatan akun berjalan.';
  }
  if (
    code === 'auth/invalid-credential' ||
    code === 'auth/wrong-password' ||
    code === 'auth/user-not-found'
  ) {
    return 'Username atau password tidak sesuai. Periksa kembali kredensial Anda.';
  }
  if (code === 'auth/too-many-requests') {
    return 'Terlalu banyak permintaan ke layanan autentikasi. Silakan tunggu beberapa saat sebelum mencoba lagi.';
  }
  if (code === 'auth/email-already-in-use') {
    return 'Email atau username tersebut sudah terdaftar di Firebase Authentication.';
  }
  if (code === 'auth/weak-password') {
    return 'Password terlalu lemah. Gunakan minimal 8 karakter dengan kombinasi huruf besar, huruf kecil, dan angka.';
  }
  if (code === 'auth/requires-recent-login') {
    return 'Sesi login perlu diperbarui untuk mengganti password. Masukkan password saat ini atau login ulang.';
  }
  if (code === 'auth/user-disabled') {
    return 'Akun dinonaktifkan di Firebase Authentication.';
  }
  if (code === 'permission-denied' || msg.includes('Missing or insufficient permissions')) {
    return 'Akses Firestore ditolak (permission-denied). Periksa kecocokan Security Rules atau apakah registrasi sekolah sudah dikunci.';
  }
  if (msg.includes('Username atau password')) return msg;
  if (msg.includes('dinonaktifkan')) return msg;
  if (msg.includes('Email ini sudah terdaftar')) return msg;
  if (msg.includes('Registrasi sekolah pertama')) return msg;
  if (msg.includes('sudah digunakan')) return msg;
  return msg || 'Terjadi kesalahan autentikasi Firebase.';
}

export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
      return false;
    }
    return true;
  }
}

export async function signInWithGooglePopup() {
  return signInWithPopup(auth, googleProvider);
}

export async function signOutFirebase() {
  return signOut(auth);
}

export async function fetchBootstrapState(): Promise<{
  initialized: boolean;
  config?: BootstrapConfig;
  error?: string;
}> {
  try {
    let snap;
    try {
      snap = await getDocFromServer(doc(db, 'system_config', 'bootstrap'));
    } catch {
      snap = await getDoc(doc(db, 'system_config', 'bootstrap'));
    }
    if (!snap.exists()) {
      return { initialized: false };
    }
    const cfg = snap.data() as BootstrapConfig;
    return { initialized: Boolean(cfg.initialized), config: cfg };
  } catch (err) {
    return {
      initialized: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function verifyFirebaseEmailTokenWithBackend(user: User): Promise<{
  uid: string;
  email: string | null;
  emailVerified: true;
  verifiedAt: string;
}> {
  const idToken = await user.getIdToken(true);
  const res = await fetch('/api/auth/verify-email-token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
  });

  const payload = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    emailVerified?: boolean;
    uid?: string;
    email?: string | null;
    verifiedAt?: string;
    message?: string;
  };

  if (!res.ok || !payload.ok || payload.emailVerified !== true || !payload.uid) {
    throw new Error(
      payload.message ||
        'Verifikasi token email di backend gagal. Pastikan email Anda sudah terverifikasi.'
    );
  }

  return {
    uid: payload.uid,
    email: payload.email ?? null,
    emailVerified: true,
    verifiedAt: payload.verifiedAt || new Date().toISOString(),
  };
}

export async function sendVerificationEmailWithGuardFirebase(user: User): Promise<{
  alreadyVerified: boolean;
  sent: boolean;
  cooldownSeconds?: number;
  remainingAttemptsInWindow?: number;
}> {
  await user.reload();
  if (user.emailVerified) {
    return { alreadyVerified: true, sent: false };
  }

  const idToken = await user.getIdToken(true);
  const guardRes = await fetch('/api/auth/verification-resend-check', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
  });

  const guardPayload = (await guardRes.json().catch(() => ({}))) as {
    ok?: boolean;
    alreadyVerified?: boolean;
    rateLimited?: boolean;
    retryAfterSeconds?: number;
    cooldownSeconds?: number;
    remainingAttemptsInWindow?: number;
    message?: string;
  };

  if (guardPayload.alreadyVerified) {
    return { alreadyVerified: true, sent: false };
  }

  if (guardRes.status === 429 || guardPayload.rateLimited) {
    const err = new Error(
      guardPayload.message ||
        `Terlalu sering mengirim ulang email verifikasi. Coba lagi dalam ${
          guardPayload.retryAfterSeconds || 60
        } detik.`
    ) as Error & { rateLimited?: boolean; retryAfterSeconds?: number };
    err.rateLimited = true;
    err.retryAfterSeconds = guardPayload.retryAfterSeconds || 60;
    throw err;
  }

  if (!guardRes.ok || !guardPayload.ok) {
    throw new Error(
      guardPayload.message || 'Gagal memeriksa pembatasan pengiriman ulang email.'
    );
  }

  await sendEmailVerification(user);
  return {
    alreadyVerified: false,
    sent: true,
    cooldownSeconds: guardPayload.cooldownSeconds || 60,
    remainingAttemptsInWindow: guardPayload.remainingAttemptsInWindow,
  };
}

export async function startFirstSchoolAdminRegistrationFirebase(params: {
  adminName: string;
  username: string;
  email: string;
  phoneNumber: string;
  password: string;
  schoolName: string;
  npsn?: string;
  schoolAddress: string;
}): Promise<{
  status: 'verification_required' | 'already_verified';
  user: User;
  draft: PendingAdminBootstrapDraft;
  verificationEmailSent: boolean;
  cooldownNotice?: string;
}> {
  await setPersistence(auth, browserLocalPersistence);
  const usernameKey = buildUsernameLookupKey(params.username);
  const authEmail = params.email.trim().toLowerCase();

  // Pastikan username belum digunakan oleh akun lain sebelum membuat user Firebase Auth
  try {
    const preLookupSnap = await getDoc(doc(db, 'username_lookup', usernameKey));
    if (preLookupSnap.exists()) {
      const existingLookup = preLookupSnap.data() as { uid?: string };
      if (!auth.currentUser || existingLookup.uid !== auth.currentUser.uid) {
        throw new Error(
          `Username "${usernameKey}" sudah digunakan. Silakan pilih username lain.`
        );
      }
    }
  } catch (lookupErr) {
    if (lookupErr instanceof Error && lookupErr.message.includes('sudah digunakan')) {
      throw lookupErr;
    }
  }

  let authUser: User;
  let isRecoveredAccount = false;

  try {
    const cred = await createUserWithEmailAndPassword(auth, authEmail, params.password);
    authUser = cred.user;
  } catch (authErr) {
    const code =
      typeof authErr === 'object' && authErr !== null && 'code' in authErr
        ? String((authErr as { code?: string }).code)
        : '';

    if (code !== 'auth/email-already-in-use') {
      throw authErr;
    }

    // Pulihkan akun Firebase Auth yang sudah dibuat sebelumnya bila kredensial cocok dan profil belum aktif
    try {
      const existingCred = await signInWithEmailAndPassword(auth, authEmail, params.password);
      authUser = existingCred.user;
      isRecoveredAccount = true;
    } catch (loginErr) {
      const loginCode =
        typeof loginErr === 'object' && loginErr !== null && 'code' in loginErr
          ? String((loginErr as { code?: string }).code)
          : '';
      if (
        loginCode === 'auth/wrong-password' ||
        loginCode === 'auth/invalid-credential'
      ) {
        throw new Error(
          'Email ini sudah terdaftar di Firebase Authentication. Jika ini akun Anda yang belum terverifikasi, masukkan password yang sama; jika sudah aktif, gunakan tab Masuk Akun.'
        );
      }
      throw loginErr;
    }

    // Jika profil SIMS sudah aktif di Firestore, arahkan pengguna ke tab Masuk Akun
    try {
      const existingProfileSnap = await getDoc(doc(db, 'users', authUser.uid));
      if (existingProfileSnap.exists()) {
        await signOut(auth);
        throw new Error(
          'Email ini sudah terdaftar dan aktif di SIMS. Silakan masuk melalui tab Masuk Akun menggunakan username Anda.'
        );
      }
    } catch (profileErr) {
      if (profileErr instanceof Error && profileErr.message.includes('sudah terdaftar dan aktif')) {
        throw profileErr;
      }
    }
  }

  try {
    await updateProfile(authUser, { displayName: params.adminName.trim() });
  } catch {
    // Non-fatal
  }

  await authUser.reload();

  const schoolId = buildDeterministicSchoolId(
    params.schoolName,
    params.npsn,
    authUser.uid
  );

  const draft: PendingAdminBootstrapDraft = {
    uid: authUser.uid,
    schoolId,
    email: authEmail,
    adminName: params.adminName.trim(),
    username: usernameKey,
    phoneNumber: params.phoneNumber.trim(),
    schoolName: params.schoolName.trim(),
    npsn: params.npsn?.trim() || '',
    schoolAddress: params.schoolAddress.trim(),
    createdAt: new Date().toISOString(),
  };

  if (authUser.emailVerified) {
    return {
      status: 'already_verified',
      user: authUser,
      draft,
      verificationEmailSent: false,
    };
  }

  let verificationEmailSent = false;
  let cooldownNotice: string | undefined;

  try {
    const sendRes = await sendVerificationEmailWithGuardFirebase(authUser);
    if (sendRes.alreadyVerified) {
      return {
        status: 'already_verified',
        user: authUser,
        draft,
        verificationEmailSent: false,
      };
    }
    verificationEmailSent = sendRes.sent;
  } catch (sendErr) {
    const isRateLimited =
      typeof sendErr === 'object' &&
      sendErr !== null &&
      'rateLimited' in sendErr &&
      Boolean((sendErr as { rateLimited?: boolean }).rateLimited);
    if (isRecoveredAccount && isRateLimited) {
      cooldownNotice =
        sendErr instanceof Error
          ? sendErr.message
          : 'Email verifikasi sebelumnya baru saja dikirim. Silakan cek kotak masuk atau tunggu sebelum mengirim ulang.';
    } else if (isRecoveredAccount) {
      cooldownNotice =
        'Akun autentikasi ditemukan dan proses registrasi dilanjutkan. Jika email verifikasi belum diterima, gunakan tombol Kirim ulang email verifikasi.';
    } else {
      throw sendErr;
    }
  }

  return {
    status: 'verification_required',
    user: authUser,
    draft,
    verificationEmailSent,
    cooldownNotice,
  };
}

export async function completeVerifiedAdminBootstrapFirebase(
  draft: PendingAdminBootstrapDraft
): Promise<{
  school: School;
  adminUser: UserAccount;
  bootstrap: BootstrapConfig;
  alreadyCompleted: boolean;
}> {
  const current = auth.currentUser;
  if (!current || current.uid !== draft.uid) {
    throw new Error(
      'Sesi Firebase Authentication tidak ditemukan. Silakan masuk atau ulangi proses registrasi dengan email & password yang sama.'
    );
  }

  await current.reload();
  if (!current.emailVerified) {
    throw new Error(
      'Email Anda belum terverifikasi. Silakan klik tautan verifikasi pada email Anda terlebih dahulu, lalu tekan tombol "Saya sudah melakukan verifikasi".'
    );
  }

  // Wajib verifikasi token Firebase di backend dan periksa klaim email_verified
  const backendVerified = await verifyFirebaseEmailTokenWithBackend(current);
  const uid = backendVerified.uid;
  const usernameKey = buildUsernameLookupKey(draft.username);
  const authEmail = (backendVerified.email || current.email || draft.email)
    .trim()
    .toLowerCase();
  const schoolId =
    draft.schoolId ||
    buildDeterministicSchoolId(draft.schoolName, draft.npsn, uid);

  const nowIso = new Date().toISOString();
  const bootstrap: BootstrapConfig = {
    initialized: true,
    primarySchoolId: schoolId,
    primaryAdminUid: uid,
    createdAt: nowIso,
  };
  const school: School = {
    schoolId,
    name: draft.schoolName.trim(),
    npsn: draft.npsn?.trim() || '00000000',
    address: draft.schoolAddress.trim(),
    latitude: -6.917464,
    longitude: 107.619123,
    geofenceRadiusMeters: 250,
    allowedWifiLabel: 'SIMS-SEKOLAH-WIFI',
    requireEmailVerificationForUsers: false,
    adminUid: uid,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  const adminUser: UserAccount = {
    uid,
    schoolId,
    name: draft.adminName.trim(),
    username: usernameKey,
    usernameKey,
    email: authEmail,
    authEmail,
    phoneNumber: draft.phoneNumber.trim(),
    role: 'school_admin',
    isActive: true,
    mustChangePassword: false,
    emailVerified: true,
    emailVerifiedAt: backendVerified.verifiedAt || nowIso,
    jobTitle: 'Admin Sekolah Utama',
    firstLoginAt: nowIso,
    lastLoginAt: nowIso,
    createdAt: nowIso,
    createdBy: uid,
    updatedAt: nowIso,
  };

  const lookupPayload = {
    lookupKey: usernameKey,
    usernameKey,
    schoolId,
    uid,
    authEmail,
    isActive: true,
    updatedAt: nowIso,
  };

  const logId = `log-bootstrap-${uid.slice(0, 12)}`;
  const bootstrapAuditLog = {
    id: logId,
    schoolId,
    actorId: uid,
    actorName: adminUser.name,
    actorRole: 'school_admin',
    module: 'akun',
    action: 'REGISTER_FIRST_SCHOOL_ADMIN',
    targetId: uid,
    summary: `Registrasi awal sekolah "${school.name}" dan penetapan Admin Sekolah pertama (${adminUser.username}) setelah verifikasi email.`,
    createdAt: nowIso,
  };

  let idempotentResult: {
    school: School;
    adminUser: UserAccount;
    bootstrap: BootstrapConfig;
    alreadyCompleted: boolean;
  } | null = null;

  await runTransaction(db, async (tx) => {
    const existingUserRef = doc(db, 'users', uid);
    const existingUserSnap = await tx.get(existingUserRef);
    if (existingUserSnap.exists()) {
      const existingUser = existingUserSnap.data() as UserAccount;
      if (existingUser.role === 'school_admin' && existingUser.schoolId) {
        const existingSchoolSnap = await tx.get(doc(db, 'schools', existingUser.schoolId));
        if (existingSchoolSnap.exists()) {
          idempotentResult = {
            school: existingSchoolSnap.data() as School,
            adminUser: existingUser,
            bootstrap: {
              initialized: true,
              primarySchoolId: existingUser.schoolId,
              primaryAdminUid: uid,
              createdAt: existingUser.createdAt || nowIso,
            },
            alreadyCompleted: true,
          };
          return;
        }
      }
      throw new Error(
        'Akun ini sudah memiliki profil SIMS aktif. Silakan masuk melalui tab Masuk Akun.'
      );
    }

    const lookupRef = doc(db, 'username_lookup', usernameKey);
    const lookupSnap = await tx.get(lookupRef);
    if (lookupSnap.exists()) {
      const existingLookup = lookupSnap.data() as { uid?: string };
      if (existingLookup.uid !== uid) {
        throw new Error(`Username "${usernameKey}" sudah digunakan.`);
      }
    }

    const schoolRef = doc(db, 'schools', schoolId);
    const schoolSnap = await tx.get(schoolRef);
    if (schoolSnap.exists()) {
      const existingSchool = schoolSnap.data() as School;
      if (existingSchool.adminUid && existingSchool.adminUid !== uid) {
        throw new Error(
          `Tenant sekolah "${schoolId}" sudah terdaftar. Silakan sesuaikan nama sekolah atau NPSN.`
        );
      }
    }

    tx.set(
      schoolRef,
      stripUndefined(school as unknown as Record<string, unknown>)
    );
    tx.set(
      doc(db, 'schools', schoolId, 'users', uid),
      stripUndefined(adminUser as unknown as Record<string, unknown>)
    );
    tx.set(
      existingUserRef,
      stripUndefined(adminUser as unknown as Record<string, unknown>)
    );
    tx.set(
      doc(db, 'schools', schoolId, 'username_index', usernameKey),
      stripUndefined(lookupPayload)
    );
    tx.set(lookupRef, stripUndefined(lookupPayload));
    tx.set(
      doc(db, 'schools', schoolId, 'audit_logs', logId),
      stripUndefined(bootstrapAuditLog)
    );
  });

  if (idempotentResult) {
    return idempotentResult;
  }

  return { school, adminUser, bootstrap, alreadyCompleted: false };
}

export async function loginWithUsernameAndPasswordFirebase(
  username: string,
  password: string
): Promise<{ user: User; profile: UserAccount; school: School | null }> {
  const usernameKey = buildUsernameLookupKey(username);
  if (!usernameKey) {
    throw new Error('Username wajib diisi.');
  }

  let lookupSnap;
  try {
    lookupSnap = await getDoc(doc(db, 'username_lookup', usernameKey));
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `username_lookup/${usernameKey}`);
  }

  if (!lookupSnap.exists()) {
    throw new Error('Username atau password tidak valid.');
  }
  const lookup = lookupSnap.data() as {
    authEmail: string;
    schoolId: string;
    uid: string;
    isActive: boolean;
  };
  if (lookup.isActive === false) {
    throw new Error(
      'Akun Anda berstatus nonaktif. Hubungi Admin Sekolah untuk mengaktifkan kembali akun.'
    );
  }

  await setPersistence(auth, browserLocalPersistence);
  const cred = await signInWithEmailAndPassword(auth, lookup.authEmail, password);
  const uid = cred.user.uid;

  let profileSnap = await getDoc(doc(db, 'schools', lookup.schoolId, 'users', uid));
  if (!profileSnap.exists()) {
    profileSnap = await getDoc(doc(db, 'users', uid));
  }
  if (!profileSnap.exists()) {
    await signOut(auth);
    throw new Error('Profil pengguna tidak ditemukan di sekolah terkait.');
  }

  const profile = profileSnap.data() as UserAccount;
  if (!profile.isActive) {
    await signOut(auth);
    throw new Error(
      'Akun Anda telah dinonaktifkan oleh Admin Sekolah dan tidak dapat mengakses sistem.'
    );
  }

  const nowIso = new Date().toISOString();
  const loginPatch: Partial<UserAccount> = {
    lastLoginAt: nowIso,
    updatedAt: nowIso,
  };
  if (!profile.firstLoginAt) {
    loginPatch.firstLoginAt = nowIso;
  }

  try {
    await updateDoc(doc(db, 'schools', profile.schoolId, 'users', uid), loginPatch);
    await updateDoc(doc(db, 'users', uid), loginPatch);
  } catch {
    // Non-fatal timestamp update
  }

  let school: School | null = null;
  try {
    const schoolSnap = await getDoc(doc(db, 'schools', profile.schoolId));
    if (schoolSnap.exists()) {
      school = schoolSnap.data() as School;
    }
  } catch {
    // Ignore
  }

  return {
    user: cred.user,
    profile: { ...profile, ...loginPatch },
    school,
  };
}

export async function fetchAuthenticatedUserProfile(
  uid: string
): Promise<{ profile: UserAccount; school: School | null } | null> {
  const userSnap = await getDoc(doc(db, 'users', uid));
  if (!userSnap.exists()) return null;
  const profile = userSnap.data() as UserAccount;
  let school: School | null = null;
  try {
    const schoolSnap = await getDoc(doc(db, 'schools', profile.schoolId));
    if (schoolSnap.exists()) school = schoolSnap.data() as School;
  } catch {
    // Ignore
  }
  return { profile, school };
}

export async function completeMandatoryPasswordChangeFirebase(params: {
  uid: string;
  schoolId: string;
  actorName: string;
  actorRole: UserAccount['role'];
  newPassword: string;
}): Promise<string> {
  const current = auth.currentUser;
  if (!current || current.uid !== params.uid) {
    throw new Error('Sesi Firebase Auth tidak valid. Silakan login ulang.');
  }
  await updatePassword(current, params.newPassword);
  const nowIso = new Date().toISOString();
  const patch = {
    mustChangePassword: false,
    passwordChangedAt: nowIso,
    updatedAt: nowIso,
  };

  try {
    await updateDoc(doc(db, 'schools', params.schoolId, 'users', params.uid), patch);
    await updateDoc(doc(db, 'users', params.uid), patch);
    const logId = `log-pw-${Date.now()}`;
    await setDoc(doc(db, 'schools', params.schoolId, 'audit_logs', logId), {
      id: logId,
      schoolId: params.schoolId,
      actorId: params.uid,
      actorName: params.actorName,
      actorRole: params.actorRole,
      module: 'akun',
      action: 'FIRST_LOGIN_PASSWORD_CHANGED',
      targetId: params.uid,
      summary: `${params.actorName} menyelesaikan penggantian password wajib saat login pertama.`,
      createdAt: nowIso,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${params.uid}`);
  }
  return nowIso;
}

export async function changeOwnPasswordFirebase(params: {
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  const current = auth.currentUser;
  if (!current || !current.email) {
    throw new Error('Sesi login Firebase tidak aktif.');
  }
  const cred = EmailAuthProvider.credential(current.email, params.currentPassword);
  await reauthenticateWithCredential(current, cred);
  await updatePassword(current, params.newPassword);
}

export async function createSchoolUserAccountWithAuth(params: {
  schoolId: string;
  createdByUid: string;
  accountDraft: Omit<
    UserAccount,
    'uid' | 'authEmail' | 'usernameKey' | 'createdAt' | 'createdBy' | 'updatedAt' | 'mustChangePassword'
  >;
  initialPassword: string;
  existingAuthEmails: string[];
  parentRelations?: Omit<ParentStudentRelation, 'id' | 'schoolId' | 'parentUid' | 'createdAt'>[];
}): Promise<{ createdUser: UserAccount; createdRelations: ParentStudentRelation[] }> {
  const usernameKey = buildUsernameLookupKey(params.accountDraft.username);
  const authEmail = resolveAuthEmailForAccount({
    usernameKey,
    schoolId: params.schoolId,
    personalEmail: params.accountDraft.email,
    existingAuthEmails: params.existingAuthEmails,
  });

  const secAuth = await getSecondaryProvisioningAuth();
  const cred = await createUserWithEmailAndPassword(secAuth, authEmail, params.initialPassword);
  const newUid = cred.user.uid;
  try {
    await updateProfile(cred.user, { displayName: params.accountDraft.name.trim() });
  } catch {
    // Non-fatal
  }

  const nowIso = new Date().toISOString();
  const mustChange = mustChangePasswordForRole(params.accountDraft.role);

  const createdUser: UserAccount = {
    ...params.accountDraft,
    uid: newUid,
    schoolId: params.schoolId,
    username: usernameKey,
    usernameKey,
    email: (params.accountDraft.email || authEmail).trim(),
    authEmail,
    mustChangePassword: mustChange,
    createdAt: nowIso,
    createdBy: params.createdByUid,
    updatedAt: nowIso,
  };

  const lookupPayload = {
    lookupKey: usernameKey,
    usernameKey,
    schoolId: params.schoolId,
    uid: newUid,
    authEmail,
    isActive: createdUser.isActive,
    updatedAt: nowIso,
  };

  const createdRelations: ParentStudentRelation[] = (params.parentRelations || []).map(
    (rel) => ({
      id: `rel-${newUid}-${rel.studentUid}`,
      schoolId: params.schoolId,
      parentUid: newUid,
      studentUid: rel.studentUid,
      relationship: rel.relationship,
      isPrimary: rel.isPrimary,
      createdAt: nowIso,
      createdBy: params.createdByUid,
    })
  );

  try {
    await runTransaction(db, async (tx) => {
      const lookupRef = doc(db, 'username_lookup', usernameKey);
      const indexRef = doc(db, 'schools', params.schoolId, 'username_index', usernameKey);
      const [lookupSnap, indexSnap] = await Promise.all([
        tx.get(lookupRef),
        tx.get(indexRef),
      ]);
      if (lookupSnap.exists() || indexSnap.exists()) {
        throw new Error(`Username "${usernameKey}" sudah dipakai oleh pengguna lain.`);
      }

      tx.set(lookupRef, stripUndefined(lookupPayload));
      tx.set(indexRef, stripUndefined(lookupPayload));
      tx.set(doc(db, 'schools', params.schoolId, 'users', newUid), stripUndefined(createdUser as unknown as Record<string, unknown>));
      tx.set(doc(db, 'users', newUid), stripUndefined(createdUser as unknown as Record<string, unknown>));

      for (const rel of createdRelations) {
        tx.set(
          doc(db, 'schools', params.schoolId, 'parent_student_relations', rel.id),
          stripUndefined(rel as unknown as Record<string, unknown>)
        );
      }
    });
  } catch (err) {
    try {
      await cred.user.delete();
    } catch {
      // Ignore secondary cleanup error
    }
    await signOut(secAuth);
    throw err;
  }

  await signOut(secAuth);
  return { createdUser, createdRelations };
}

export async function updateSchoolUserFirestore(user: UserAccount): Promise<void> {
  if (!auth.currentUser) return;
  const nowIso = new Date().toISOString();
  const payload = stripUndefined({ ...user, updatedAt: nowIso } as unknown as Record<string, unknown>);
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'schools', user.schoolId, 'users', user.uid), payload, { merge: true });
    batch.set(doc(db, 'users', user.uid), payload, { merge: true });
    batch.set(
      doc(db, 'username_lookup', user.usernameKey),
      stripUndefined({
        lookupKey: user.usernameKey,
        usernameKey: user.usernameKey,
        schoolId: user.schoolId,
        uid: user.uid,
        authEmail: user.authEmail || user.email || `${user.usernameKey}.${user.schoolId}@sims.local`,
        isActive: user.isActive,
        updatedAt: nowIso,
      }),
      { merge: true }
    );
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `schools/${user.schoolId}/users/${user.uid}`);
  }
}

export async function deleteSchoolUserFirestore(user: UserAccount): Promise<void> {
  if (!auth.currentUser) return;
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'schools', user.schoolId, 'users', user.uid));
    batch.delete(doc(db, 'users', user.uid));
    batch.delete(doc(db, 'schools', user.schoolId, 'username_index', user.usernameKey));
    batch.delete(doc(db, 'username_lookup', user.usernameKey));
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `schools/${user.schoolId}/users/${user.uid}`);
  }
}

export async function sendResetEmailForUserFirebase(authEmail: string): Promise<void> {
  await sendPasswordResetEmail(auth, authEmail);
}

export async function syncParentStudentRelationFirestore(
  relation: ParentStudentRelation
): Promise<void> {
  if (!auth.currentUser) return;
  const path = `schools/${relation.schoolId}/parent_student_relations/${relation.id}`;
  try {
    await setDoc(doc(db, path), relation, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deleteParentStudentRelationFirestore(
  schoolId: string,
  relationId: string
): Promise<void> {
  if (!auth.currentUser) return;
  const path = `schools/${schoolId}/parent_student_relations/${relationId}`;
  try {
    await deleteDoc(doc(db, path));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function logImportJobFirestore(job: ImportJobRecord): Promise<void> {
  if (!auth.currentUser) return;
  const path = `schools/${job.schoolId}/import_jobs/${job.id}`;
  try {
    await setDoc(doc(db, path), job);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function fetchSchoolDirectoryFromFirestore(schoolId: string): Promise<{
  users: UserAccount[];
  relations: ParentStudentRelation[];
  importJobs: ImportJobRecord[];
}> {
  const users: UserAccount[] = [];
  const relations: ParentStudentRelation[] = [];
  const importJobs: ImportJobRecord[] = [];
  try {
    const usersSnap = await getDocs(collection(db, 'schools', schoolId, 'users'));
    usersSnap.forEach((d) => users.push(d.data() as UserAccount));
  } catch {
    // Non-admin/principal roles fall back gracefully
  }
  try {
    const relSnap = await getDocs(collection(db, 'schools', schoolId, 'parent_student_relations'));
    relSnap.forEach((d) => relations.push(d.data() as ParentStudentRelation));
  } catch {
    // Ignore
  }
  try {
    const jobsSnap = await getDocs(query(collection(db, 'schools', schoolId, 'import_jobs'), where('schoolId', '==', schoolId)));
    jobsSnap.forEach((d) => importJobs.push(d.data() as ImportJobRecord));
  } catch {
    // Ignore
  }
  return { users, relations, importJobs };
}

export async function uploadSubmissionPhotoToStorage(
  schoolId: string,
  assignmentId: string,
  studentId: string,
  blob: Blob,
  filename: string
): Promise<string> {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storageRef = ref(
    storage,
    `schools/${schoolId}/assignments/${assignmentId}/${studentId}/${Date.now()}_${safeName}`
  );
  await uploadBytes(storageRef, blob, { contentType: blob.type || 'image/jpeg' });
  return getDownloadURL(storageRef);
}

export async function syncDocumentToFirestore(
  collectionName: string,
  docId: string,
  payload: Record<string, unknown>
): Promise<void> {
  if (!auth.currentUser) return;
  const path = `${collectionName}/${docId}`;
  try {
    await setDoc(doc(db, collectionName, docId), stripUndefined(payload), { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function syncEmailVerifiedStatusFirestore(params: {
  uid: string;
  schoolId: string;
  verifiedAt: string;
}): Promise<void> {
  if (!auth.currentUser || auth.currentUser.uid !== params.uid) return;
  const nowIso = new Date().toISOString();
  const patch = {
    emailVerified: true,
    emailVerifiedAt: params.verifiedAt,
    updatedAt: nowIso,
  };
  try {
    await updateDoc(doc(db, 'schools', params.schoolId, 'users', params.uid), patch);
    await updateDoc(doc(db, 'users', params.uid), patch);
  } catch {
    // Non-fatal sync
  }
}

export async function deleteDocumentFromFirestore(
  collectionName: string,
  docId: string
): Promise<void> {
  if (!auth.currentUser) return;
  const path = `${collectionName}/${docId}`;
  try {
    await deleteDoc(doc(db, collectionName, docId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
