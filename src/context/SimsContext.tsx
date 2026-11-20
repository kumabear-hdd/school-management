import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { createEmptySchoolDataset, type SimsDataset } from '../data/demoSeed';
import {
  auth,
  changeOwnPasswordFirebase,
  completeMandatoryPasswordChangeFirebase,
  completeVerifiedAdminBootstrapFirebase,
  createSchoolUserAccountWithAuth,
  deleteDocumentFromFirestore,
  deleteParentStudentRelationFirestore,
  deleteSchoolUserFirestore,
  fetchAuthenticatedUserProfile,
  fetchBootstrapState,
  fetchSchoolDirectoryFromFirestore,
  formatFirebaseAuthError,
  logImportJobFirestore,
  loginWithUsernameAndPasswordFirebase,
  sendResetEmailForUserFirebase,
  sendVerificationEmailWithGuardFirebase,
  signInWithGooglePopup,
  signOutFirebase,
  startFirstSchoolAdminRegistrationFirebase,
  syncDocumentToFirestore,
  syncEmailVerifiedStatusFirestore,
  syncParentStudentRelationFirestore,
  testConnection,
  updateSchoolUserFirestore,
  uploadSubmissionPhotoToStorage,
  verifyFirebaseEmailTokenWithBackend,
} from '../lib/firebase';
import {
  buildGradeAuditSummary,
  calculateWeightedFinalScore,
  canTeacherManageSubjectClass,
  validateSchoolProfileUpdate,
} from '../utils/academicLogic';
import { validateSchoolLocationInput } from '../utils/attendanceLogic';
import {
  determineSubmissionStatus,
  validateTeacherVerificationDecision,
} from '../utils/assignmentLogic';
import {
  buildUsernameLookupKey,
  checkLoginRateLimit,
  generateUsernameFromName,
  mustChangePasswordForRole,
  normalizeUserRole,
  recordFailedLoginAttempt,
  ROLE_LABELS,
  validateFirstAdminRegistration,
  validatePasswordStrength,
  validateSingleUserInput,
  type FirstAdminRegistrationInput,
  type LoginRateLimitState,
  type SingleUserCreateInput,
} from '../utils/authLogic';
import type {
  BulkImportExecutionResult,
  BulkValidatedRow,
} from '../utils/bulkUserUtils';
import {
  checkResendRateLimit,
  recordResendAttempt,
  shouldRequireEmailVerificationForLogin,
  type ResendRateLimitState,
} from '../utils/emailVerificationLogic';
import type {
  AcademicGrade,
  AssessmentComponent,
  Assignment,
  AssignmentNotification,
  AssignmentSubmission,
  AttendanceRecord,
  AuditLogEntry,
  AuthSessionStatus,
  Curriculum,
  GuestbookEntry,
  ImportJobRecord,
  OfflineQueueItem,
  ParentStudentRelation,
  PendingAdminBootstrapDraft,
  PpdbRegistration,
  ScheduleItem,
  School,
  SchoolClass,
  SchoolLocation,
  Subject,
  SubmissionHistoryEntry,
  SurveyResponse,
  TeachingAgenda,
  TeachingAssignment,
  UserAccount,
  UserRole,
} from '../types/sims';

const STORAGE_KEY = 'sims_terpadu_dataset_v3';
const OFFLINE_QUEUE_KEY = 'sims_terpadu_offline_queue_v1';
const RATE_LIMIT_KEY = 'sims_terpadu_login_rate_limit_v1';
const PENDING_ADMIN_DRAFT_KEY = 'sims_terpadu_pending_admin_draft_v1';
const RESEND_RATE_LIMIT_KEY = 'sims_terpadu_email_resend_limit_v1';

const GUEST_PLACEHOLDER_USER: UserAccount = {
  uid: 'unauthenticated',
  schoolId: 'pending-tenant',
  name: 'Tamu',
  username: 'guest',
  usernameKey: 'guest',
  email: '',
  role: 'student',
  isActive: false,
  mustChangePassword: false,
};

interface SimsContextValue {
  data: SimsDataset;
  currentUser: UserAccount;
  firebaseUser: User | null;
  firebaseReady: boolean;
  authStatus: AuthSessionStatus;
  bootstrapInitialized: boolean;
  bootstrapLoading: boolean;
  pendingAdminDraft: PendingAdminBootstrapDraft | null;
  pendingVerificationContext: 'first_admin_bootstrap' | 'policy_login' | null;
  resendRateLimitState: ResendRateLimitState | undefined;
  simulatedOffline: boolean;
  browserOffline: boolean;
  isOffline: boolean;
  offlineQueue: OfflineQueueItem[];
  statusMessage: string | null;
  clearStatusMessage: () => void;
  setSimulatedOffline: (val: boolean) => void;
  // Auth & Session
  refreshBootstrapStatus: () => Promise<void>;
  registerFirstSchoolAdmin: (
    input: FirstAdminRegistrationInput
  ) => Promise<{ ok: boolean; requiresEmailVerification?: boolean; error?: string }>;
  resendVerificationEmail: () => Promise<{
    ok: boolean;
    alreadyVerified?: boolean;
    retryAfterSeconds?: number;
    error?: string;
  }>;
  checkEmailVerificationAndProceed: (
    overrideDraft?: PendingAdminBootstrapDraft
  ) => Promise<{ ok: boolean; error?: string }>;
  cancelPendingVerification: () => Promise<void>;
  loginWithUsernamePassword: (
    username: string,
    password: string
  ) => Promise<{
    ok: boolean;
    error?: string;
    mustChangePassword?: boolean;
    requiresEmailVerification?: boolean;
  }>;
  logoutSession: () => Promise<void>;
  completeFirstLoginPasswordChange: (
    newPassword: string
  ) => Promise<{ ok: boolean; error?: string }>;
  changeMyPassword: (
    currentPassword: string,
    newPassword: string
  ) => Promise<{ ok: boolean; error?: string }>;
  loginWithGoogle: () => Promise<void>;
  logoutGoogle: () => Promise<void>;
  syncOfflineQueueNow: () => Promise<void>;
  // Manajemen Pengguna (school_admin)
  createSingleUserAccount: (input: SingleUserCreateInput) => Promise<{
    ok: boolean;
    error?: string;
    user?: UserAccount;
    tempPassword?: string;
  }>;
  bulkCreateUsers: (params: {
    rows: BulkValidatedRow[];
    sourceType: 'excel_csv' | 'dynamic_table';
    onProgress?: (completed: number, total: number) => void;
  }) => Promise<{
    results: BulkImportExecutionResult[];
    job: ImportJobRecord;
  }>;
  updateUserAccountProfile: (
    uid: string,
    patch: Partial<UserAccount>
  ) => Promise<{ ok: boolean; error?: string }>;
  toggleUserActiveStatus: (uid: string) => Promise<{ ok: boolean; error?: string }>;
  resetUserPasswordAction: (uid: string) => Promise<{
    ok: boolean;
    emailSent: boolean;
    message: string;
  }>;
  deleteUserAccount: (uid: string) => Promise<{ ok: boolean; error?: string }>;
  linkParentAndStudent: (params: {
    parentUid: string;
    studentUid: string;
    relationship: 'Ayah' | 'Ibu' | 'Wali';
  }) => Promise<{ ok: boolean; error?: string }>;
  unlinkParentAndStudent: (relationId: string) => Promise<{ ok: boolean; error?: string }>;
  // Akademik
  addSubject: (payload: Omit<Subject, 'id' | 'schoolId'>) => void;
  addCurriculum: (payload: Omit<Curriculum, 'id' | 'schoolId'>) => void;
  setActiveCurriculum: (curriculumId: string) => void;
  addClass: (payload: Omit<SchoolClass, 'id' | 'schoolId'>) => void;
  addTeachingAssignment: (payload: Omit<TeachingAssignment, 'id' | 'schoolId'>) => void;
  addSchedule: (payload: Omit<ScheduleItem, 'id' | 'schoolId'>) => void;
  addTeachingAgenda: (payload: Omit<TeachingAgenda, 'id' | 'schoolId' | 'teacherId'>) => void;
  updateAssessmentComponents: (components: AssessmentComponent[]) => { ok: boolean; error?: string };
  upsertAcademicGrade: (params: {
    studentId: string;
    classId: string;
    subjectId: string;
    scores: Record<string, number>;
  }) => { ok: boolean; error?: string };
  // E-Tugas
  createAssignment: (payload: {
    subjectId: string;
    classId: string;
    title: string;
    instructions: string;
    assignedDate: string;
    dueDate: string;
    allowNumericScore: boolean;
    maxPhotos: number;
    maxFileSizeMb: number;
    attachmentName?: string;
  }) => { ok: boolean; error?: string };
  updateAssignment: (
    assignmentId: string,
    patch: Partial<
      Pick<
        Assignment,
        'title' | 'instructions' | 'dueDate' | 'status' | 'allowNumericScore' | 'maxPhotos' | 'maxFileSizeMb'
      >
    >
  ) => void;
  deleteAssignment: (assignmentId: string) => void;
  submitAssignmentPhotos: (params: {
    assignmentId: string;
    photoDataUrls: string[];
    photoBlobs?: { blob: Blob; name: string }[];
    studentNote: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  verifyAssignmentSubmission: (params: {
    submissionId: string;
    decision: 'approved' | 'revision_requested';
    feedback: string;
    score?: number;
  }) => { ok: boolean; error?: string };
  markNotificationRead: (notificationId: string) => void;
  markAllNotificationsRead: () => void;
  // Portal, PPDB, Survei, OSIS, Buku Tamu
  addPpdbRegistration: (
    payload: Omit<PpdbRegistration, 'id' | 'schoolId' | 'registrationCode' | 'status' | 'createdAt'>
  ) => string;
  updatePpdbStatus: (regId: string, status: PpdbRegistration['status']) => void;
  submitSurveyResponse: (surveyId: string, ratings: Record<string, number>, comment: string) => void;
  castOsisVote: (candidateId: string) => { ok: boolean; error?: string };
  addGuestbookEntry: (
    payload: Omit<GuestbookEntry, 'id' | 'schoolId' | 'checkInAt' | 'status'>
  ) => void;
  checkoutGuestbookEntry: (entryId: string) => void;
  // Absensi & Sekolah & Backup
  recordAttendance: (
    payload: Omit<AttendanceRecord, 'id' | 'schoolId' | 'userId' | 'userName' | 'role' | 'syncSource'>
  ) => { ok: boolean; queued: boolean };
  updateSchoolProfile: (payload: {
    name: string;
    npsn: string;
    address: string;
    latitude: number;
    longitude: number;
    geofenceRadiusMeters: number;
    allowedWifiLabel: string;
    requireEmailVerificationForUsers?: boolean;
  }) => { ok: boolean; error?: string };
  saveSchoolLocation: (payload: {
    locationId?: string;
    locationName: string;
    latitude: number;
    longitude: number;
    address: string;
    radiusInMeters: number;
    isActive: boolean;
  }) => { ok: boolean; error?: string; location?: SchoolLocation };
  toggleSchoolLocationActive: (locationId: string) => { ok: boolean; error?: string };
  deleteSchoolLocation: (locationId: string) => { ok: boolean; error?: string };
  exportFullBackupJson: () => string;
  restoreFullBackupJson: (jsonText: string) => { ok: boolean; error?: string };
}

const SimsContext = createContext<SimsContextValue | null>(null);

function normalizeDataset(rawDataset: SimsDataset): SimsDataset {
  const takenUsernames = new Set<string>();
  const normalizedUsers: UserAccount[] = rawDataset.users.map((u) => {
    const role = normalizeUserRole(u.role) || 'student';
    const rawUsername = u.username?.trim() || generateUsernameFromName(u.name, takenUsernames);
    const usernameKey = buildUsernameLookupKey(rawUsername);
    takenUsernames.add(usernameKey);
    const linked = Array.isArray(u.linkedStudentIds)
      ? u.linkedStudentIds
      : u.childStudentId
      ? [u.childStudentId]
      : undefined;
    return {
      ...u,
      role,
      username: usernameKey,
      usernameKey,
      isActive: u.isActive ?? true,
      mustChangePassword: u.mustChangePassword ?? false,
      linkedStudentIds: linked,
    };
  });

  const relations: ParentStudentRelation[] = Array.isArray(rawDataset.parentStudentRelations)
    ? rawDataset.parentStudentRelations
    : normalizedUsers
        .filter((u) => u.role === 'parent' && (u.linkedStudentIds?.length || u.childStudentId))
        .flatMap((p) => {
          const ids = p.linkedStudentIds || (p.childStudentId ? [p.childStudentId] : []);
          return ids.map((sid, idx) => ({
            id: `rel-${p.uid}-${sid}`,
            schoolId: p.schoolId,
            parentUid: p.uid,
            studentUid: sid,
            relationship: p.relationshipType || ('Wali' as const),
            isPrimary: idx === 0,
            createdAt: p.createdAt || new Date().toISOString(),
          }));
        });

  return {
    ...rawDataset,
    users: normalizedUsers,
    parentStudentRelations: relations,
    importJobs: Array.isArray(rawDataset.importJobs) ? rawDataset.importJobs : [],
    auditLogs: rawDataset.auditLogs.map((l) => ({
      ...l,
      actorRole: normalizeUserRole(l.actorRole) || 'school_admin',
    })),
    submissionHistory: rawDataset.submissionHistory.map((h) => ({
      ...h,
      actorRole: normalizeUserRole(h.actorRole) || 'student',
    })),
    attendanceRecords: rawDataset.attendanceRecords.map((a) => ({
      ...a,
      role: normalizeUserRole(a.role) || 'teacher',
    })),
  };
}

function loadInitialData(): SimsDataset {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SimsDataset;
      if (parsed && parsed.school && Array.isArray(parsed.users) && Array.isArray(parsed.assignments)) {
        if (!Array.isArray(parsed.schoolLocations)) {
          const nowIso = new Date().toISOString();
          parsed.schoolLocations = [
            {
              locationId: 'loc-gedung-utama',
              schoolId: parsed.school.schoolId,
              locationName: 'Gedung Utama Sekolah',
              latitude: parsed.school.latitude,
              longitude: parsed.school.longitude,
              address: parsed.school.address,
              radiusInMeters: parsed.school.geofenceRadiusMeters || 150,
              isActive: true,
              createdAt: nowIso,
              updatedAt: nowIso,
            },
          ];
        }
        return normalizeDataset(parsed);
      }
    }
  } catch {
    // Fallback to clean seed
  }
  return createEmptySchoolDataset();
}

function loadOfflineQueue(): OfflineQueueItem[] {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? (JSON.parse(raw) as OfflineQueueItem[]) : [];
  } catch {
    return [];
  }
}

function loadRateLimitMap(): Record<string, LoginRateLimitState> {
  try {
    const raw = localStorage.getItem(RATE_LIMIT_KEY);
    return raw ? (JSON.parse(raw) as Record<string, LoginRateLimitState>) : {};
  } catch {
    return {};
  }
}

function loadPendingAdminDraft(): PendingAdminBootstrapDraft | null {
  try {
    const raw = localStorage.getItem(PENDING_ADMIN_DRAFT_KEY);
    return raw ? (JSON.parse(raw) as PendingAdminBootstrapDraft) : null;
  } catch {
    return null;
  }
}

function savePendingAdminDraft(draft: PendingAdminBootstrapDraft | null) {
  try {
    if (draft) {
      localStorage.setItem(PENDING_ADMIN_DRAFT_KEY, JSON.stringify(draft));
    } else {
      localStorage.removeItem(PENDING_ADMIN_DRAFT_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

function loadResendRateLimitMap(): Record<string, ResendRateLimitState> {
  try {
    const raw = localStorage.getItem(RESEND_RATE_LIMIT_KEY);
    return raw ? (JSON.parse(raw) as Record<string, ResendRateLimitState>) : {};
  } catch {
    return {};
  }
}

function saveResendRateLimitMap(map: Record<string, ResendRateLimitState>) {
  try {
    localStorage.setItem(RESEND_RATE_LIMIT_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage errors
  }
}

export const SimsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [data, setData] = useState<SimsDataset>(() => loadInitialData());
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [authStatus, setAuthStatus] = useState<AuthSessionStatus>('loading');

  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [firebaseReady, setFirebaseReady] = useState<boolean>(false);
  const [bootstrapInitialized, setBootstrapInitialized] = useState<boolean>(false);
  const [bootstrapLoading, setBootstrapLoading] = useState<boolean>(true);
  const [pendingAdminDraft, setPendingAdminDraft] =
    useState<PendingAdminBootstrapDraft | null>(() => loadPendingAdminDraft());
  const [pendingVerificationContext, setPendingVerificationContext] = useState<
    'first_admin_bootstrap' | 'policy_login' | null
  >(null);
  const [pendingPolicyProfile, setPendingPolicyProfile] = useState<{
    profile: UserAccount;
    school: School | null;
  } | null>(null);
  const [resendRateLimitMap, setResendRateLimitMap] = useState<
    Record<string, ResendRateLimitState>
  >(() => loadResendRateLimitMap());

  const [browserOffline, setBrowserOffline] = useState<boolean>(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );
  const [simulatedOffline, setSimulatedOffline] = useState<boolean>(false);
  const [offlineQueue, setOfflineQueue] = useState<OfflineQueueItem[]>(() => loadOfflineQueue());
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const isBootstrappingRef = React.useRef(false);
  const isCompletingBootstrapRef = React.useRef(false);

  const isOffline = browserOffline || simulatedOffline;

  const refreshBootstrapStatus = async () => {
    setBootstrapLoading(true);
    const res = await fetchBootstrapState();
    setBootstrapInitialized(res.initialized);
    setBootstrapLoading(false);
  };

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Ignore quota errors
    }
  }, [data]);

  useEffect(() => {
    try {
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(offlineQueue));
    } catch {
      // Ignore
    }
  }, [offlineQueue]);

  useEffect(() => {
    testConnection().then((ok) => setFirebaseReady(ok));
    void refreshBootstrapStatus();

    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (!user) {
        if (!isBootstrappingRef.current) {
          setCurrentUserId('');
          setPendingVerificationContext(null);
          setPendingPolicyProfile(null);
          setAuthStatus('unauthenticated');
        }
        return;
      }

      if (isBootstrappingRef.current) {
        return;
      }

      try {
        const loaded = await fetchAuthenticatedUserProfile(user.uid);
        if (isBootstrappingRef.current) {
          return;
        }
        if (loaded) {
          const { profile, school } = loaded;
          if (!profile.isActive) {
            await signOutFirebase();
            setAuthStatus('unauthenticated');
            setStatusMessage(
              'Akun Anda berstatus nonaktif. Hubungi Admin Sekolah untuk informasi lebih lanjut.'
            );
            return;
          }

          if (
            shouldRequireEmailVerificationForLogin({
              role: profile.role,
              authEmail: user.email || profile.authEmail,
              schoolRequireEmailVerification: school?.requireEmailVerificationForUsers,
            })
          ) {
            await user.reload().catch(() => {});
            if (!user.emailVerified) {
              setPendingPolicyProfile({ profile, school });
              setPendingVerificationContext('policy_login');
              setAuthStatus('pending_email_verification');
              return;
            }
          }

          const dir = await fetchSchoolDirectoryFromFirestore(profile.schoolId);
          setData((prev) => {
            const base =
              prev.school.schoolId === profile.schoolId
                ? prev
                : createEmptySchoolDataset(school || undefined, profile);
            const mergedUsers = dir.users.length > 0 ? dir.users : base.users;
            const withMe = mergedUsers.some((u) => u.uid === profile.uid)
              ? mergedUsers.map((u) => (u.uid === profile.uid ? profile : u))
              : [profile, ...mergedUsers];

            return {
              ...base,
              school: school || base.school,
              users: withMe,
              parentStudentRelations:
                dir.relations.length > 0 ? dir.relations : base.parentStudentRelations,
              importJobs: dir.importJobs.length > 0 ? dir.importJobs : base.importJobs,
            };
          });
          setPendingVerificationContext(null);
          setPendingPolicyProfile(null);
          setCurrentUserId(profile.uid);
          setAuthStatus(profile.mustChangePassword ? 'must_change_password' : 'authenticated');
          return;
        }

        // Profil belum ada di Firestore: lanjutkan proses verifikasi & registrasi Admin Sekolah
        const savedDraft = loadPendingAdminDraft();
        const resumedDraft: PendingAdminBootstrapDraft =
          savedDraft && savedDraft.uid === user.uid
            ? savedDraft
            : {
                uid: user.uid,
                schoolId: '',
                email: (user.email || '').trim().toLowerCase(),
                adminName: user.displayName || '',
                username: '',
                phoneNumber: '',
                schoolName: '',
                npsn: '',
                schoolAddress: '',
                createdAt: new Date().toISOString(),
              };
        setPendingAdminDraft(resumedDraft);
        setPendingVerificationContext('first_admin_bootstrap');
        setAuthStatus('pending_email_verification');
        return;
      } catch {
        // Handle missing profile document
      }

      if (!isBootstrappingRef.current) {
        setAuthStatus('unauthenticated');
      }
    });

    const onOnline = () => setBrowserOffline(false);
    const onOffline = () => setBrowserOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      unsub();
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const currentUser =
    data.users.find((u) => u.uid === currentUserId) ||
    data.users[0] ||
    GUEST_PLACEHOLDER_USER;

  const notifyStatus = (msg: string) => {
    setStatusMessage(msg);
  };

  const clearStatusMessage = () => setStatusMessage(null);

  const appendAuditLog = (
    prev: SimsDataset,
    module: AuditLogEntry['module'],
    action: string,
    targetId: string,
    summary: string,
    actorOverride?: UserAccount
  ): AuditLogEntry[] => {
    const actor = actorOverride || currentUser;
    const entry: AuditLogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      schoolId: prev.school.schoolId,
      actorId: actor.uid,
      actorName: actor.name,
      actorRole: actor.role,
      module,
      action,
      targetId,
      summary,
      createdAt: new Date().toISOString(),
    };
    if (firebaseUser) {
      void syncDocumentToFirestore('audit_logs', entry.id, entry as unknown as Record<string, unknown>);
      void syncDocumentToFirestore(
        `schools/${prev.school.schoolId}/audit_logs`,
        entry.id,
        entry as unknown as Record<string, unknown>
      );
    }
    return [entry, ...prev.auditLogs];
  };

  const pushNotification = (
    list: AssignmentNotification[],
    recipientId: string,
    eventType: AssignmentNotification['eventType'],
    title: string,
    message: string
  ): AssignmentNotification[] => {
    const notif: AssignmentNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      schoolId: data.school.schoolId,
      recipientId,
      eventType,
      title,
      message,
      read: false,
      createdAt: new Date().toISOString(),
    };
    if (firebaseUser) {
      void syncDocumentToFirestore(
        'assignment_notifications',
        notif.id,
        notif as unknown as Record<string, unknown>
      );
    }
    return [notif, ...list];
  };

  // === AUTHENTICATION & BOOTSTRAP ===
  const recordClientResendAttempt = (uid: string) => {
    const nowMs = Date.now();
    setResendRateLimitMap((prev) => {
      const nextMap = {
        ...prev,
        [uid]: recordResendAttempt(prev[uid], nowMs),
      };
      saveResendRateLimitMap(nextMap);
      return nextMap;
    });
  };

  const applyCompletedAdminBootstrap = (params: {
    school: School;
    adminUser: UserAccount;
    alreadyCompleted: boolean;
  }) => {
    const { school, adminUser, alreadyCompleted } = params;
    savePendingAdminDraft(null);
    setPendingAdminDraft(null);
    setPendingVerificationContext(null);
    setPendingPolicyProfile(null);
    setBootstrapInitialized(true);

    const freshDataset = createEmptySchoolDataset(school, adminUser);
    setData({
      ...freshDataset,
      auditLogs: [
        {
          id: `log-boot-${adminUser.uid.slice(0, 12)}`,
          schoolId: school.schoolId,
          actorId: adminUser.uid,
          actorName: adminUser.name,
          actorRole: 'school_admin',
          module: 'akun',
          action: 'REGISTER_FIRST_SCHOOL_ADMIN',
          targetId: adminUser.uid,
          summary: `Registrasi awal sekolah "${school.name}" dan penetapan Admin Sekolah pertama setelah verifikasi email.`,
          createdAt: new Date().toISOString(),
        },
      ],
    });
    setCurrentUserId(adminUser.uid);
    setAuthStatus('authenticated');
    notifyStatus(
      alreadyCompleted
        ? `Sekolah "${school.name}" sudah terdaftar. Anda langsung diarahkan ke Dashboard Admin.`
        : `Email terverifikasi dan sekolah "${school.name}" berhasil didaftarkan. Selamat datang, ${adminUser.name}!`
    );
  };

  const registerFirstSchoolAdmin = async (input: FirstAdminRegistrationInput) => {
    const validation = validateFirstAdminRegistration(input);
    if (!validation.valid) {
      return { ok: false, error: validation.error };
    }
    isBootstrappingRef.current = true;
    try {
      const res = await startFirstSchoolAdminRegistrationFirebase(input);
      setFirebaseUser(res.user);
      savePendingAdminDraft(res.draft);
      setPendingAdminDraft(res.draft);

      if (res.verificationEmailSent) {
        recordClientResendAttempt(res.user.uid);
      }

      if (res.status === 'verification_required') {
        setPendingVerificationContext('first_admin_bootstrap');
        setAuthStatus('pending_email_verification');
        if (res.cooldownNotice) {
          notifyStatus(res.cooldownNotice);
        } else {
          notifyStatus(
            `Email verifikasi telah dikirim ke ${res.draft.email}. Selesaikan verifikasi sebelum melanjutkan.`
          );
        }
        return { ok: true, requiresEmailVerification: true };
      }

      // Akun sudah emailVerified (mis. melanjutkan registrasi setelah klik tautan)
      const completed = await completeVerifiedAdminBootstrapFirebase(res.draft);
      applyCompletedAdminBootstrap(completed);
      return { ok: true, requiresEmailVerification: false };
    } catch (err) {
      return { ok: false, error: formatFirebaseAuthError(err) };
    } finally {
      isBootstrappingRef.current = false;
    }
  };

  const resendVerificationEmail = async () => {
    const user = auth.currentUser || firebaseUser;
    if (!user) {
      return {
        ok: false,
        error: 'Sesi pengguna tidak aktif. Silakan ulangi proses registrasi atau masuk kembali.',
      };
    }

    const limitCheck = checkResendRateLimit(resendRateLimitMap[user.uid]);
    if (!limitCheck.allowed) {
      return {
        ok: false,
        retryAfterSeconds: limitCheck.retryAfterSeconds,
        error: limitCheck.message,
      };
    }

    try {
      const res = await sendVerificationEmailWithGuardFirebase(user);
      if (res.alreadyVerified) {
        const proceedRes = await checkEmailVerificationAndProceed();
        if (proceedRes.ok) {
          return { ok: true, alreadyVerified: true };
        }
        return { ok: false, alreadyVerified: true, error: proceedRes.error };
      }

      recordClientResendAttempt(user.uid);
      notifyStatus(
        `Email verifikasi baru telah dikirim ke ${user.email || 'email Anda'}. Periksa Kotak Masuk dan folder Spam.`
      );
      return { ok: true };
    } catch (err) {
      const retryAfter =
        typeof err === 'object' &&
        err !== null &&
        'retryAfterSeconds' in err &&
        typeof (err as { retryAfterSeconds?: unknown }).retryAfterSeconds === 'number'
          ? (err as { retryAfterSeconds: number }).retryAfterSeconds
          : undefined;
      return {
        ok: false,
        retryAfterSeconds: retryAfter,
        error: formatFirebaseAuthError(err),
      };
    }
  };

  const checkEmailVerificationAndProceed = async (
    overrideDraft?: PendingAdminBootstrapDraft
  ) => {
    if (isCompletingBootstrapRef.current) {
      return { ok: false, error: 'Sedang memproses verifikasi, harap tunggu...' };
    }
    const user = auth.currentUser || firebaseUser;
    if (!user) {
      return {
        ok: false,
        error: 'Sesi Firebase Authentication tidak ditemukan. Silakan masuk atau daftar ulang.',
      };
    }

    isCompletingBootstrapRef.current = true;
    isBootstrappingRef.current = true;
    try {
      await user.reload();
      setFirebaseUser(auth.currentUser);
      if (!user.emailVerified) {
        return {
          ok: false,
          error:
            'Email Anda belum terverifikasi. Silakan buka tautan verifikasi di email Anda terlebih dahulu, lalu coba lagi.',
        };
      }

      if (pendingVerificationContext === 'policy_login') {
        const verified = await verifyFirebaseEmailTokenWithBackend(user);
        const loaded =
          pendingPolicyProfile || (await fetchAuthenticatedUserProfile(user.uid));
        if (!loaded) {
          return {
            ok: false,
            error: 'Profil pengguna tidak ditemukan di sekolah terkait.',
          };
        }
        const { profile, school } = loaded;
        await syncEmailVerifiedStatusFirestore({
          uid: profile.uid,
          schoolId: profile.schoolId,
          verifiedAt: verified.verifiedAt,
        });

        const updatedProfile: UserAccount = {
          ...profile,
          emailVerified: true,
          emailVerifiedAt: verified.verifiedAt,
        };
        const dir = await fetchSchoolDirectoryFromFirestore(profile.schoolId);
        setData((prev) => {
          const base =
            prev.school.schoolId === profile.schoolId
              ? prev
              : createEmptySchoolDataset(school || undefined, updatedProfile);
          const mergedUsers = dir.users.length > 0 ? dir.users : base.users;
          const withMe = mergedUsers.some((u) => u.uid === updatedProfile.uid)
            ? mergedUsers.map((u) => (u.uid === updatedProfile.uid ? updatedProfile : u))
            : [updatedProfile, ...mergedUsers];

          return {
            ...base,
            school: school || base.school,
            users: withMe,
            parentStudentRelations:
              dir.relations.length > 0 ? dir.relations : base.parentStudentRelations,
            importJobs: dir.importJobs.length > 0 ? dir.importJobs : base.importJobs,
          };
        });
        setPendingVerificationContext(null);
        setPendingPolicyProfile(null);
        setCurrentUserId(updatedProfile.uid);
        setAuthStatus(
          updatedProfile.mustChangePassword ? 'must_change_password' : 'authenticated'
        );
        notifyStatus('Email berhasil diverifikasi. Selamat datang di SIMS Terpadu!');
        return { ok: true };
      }

      const activeDraft = overrideDraft || pendingAdminDraft;
      if (!activeDraft || !activeDraft.schoolName.trim() || !activeDraft.username.trim()) {
        return {
          ok: false,
          error:
            'Data profil sekolah dan admin belum lengkap. Lengkapi formulir di bawah untuk menyelesaikan registrasi.',
        };
      }

      savePendingAdminDraft(activeDraft);
      setPendingAdminDraft(activeDraft);

      const completed = await completeVerifiedAdminBootstrapFirebase(activeDraft);
      applyCompletedAdminBootstrap(completed);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: formatFirebaseAuthError(err) };
    } finally {
      isCompletingBootstrapRef.current = false;
      isBootstrappingRef.current = false;
    }
  };

  const cancelPendingVerification = async () => {
    isBootstrappingRef.current = true;
    try {
      if (auth.currentUser || firebaseUser) {
        await signOutFirebase();
      }
      setPendingVerificationContext(null);
      setPendingPolicyProfile(null);
      setCurrentUserId('');
      setAuthStatus('unauthenticated');
      notifyStatus('Proses verifikasi dibatalkan. Anda dapat melanjutkan kapan saja.');
    } finally {
      isBootstrappingRef.current = false;
    }
  };

  const loginWithUsernamePassword = async (username: string, password: string) => {
    const key = buildUsernameLookupKey(username);
    if (!key || !password) {
      return { ok: false, error: 'Username dan password wajib diisi.' };
    }

    const rateMap = loadRateLimitMap();
    const limitCheck = checkLoginRateLimit(rateMap[key]);
    if (!limitCheck.allowed) {
      return {
        ok: false,
        error: `Terlalu banyak percobaan gagal untuk "${key}". Coba lagi dalam ${limitCheck.remainingSeconds} detik.`,
      };
    }

    isBootstrappingRef.current = true;
    try {
      const { user, profile, school } = await loginWithUsernameAndPasswordFirebase(
        key,
        password
      );
      setFirebaseUser(user);
      delete rateMap[key];
      localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(rateMap));

      if (
        shouldRequireEmailVerificationForLogin({
          role: profile.role,
          authEmail: user.email || profile.authEmail,
          schoolRequireEmailVerification: school?.requireEmailVerificationForUsers,
        })
      ) {
        await user.reload().catch(() => {});
        if (!user.emailVerified) {
          setPendingPolicyProfile({ profile, school });
          setPendingVerificationContext('policy_login');
          setAuthStatus('pending_email_verification');
          return { ok: true, requiresEmailVerification: true };
        }
      }

      const dir = await fetchSchoolDirectoryFromFirestore(profile.schoolId);
      setData((prev) => {
        const base =
          prev.school.schoolId === profile.schoolId
            ? prev
            : createEmptySchoolDataset(school || undefined, profile);
        const mergedUsers = dir.users.length > 0 ? dir.users : base.users;
        const withMe = mergedUsers.some((u) => u.uid === profile.uid)
          ? mergedUsers.map((u) => (u.uid === profile.uid ? profile : u))
          : [profile, ...mergedUsers];

        return {
          ...base,
          school: school || base.school,
          users: withMe,
          parentStudentRelations:
            dir.relations.length > 0 ? dir.relations : base.parentStudentRelations,
          importJobs: dir.importJobs.length > 0 ? dir.importJobs : base.importJobs,
          auditLogs: appendAuditLog(
            base,
            'akun',
            'LOGIN_SUCCESS',
            profile.uid,
            `${profile.name} (${ROLE_LABELS[profile.role]}) masuk menggunakan username "${profile.username}"`,
            profile
          ),
        };
      });
      setPendingVerificationContext(null);
      setPendingPolicyProfile(null);
      setCurrentUserId(profile.uid);
      setAuthStatus(profile.mustChangePassword ? 'must_change_password' : 'authenticated');
      return { ok: true, mustChangePassword: profile.mustChangePassword };
    } catch (err) {
      rateMap[key] = recordFailedLoginAttempt(rateMap[key]);
      localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(rateMap));
      return { ok: false, error: formatFirebaseAuthError(err) };
    } finally {
      isBootstrappingRef.current = false;
    }
  };

  const logoutSession = async () => {
    if (firebaseUser || auth.currentUser) {
      await signOutFirebase();
    }
    setCurrentUserId('');
    setPendingVerificationContext(null);
    setPendingPolicyProfile(null);
    setData(createEmptySchoolDataset());
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
    setAuthStatus('unauthenticated');
    notifyStatus('Anda telah keluar dari sesi SIMS.');
  };

  const completeFirstLoginPasswordChange = async (newPassword: string) => {
    const pwCheck = validatePasswordStrength(newPassword);
    if (!pwCheck.valid) {
      return { ok: false, error: pwCheck.error };
    }
    try {
      let changedAt = new Date().toISOString();
      if (firebaseUser) {
        changedAt = await completeMandatoryPasswordChangeFirebase({
          uid: currentUser.uid,
          schoolId: currentUser.schoolId,
          actorName: currentUser.name,
          actorRole: currentUser.role,
          newPassword,
        });
      }
      setData((prev) => ({
        ...prev,
        users: prev.users.map((u) =>
          u.uid === currentUser.uid
            ? {
                ...u,
                mustChangePassword: false,
                passwordChangedAt: changedAt,
                updatedAt: changedAt,
              }
            : u
        ),
        auditLogs: appendAuditLog(
          prev,
          'akun',
          'FIRST_LOGIN_PASSWORD_CHANGED',
          currentUser.uid,
          `${currentUser.name} menyelesaikan penggantian password wajib login pertama.`
        ),
      }));
      setAuthStatus('authenticated');
      notifyStatus('Password baru berhasil disimpan. Akses dashboard kini dibuka.');
      return { ok: true };
    } catch (err) {
      return { ok: false, error: formatFirebaseAuthError(err) };
    }
  };

  const changeMyPassword = async (currentPassword: string, newPassword: string) => {
    const pwCheck = validatePasswordStrength(newPassword);
    if (!pwCheck.valid) {
      return { ok: false, error: pwCheck.error };
    }
    if (!currentPassword.trim()) {
      return { ok: false, error: 'Masukkan password saat ini untuk verifikasi.' };
    }
    try {
      if (firebaseUser) {
        await changeOwnPasswordFirebase({ currentPassword, newPassword });
      }
      const nowIso = new Date().toISOString();
      const updatedUser: UserAccount = {
        ...currentUser,
        mustChangePassword: false,
        passwordChangedAt: nowIso,
        updatedAt: nowIso,
      };
      setData((prev) => ({
        ...prev,
        users: prev.users.map((u) => (u.uid === currentUser.uid ? updatedUser : u)),
        auditLogs: appendAuditLog(
          prev,
          'akun',
          'SELF_PASSWORD_CHANGED',
          currentUser.uid,
          `${currentUser.name} memperbarui password akun.`
        ),
      }));
      if (firebaseUser) {
        await updateSchoolUserFirestore(updatedUser);
      }
      notifyStatus('Password akun berhasil diperbarui.');
      return { ok: true };
    } catch (err) {
      return { ok: false, error: formatFirebaseAuthError(err) };
    }
  };

  const loginWithGoogle = async () => {
    try {
      const cred = await signInWithGooglePopup();
      const user = cred.user;
      if (user) {
        notifyStatus(`Terhubung dengan Google: ${user.email}`);
      }
    } catch (err) {
      notifyStatus(
        err instanceof Error ? `Login Google dibatalkan: ${err.message}` : 'Login Google gagal.'
      );
    }
  };

  const logoutGoogle = async () => {
    await logoutSession();
  };

  // === MANAJEMEN PENGGUNA (SCHOOL ADMIN) ===
  const createSingleUserAccount = async (input: SingleUserCreateInput) => {
    if (currentUser.role !== 'school_admin') {
      return { ok: false, error: 'Hanya Admin Sekolah yang berhak membuat akun pengguna.' };
    }
    const validation = validateSingleUserInput(input, data.users, data.classes);
    if (!validation.valid) {
      return { ok: false, error: validation.error };
    }

    const usernameKey = buildUsernameLookupKey(input.username);
    const mustChange = mustChangePasswordForRole(input.role);
    const nowIso = new Date().toISOString();

    const baseDraft: Omit<
      UserAccount,
      'uid' | 'authEmail' | 'usernameKey' | 'createdAt' | 'createdBy' | 'updatedAt' | 'mustChangePassword'
    > = {
      schoolId: data.school.schoolId,
      name: input.name.trim(),
      username: usernameKey,
      email: input.email?.trim() || `${usernameKey}.${data.school.schoolId}@sims.local`,
      phoneNumber: input.phoneNumber?.trim() || undefined,
      role: input.role,
      isActive: true,
      nisOrNip: input.nisOrNip?.trim() || input.nis?.trim() || undefined,
      nis: input.role === 'student' ? input.nis?.trim() : undefined,
      nisn: input.role === 'student' ? input.nisn?.trim() : undefined,
      classId: input.role === 'student' ? input.classId : undefined,
      entryYear: input.role === 'student' ? input.entryYear?.trim() : undefined,
      parentPhone: input.role === 'student' ? input.parentPhone?.trim() : undefined,
      jobTitle:
        input.role === 'principal' || input.role === 'staff'
          ? input.jobTitle?.trim() || ROLE_LABELS[input.role]
          : undefined,
      department: input.role === 'staff' ? input.department?.trim() : undefined,
      teachingSubjectIds:
        input.role === 'teacher' ? input.teachingSubjectIds : undefined,
      teachingClassIds:
        input.role === 'teacher' ? input.teachingClassIds : undefined,
      relationshipType:
        input.role === 'parent' ? input.relationshipType || 'Wali' : undefined,
      childStudentId:
        input.role === 'parent' ? input.linkedStudentIds?.[0] : undefined,
      linkedStudentIds:
        input.role === 'parent' ? input.linkedStudentIds : undefined,
    };

    const parentRelDrafts =
      input.role === 'parent' && input.linkedStudentIds
        ? input.linkedStudentIds.map((studentUid, idx) => ({
            studentUid,
            relationship: input.relationshipType || ('Wali' as const),
            isPrimary: idx === 0,
            createdBy: currentUser.uid,
          }))
        : [];

    let createdUser: UserAccount;
    let createdRelations: ParentStudentRelation[] = [];

    if (firebaseUser) {
      try {
        const res = await createSchoolUserAccountWithAuth({
          schoolId: data.school.schoolId,
          createdByUid: currentUser.uid,
          accountDraft: baseDraft,
          initialPassword: input.password,
          existingAuthEmails: data.users
            .map((u) => u.authEmail || u.email)
            .filter(Boolean),
          parentRelations: parentRelDrafts,
        });
        createdUser = res.createdUser;
        createdRelations = res.createdRelations;
      } catch (err) {
        return { ok: false, error: formatFirebaseAuthError(err) };
      }
    } else {
      const uid = `u-${input.role}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
      createdUser = {
        ...baseDraft,
        uid,
        usernameKey,
        mustChangePassword: mustChange,
        createdAt: nowIso,
        createdBy: currentUser.uid,
        updatedAt: nowIso,
      };
      createdRelations = parentRelDrafts.map((rel) => ({
        id: `rel-${uid}-${rel.studentUid}`,
        schoolId: data.school.schoolId,
        parentUid: uid,
        studentUid: rel.studentUid,
        relationship: rel.relationship,
        isPrimary: rel.isPrimary,
        createdAt: nowIso,
        createdBy: currentUser.uid,
      }));
    }

    setData((prev) => {
      const updatedClasses =
        createdUser.role === 'student' && createdUser.classId
          ? prev.classes.map((c) =>
              c.id === createdUser.classId && !c.studentIds.includes(createdUser.uid)
                ? { ...c, studentIds: [...c.studentIds, createdUser.uid] }
                : c
            )
          : prev.classes;

      const newTeachingMaps: TeachingAssignment[] =
        createdUser.role === 'teacher' &&
        createdUser.teachingSubjectIds?.length &&
        createdUser.teachingClassIds?.length
          ? createdUser.teachingSubjectIds.flatMap((subjectId) =>
              createdUser.teachingClassIds!.map((classId) => ({
                id: `ta-${createdUser.uid}-${subjectId}-${classId}`,
                schoolId: prev.school.schoolId,
                teacherId: createdUser.uid,
                subjectId,
                classId,
              }))
            )
          : [];

      return {
        ...prev,
        users: [createdUser, ...prev.users],
        classes: updatedClasses,
        teachingAssignments: [...prev.teachingAssignments, ...newTeachingMaps],
        parentStudentRelations: [...createdRelations, ...prev.parentStudentRelations],
        auditLogs: appendAuditLog(
          prev,
          'akun',
          'CREATE_USER_ACCOUNT',
          createdUser.uid,
          `Membuat akun ${ROLE_LABELS[createdUser.role]}: ${createdUser.name} (@${createdUser.username})${
            createdUser.mustChangePassword ? ' [Wajib ganti password awal]' : ''
          }`
        ),
      };
    });

    notifyStatus(`Akun ${ROLE_LABELS[createdUser.role]} "${createdUser.name}" berhasil dibuat.`);
    return { ok: true, user: createdUser, tempPassword: input.password };
  };

  const bulkCreateUsers = async (params: {
    rows: BulkValidatedRow[];
    sourceType: 'excel_csv' | 'dynamic_table';
    onProgress?: (completed: number, total: number) => void;
  }) => {
    const results: BulkImportExecutionResult[] = [];
    const createdUsers: UserAccount[] = [];
    const createdRelations: ParentStudentRelation[] = [];
    const total = params.rows.length;

    let runningAuthEmails = data.users.map((u) => u.authEmail || u.email).filter(Boolean);
    const takenUsernames = new Set(data.users.map((u) => u.usernameKey.toLowerCase()));

    for (let i = 0; i < params.rows.length; i += 1) {
      const row = params.rows[i];
      const role = row.resolvedRole;
      if (!row.valid || !role) {
        results.push({
          rowNumber: row.rowNumber,
          name: row.name || '-',
          roleLabel: role ? ROLE_LABELS[role] : row.roleInput || '-',
          username: row.username || '-',
          tempPassword: '-',
          mustChangePassword: false,
          status: 'Gagal',
          message: row.errors.join(' '),
        });
        params.onProgress?.(i + 1, total);
        continue;
      }

      const usernameKey = buildUsernameLookupKey(row.username);
      if (takenUsernames.has(usernameKey)) {
        results.push({
          rowNumber: row.rowNumber,
          name: row.name,
          roleLabel: ROLE_LABELS[role],
          username: usernameKey,
          tempPassword: '-',
          mustChangePassword: mustChangePasswordForRole(role),
          status: 'Gagal',
          message: `Username "${usernameKey}" sudah dipakai sebelumnya.`,
        });
        params.onProgress?.(i + 1, total);
        continue;
      }

      const nowIso = new Date().toISOString();
      const draft: Omit<
        UserAccount,
        'uid' | 'authEmail' | 'usernameKey' | 'createdAt' | 'createdBy' | 'updatedAt' | 'mustChangePassword'
      > = {
        schoolId: data.school.schoolId,
        name: row.name.trim(),
        username: usernameKey,
        email: row.email.trim() || `${usernameKey}.${data.school.schoolId}@sims.local`,
        phoneNumber: row.phoneNumber.trim() || undefined,
        role,
        isActive: true,
        nisOrNip: row.nisOrNip.trim() || undefined,
        nis: role === 'student' ? row.nisOrNip.trim() : undefined,
        nisn: role === 'student' ? row.nisn.trim() || undefined : undefined,
        classId: role === 'student' ? row.resolvedClassId : undefined,
        entryYear: role === 'student' ? row.entryYear.trim() || undefined : undefined,
        parentPhone: role === 'student' ? row.parentPhone.trim() || undefined : undefined,
        jobTitle:
          role === 'principal' || role === 'staff'
            ? row.jobTitle.trim() || ROLE_LABELS[role]
            : undefined,
        department: role === 'staff' ? row.department.trim() || undefined : undefined,
        teachingSubjectIds:
          role === 'teacher' && row.resolvedSubjectIds.length > 0
            ? row.resolvedSubjectIds
            : undefined,
        relationshipType: role === 'parent' ? row.relationshipType : undefined,
        childStudentId: role === 'parent' ? row.resolvedStudentIds[0] : undefined,
        linkedStudentIds: role === 'parent' ? row.resolvedStudentIds : undefined,
      };

      const relDrafts =
        role === 'parent'
          ? row.resolvedStudentIds.map((studentUid, idx) => ({
              studentUid,
              relationship: row.relationshipType,
              isPrimary: idx === 0,
              createdBy: currentUser.uid,
            }))
          : [];

      try {
        let createdUser: UserAccount;
        let rels: ParentStudentRelation[] = [];

        if (firebaseUser) {
          const out = await createSchoolUserAccountWithAuth({
            schoolId: data.school.schoolId,
            createdByUid: currentUser.uid,
            accountDraft: draft,
            initialPassword: row.password,
            existingAuthEmails: runningAuthEmails,
            parentRelations: relDrafts,
          });
          createdUser = out.createdUser;
          rels = out.createdRelations;
        } else {
          const uid = `u-${role}-${Date.now()}-${i}`;
          createdUser = {
            ...draft,
            uid,
            usernameKey,
            mustChangePassword: mustChangePasswordForRole(role),
            createdAt: nowIso,
            createdBy: currentUser.uid,
            updatedAt: nowIso,
          };
          rels = relDrafts.map((r) => ({
            id: `rel-${uid}-${r.studentUid}`,
            schoolId: data.school.schoolId,
            parentUid: uid,
            studentUid: r.studentUid,
            relationship: r.relationship,
            isPrimary: r.isPrimary,
            createdAt: nowIso,
            createdBy: currentUser.uid,
          }));
        }

        takenUsernames.add(usernameKey);
        runningAuthEmails = [...runningAuthEmails, createdUser.authEmail || createdUser.email];
        createdUsers.push(createdUser);
        createdRelations.push(...rels);

        results.push({
          rowNumber: row.rowNumber,
          name: createdUser.name,
          roleLabel: ROLE_LABELS[role],
          username: createdUser.username,
          tempPassword: row.password,
          mustChangePassword: createdUser.mustChangePassword,
          status: 'Berhasil',
          message: createdUser.mustChangePassword
            ? 'Berhasil dibuat (wajib ganti password saat login pertama).'
            : 'Berhasil dibuat.',
        });
      } catch (err) {
        results.push({
          rowNumber: row.rowNumber,
          name: row.name,
          roleLabel: ROLE_LABELS[role],
          username: usernameKey,
          tempPassword: '-',
          mustChangePassword: mustChangePasswordForRole(role),
          status: 'Gagal',
          message: formatFirebaseAuthError(err),
        });
      }

      params.onProgress?.(i + 1, total);
    }

    const successCount = results.filter((r) => r.status === 'Berhasil').length;
    const failedCount = results.length - successCount;
    const job: ImportJobRecord = {
      id: `impjob-${Date.now()}`,
      schoolId: data.school.schoolId,
      createdByUid: currentUser.uid,
      createdByName: currentUser.name,
      sourceType: params.sourceType,
      totalRows: total,
      successCount,
      failedCount,
      status: failedCount === 0 ? 'completed' : successCount > 0 ? 'partial' : 'failed',
      createdAt: new Date().toISOString(),
    };

    if (firebaseUser) {
      void logImportJobFirestore(job);
    }

    setData((prev) => {
      let nextClasses = prev.classes;
      for (const nu of createdUsers) {
        if (nu.role === 'student' && nu.classId) {
          nextClasses = nextClasses.map((c) =>
            c.id === nu.classId && !c.studentIds.includes(nu.uid)
              ? { ...c, studentIds: [...c.studentIds, nu.uid] }
              : c
          );
        }
      }
      return {
        ...prev,
        users: [...createdUsers, ...prev.users],
        classes: nextClasses,
        parentStudentRelations: [...createdRelations, ...prev.parentStudentRelations],
        importJobs: [job, ...prev.importJobs],
        auditLogs: appendAuditLog(
          prev,
          'akun',
          'BULK_IMPORT_USERS',
          job.id,
          `Impor massal (${params.sourceType}): ${successCount} berhasil, ${failedCount} gagal dari ${total} baris.`
        ),
      };
    });

    notifyStatus(`Proses impor massal selesai: ${successCount} berhasil, ${failedCount} gagal.`);
    return { results, job };
  };

  const updateUserAccountProfile = async (uid: string, patch: Partial<UserAccount>) => {
    if (currentUser.role !== 'school_admin') {
      return { ok: false, error: 'Hanya Admin Sekolah yang dapat mengedit profil pengguna.' };
    }
    const existing = data.users.find((u) => u.uid === uid);
    if (!existing) return { ok: false, error: 'Pengguna tidak ditemukan.' };
    const updated: UserAccount = {
      ...existing,
      ...patch,
      uid: existing.uid,
      schoolId: existing.schoolId,
      updatedAt: new Date().toISOString(),
    };
    if (firebaseUser) {
      await updateSchoolUserFirestore(updated);
    }
    setData((prev) => ({
      ...prev,
      users: prev.users.map((u) => (u.uid === uid ? updated : u)),
      auditLogs: appendAuditLog(
        prev,
        'akun',
        'UPDATE_USER_ACCOUNT',
        uid,
        `Memperbarui data akun ${updated.name} (@${updated.username})`
      ),
    }));
    notifyStatus(`Data akun "${updated.name}" berhasil diperbarui.`);
    return { ok: true };
  };

  const toggleUserActiveStatus = async (uid: string) => {
    if (currentUser.role !== 'school_admin') {
      return { ok: false, error: 'Hanya Admin Sekolah yang dapat mengubah status akun.' };
    }
    if (uid === currentUser.uid) {
      return { ok: false, error: 'Admin Sekolah tidak dapat menonaktifkan akunnya sendiri.' };
    }
    const target = data.users.find((u) => u.uid === uid);
    if (!target) return { ok: false, error: 'Pengguna tidak ditemukan.' };

    const nextActive = !target.isActive;
    const updated: UserAccount = {
      ...target,
      isActive: nextActive,
      updatedAt: new Date().toISOString(),
    };
    if (firebaseUser) {
      await updateSchoolUserFirestore(updated);
    }
    setData((prev) => ({
      ...prev,
      users: prev.users.map((u) => (u.uid === uid ? updated : u)),
      auditLogs: appendAuditLog(
        prev,
        'akun',
        nextActive ? 'ACTIVATE_USER' : 'DEACTIVATE_USER',
        uid,
        `${nextActive ? 'Mengaktifkan' : 'Menonaktifkan'} akun ${updated.name} (@${updated.username})`
      ),
    }));
    notifyStatus(
      `Akun "${updated.name}" sekarang berstatus ${nextActive ? 'Aktif' : 'Nonaktif'}.`
    );
    return { ok: true };
  };

  const resetUserPasswordAction = async (uid: string) => {
    if (currentUser.role !== 'school_admin') {
      return {
        ok: false,
        emailSent: false,
        message: 'Hanya Admin Sekolah yang dapat mereset password pengguna.',
      };
    }
    const target = data.users.find((u) => u.uid === uid);
    if (!target) {
      return { ok: false, emailSent: false, message: 'Pengguna tidak ditemukan.' };
    }

    const authEmail = target.authEmail || target.email || '';
    const hasDeliverableEmail =
      Boolean(authEmail) && !authEmail.endsWith('@sims.local') && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(authEmail);

    let emailSent = false;
    if (firebaseUser && hasDeliverableEmail) {
      try {
        await sendResetEmailForUserFirebase(authEmail);
        emailSent = true;
      } catch {
        emailSent = false;
      }
    }

    const updated: UserAccount = {
      ...target,
      mustChangePassword: true,
      updatedAt: new Date().toISOString(),
    };
    if (firebaseUser) {
      await updateSchoolUserFirestore(updated);
    }

    setData((prev) => ({
      ...prev,
      users: prev.users.map((u) => (u.uid === uid ? updated : u)),
      auditLogs: appendAuditLog(
        prev,
        'akun',
        'RESET_PASSWORD_REQUEST',
        uid,
        `Reset password untuk ${target.name} (@${target.username})${emailSent ? ' + email reset terkirim' : ' (flag ganti password aktif)'}`
      ),
    }));

    const message = emailSent
      ? `Email reset password telah dikirim ke ${authEmail} dan flag wajib ganti password saat login diaktifkan.`
      : `Flag wajib ganti password diaktifkan untuk @${target.username}. Catatan Starter Tier: penimpaan password akun lain secara paksa tanpa email membutuhkan Firebase Admin SDK (Blaze/Server).`;
    notifyStatus(message);
    return { ok: true, emailSent, message };
  };

  const deleteUserAccount = async (uid: string) => {
    if (currentUser.role !== 'school_admin') {
      return { ok: false, error: 'Hanya Admin Sekolah yang berhak menghapus akun.' };
    }
    if (uid === currentUser.uid) {
      return { ok: false, error: 'Anda tidak dapat menghapus akun yang sedang digunakan.' };
    }
    const target = data.users.find((u) => u.uid === uid);
    if (!target) return { ok: false, error: 'Pengguna tidak ditemukan.' };

    if (firebaseUser) {
      await deleteSchoolUserFirestore(target);
    }

    setData((prev) => ({
      ...prev,
      users: prev.users.filter((u) => u.uid !== uid),
      parentStudentRelations: prev.parentStudentRelations.filter(
        (r) => r.parentUid !== uid && r.studentUid !== uid
      ),
      classes: prev.classes.map((c) => ({
        ...c,
        studentIds: c.studentIds.filter((id) => id !== uid),
      })),
      auditLogs: appendAuditLog(
        prev,
        'akun',
        'DELETE_USER_ACCOUNT',
        uid,
        `Menghapus profil & indeks akun ${target.name} (@${target.username})`
      ),
    }));
    notifyStatus(`Akun "${target.name}" berhasil dihapus dari direktori sekolah.`);
    return { ok: true };
  };

  const linkParentAndStudent = async (params: {
    parentUid: string;
    studentUid: string;
    relationship: 'Ayah' | 'Ibu' | 'Wali';
  }) => {
    if (currentUser.role !== 'school_admin') {
      return { ok: false, error: 'Hanya Admin Sekolah yang dapat mengatur relasi Orang Tua–Siswa.' };
    }
    const parent = data.users.find((u) => u.uid === params.parentUid && u.role === 'parent');
    const student = data.users.find((u) => u.uid === params.studentUid && u.role === 'student');
    if (!parent || !student) {
      return { ok: false, error: 'Pilih akun Orang Tua dan Siswa yang valid.' };
    }

    const exists = data.parentStudentRelations.some(
      (r) => r.parentUid === params.parentUid && r.studentUid === params.studentUid
    );
    if (exists) {
      return { ok: false, error: 'Relasi antara Orang Tua dan Siswa tersebut sudah terdaftar.' };
    }

    const rel: ParentStudentRelation = {
      id: `rel-${params.parentUid}-${params.studentUid}`,
      schoolId: data.school.schoolId,
      parentUid: params.parentUid,
      studentUid: params.studentUid,
      relationship: params.relationship,
      isPrimary: (parent.linkedStudentIds || []).length === 0,
      createdAt: new Date().toISOString(),
      createdBy: currentUser.uid,
    };

    const nextLinked = Array.from(
      new Set([...(parent.linkedStudentIds || []), params.studentUid])
    );
    const updatedParent: UserAccount = {
      ...parent,
      childStudentId: parent.childStudentId || params.studentUid,
      linkedStudentIds: nextLinked,
      updatedAt: new Date().toISOString(),
    };

    if (firebaseUser) {
      await syncParentStudentRelationFirestore(rel);
      await updateSchoolUserFirestore(updatedParent);
    }

    setData((prev) => ({
      ...prev,
      parentStudentRelations: [rel, ...prev.parentStudentRelations],
      users: prev.users.map((u) => (u.uid === updatedParent.uid ? updatedParent : u)),
      auditLogs: appendAuditLog(
        prev,
        'akun',
        'LINK_PARENT_STUDENT',
        rel.id,
        `Menghubungkan orang tua ${parent.name} (${params.relationship}) dengan siswa ${student.name}`
      ),
    }));
    notifyStatus(`Relasi ${parent.name} ↔ ${student.name} berhasil disimpan.`);
    return { ok: true };
  };

  const unlinkParentAndStudent = async (relationId: string) => {
    if (currentUser.role !== 'school_admin') {
      return { ok: false, error: 'Hanya Admin Sekolah yang dapat memutus relasi Orang Tua–Siswa.' };
    }
    const target = data.parentStudentRelations.find((r) => r.id === relationId);
    if (!target) return { ok: false, error: 'Relasi tidak ditemukan.' };

    const remainingForParent = data.parentStudentRelations
      .filter((r) => r.parentUid === target.parentUid && r.id !== relationId)
      .map((r) => r.studentUid);
    const parent = data.users.find((u) => u.uid === target.parentUid);
    const updatedParent = parent
      ? {
          ...parent,
          linkedStudentIds: remainingForParent,
          childStudentId: remainingForParent[0] || undefined,
          updatedAt: new Date().toISOString(),
        }
      : null;

    if (firebaseUser) {
      await deleteParentStudentRelationFirestore(data.school.schoolId, relationId);
      if (updatedParent) await updateSchoolUserFirestore(updatedParent);
    }

    setData((prev) => ({
      ...prev,
      parentStudentRelations: prev.parentStudentRelations.filter((r) => r.id !== relationId),
      users: updatedParent
        ? prev.users.map((u) => (u.uid === updatedParent.uid ? updatedParent : u))
        : prev.users,
      auditLogs: appendAuditLog(
        prev,
        'akun',
        'UNLINK_PARENT_STUDENT',
        relationId,
        `Memutus relasi orang tua–siswa (${relationId})`
      ),
    }));
    notifyStatus('Relasi Orang Tua–Siswa berhasil dihapus.');
    return { ok: true };
  };

  // === MODUL 3: AKADEMIK ===
  const addSubject = (payload: Omit<Subject, 'id' | 'schoolId'>) => {
    const item: Subject = {
      ...payload,
      id: `subj-${Date.now()}`,
      schoolId: data.school.schoolId,
    };
    setData((prev) => ({
      ...prev,
      subjects: [...prev.subjects, item],
      auditLogs: appendAuditLog(prev, 'akademik', 'CREATE_SUBJECT', item.id, `Menambahkan mapel ${item.code} — ${item.name}`),
    }));
    if (firebaseUser) {
      void syncDocumentToFirestore('subjects', item.id, item as unknown as Record<string, unknown>);
    }
    notifyStatus(`Mata pelajaran "${item.name}" berhasil ditambahkan.`);
  };

  const addCurriculum = (payload: Omit<Curriculum, 'id' | 'schoolId'>) => {
    const item: Curriculum = {
      ...payload,
      id: `curr-${Date.now()}`,
      schoolId: data.school.schoolId,
    };
    setData((prev) => ({
      ...prev,
      curriculums: prev.curriculums
        .map((c) => (item.isActive ? { ...c, isActive: false } : c))
        .concat(item),
    }));
    if (firebaseUser) {
      void syncDocumentToFirestore('curriculums', item.id, item as unknown as Record<string, unknown>);
    }
    notifyStatus(`Kurikulum "${item.name}" disimpan.`);
  };

  const setActiveCurriculum = (curriculumId: string) => {
    setData((prev) => ({
      ...prev,
      curriculums: prev.curriculums.map((c) => ({
        ...c,
        isActive: c.id === curriculumId,
      })),
    }));
    notifyStatus('Kurikulum aktif berhasil diperbarui.');
  };

  const addClass = (payload: Omit<SchoolClass, 'id' | 'schoolId'>) => {
    const item: SchoolClass = {
      ...payload,
      id: `cls-${Date.now()}`,
      schoolId: data.school.schoolId,
    };
    setData((prev) => ({
      ...prev,
      classes: [...prev.classes, item],
    }));
    if (firebaseUser) {
      void syncDocumentToFirestore('classes', item.id, item as unknown as Record<string, unknown>);
    }
    notifyStatus(`Kelas "${item.name}" berhasil ditambahkan.`);
  };

  const addTeachingAssignment = (payload: Omit<TeachingAssignment, 'id' | 'schoolId'>) => {
    const exists = data.teachingAssignments.some(
      (ta) =>
        ta.teacherId === payload.teacherId &&
        ta.subjectId === payload.subjectId &&
        ta.classId === payload.classId
    );
    if (exists) {
      notifyStatus('Pemetaan guru pengampu untuk kelas dan mapel tersebut sudah ada.');
      return;
    }
    const item: TeachingAssignment = {
      ...payload,
      id: `ta-${Date.now()}`,
      schoolId: data.school.schoolId,
    };
    setData((prev) => ({
      ...prev,
      teachingAssignments: [...prev.teachingAssignments, item],
    }));
    if (firebaseUser) {
      void syncDocumentToFirestore('teaching_assignments', item.id, item as unknown as Record<string, unknown>);
    }
    notifyStatus('Penugasan guru pengampu berhasil ditambahkan.');
  };

  const addSchedule = (payload: Omit<ScheduleItem, 'id' | 'schoolId'>) => {
    const item: ScheduleItem = {
      ...payload,
      id: `sch-${Date.now()}`,
      schoolId: data.school.schoolId,
    };
    setData((prev) => ({
      ...prev,
      schedules: [...prev.schedules, item],
    }));
    if (firebaseUser) {
      void syncDocumentToFirestore('schedules', item.id, item as unknown as Record<string, unknown>);
    }
    notifyStatus('Jadwal pelajaran baru berhasil ditambahkan.');
  };

  const addTeachingAgenda = (payload: Omit<TeachingAgenda, 'id' | 'schoolId' | 'teacherId'>) => {
    const item: TeachingAgenda = {
      ...payload,
      id: `ag-${Date.now()}`,
      schoolId: data.school.schoolId,
      teacherId: currentUser.uid,
    };
    if (isOffline) {
      setOfflineQueue((q) => [
        ...q,
        {
          id: `oq-${Date.now()}`,
          type: 'teaching_agenda',
          label: `Agenda mengajar: ${item.topic}`,
          payload: item,
          queuedAt: new Date().toISOString(),
        },
      ]);
      setData((prev) => ({
        ...prev,
        teachingAgendas: [item, ...prev.teachingAgendas],
      }));
      notifyStatus('Agenda mengajar disimpan secara offline dan masuk ke antrean sinkronisasi.');
      return;
    }
    setData((prev) => ({
      ...prev,
      teachingAgendas: [item, ...prev.teachingAgendas],
    }));
    if (firebaseUser) {
      void syncDocumentToFirestore('teaching_agendas', item.id, item as unknown as Record<string, unknown>);
    }
    notifyStatus('Agenda mengajar berhasil dicatat.');
  };

  const updateAssessmentComponents = (components: AssessmentComponent[]) => {
    const activeTotal = components
      .filter((c) => c.isActive)
      .reduce((sum, c) => sum + Number(c.weightPercent || 0), 0);
    if (activeTotal !== 100) {
      return {
        ok: false,
        error: `Total bobot komponen aktif harus 100% (saat ini ${activeTotal}%).`,
      };
    }
    setData((prev) => {
      const updatedGrades = prev.academicGrades.map((g) => ({
        ...g,
        finalScore: calculateWeightedFinalScore(g.scores, components),
      }));
      return {
        ...prev,
        assessmentComponents: components,
        academicGrades: updatedGrades,
        auditLogs: appendAuditLog(
          prev,
          'akademik',
          'UPDATE_ASSESSMENT_WEIGHTS',
          prev.school.schoolId,
          'Memperbarui bobot komponen penilaian akademik'
        ),
      };
    });
    notifyStatus('Komponen penilaian berhasil diperbarui.');
    return { ok: true };
  };

  const upsertAcademicGrade = (params: {
    studentId: string;
    classId: string;
    subjectId: string;
    scores: Record<string, number>;
  }) => {
    if (currentUser.role !== 'teacher' && currentUser.role !== 'principal') {
      return { ok: false, error: 'Hanya guru pengampu atau kepala sekolah yang berhak menginput nilai.' };
    }
    if (
      currentUser.role === 'teacher' &&
      !canTeacherManageSubjectClass(
        data.teachingAssignments,
        currentUser.uid,
        params.subjectId,
        params.classId
      )
    ) {
      return {
        ok: false,
        error: 'Anda hanya dapat mengelola nilai untuk mata pelajaran dan kelas yang Anda ampu.',
      };
    }

    const finalScore = calculateWeightedFinalScore(params.scores, data.assessmentComponents);
    const existing = data.academicGrades.find(
      (g) =>
        g.studentId === params.studentId &&
        g.classId === params.classId &&
        g.subjectId === params.subjectId
    );
    const student = data.users.find((u) => u.uid === params.studentId);
    const subject = data.subjects.find((s) => s.id === params.subjectId);
    const gradeId = existing?.id || `grd-${params.studentId}-${params.subjectId}`;
    const record: AcademicGrade = {
      id: gradeId,
      schoolId: data.school.schoolId,
      studentId: params.studentId,
      classId: params.classId,
      subjectId: params.subjectId,
      teacherId: currentUser.uid,
      scores: params.scores,
      finalScore,
      updatedAt: new Date().toISOString(),
    };

    const auditSummary = buildGradeAuditSummary(
      student?.name || params.studentId,
      subject?.name || params.subjectId,
      existing ? existing.finalScore : null,
      finalScore
    );

    setData((prev) => ({
      ...prev,
      academicGrades: existing
        ? prev.academicGrades.map((g) => (g.id === gradeId ? record : g))
        : [...prev.academicGrades, record],
      auditLogs: appendAuditLog(prev, 'akademik', 'UPSERT_GRADE', gradeId, auditSummary),
    }));
    if (firebaseUser) {
      void syncDocumentToFirestore('academic_grades', gradeId, record as unknown as Record<string, unknown>);
    }
    notifyStatus(`Nilai ${student?.name || ''} (${subject?.name || ''}) disimpan: ${finalScore}.`);
    return { ok: true };
  };

  // === MODUL 4: E-TUGAS ===
  const createAssignment = (payload: {
    subjectId: string;
    classId: string;
    title: string;
    instructions: string;
    assignedDate: string;
    dueDate: string;
    allowNumericScore: boolean;
    maxPhotos: number;
    maxFileSizeMb: number;
    attachmentName?: string;
  }) => {
    if (
      currentUser.role === 'teacher' &&
      !canTeacherManageSubjectClass(
        data.teachingAssignments,
        currentUser.uid,
        payload.subjectId,
        payload.classId
      )
    ) {
      return {
        ok: false,
        error: 'Guru hanya dapat membuat tugas untuk kelas dan mata pelajaran yang diampunya.',
      };
    }

    const newAssignment: Assignment = {
      id: `asg-${Date.now()}`,
      schoolId: data.school.schoolId,
      teacherId: currentUser.uid,
      subjectId: payload.subjectId,
      classId: payload.classId,
      title: payload.title.trim(),
      instructions: payload.instructions.trim(),
      assignedDate: payload.assignedDate,
      dueDate: payload.dueDate,
      allowNumericScore: payload.allowNumericScore,
      maxPhotos: payload.maxPhotos,
      maxFileSizeMb: payload.maxFileSizeMb,
      attachmentName: payload.attachmentName,
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    const targetClass = data.classes.find((c) => c.id === payload.classId);
    const studentIds = targetClass?.studentIds || [];

    setData((prev) => {
      let nextNotifications = prev.notifications;
      for (const sid of studentIds) {
        nextNotifications = pushNotification(
          nextNotifications,
          sid,
          'new_assignment',
          `Tugas Baru: ${newAssignment.title}`,
          `${currentUser.name} memberikan tugas untuk kelas ${targetClass?.name || ''}. Tenggat: ${newAssignment.dueDate.replace('T', ' ')}.`
        );
      }
      return {
        ...prev,
        assignments: [newAssignment, ...prev.assignments],
        notifications: nextNotifications,
        auditLogs: appendAuditLog(
          prev,
          'e_tugas',
          'CREATE_ASSIGNMENT',
          newAssignment.id,
          `Membuat tugas "${newAssignment.title}" untuk ${targetClass?.name || payload.classId}`
        ),
      };
    });
    if (firebaseUser) {
      void syncDocumentToFirestore('assignments', newAssignment.id, newAssignment as unknown as Record<string, unknown>);
    }
    notifyStatus(`Tugas "${newAssignment.title}" berhasil diterbitkan.`);
    return { ok: true };
  };

  const updateAssignment = (
    assignmentId: string,
    patch: Partial<
      Pick<
        Assignment,
        'title' | 'instructions' | 'dueDate' | 'status' | 'allowNumericScore' | 'maxPhotos' | 'maxFileSizeMb'
      >
    >
  ) => {
    setData((prev) => ({
      ...prev,
      assignments: prev.assignments.map((a) =>
        a.id === assignmentId
          ? { ...a, ...patch, updatedAt: new Date().toISOString() }
          : a
      ),
      auditLogs: appendAuditLog(
        prev,
        'e_tugas',
        'UPDATE_ASSIGNMENT',
        assignmentId,
        `Memperbarui tugas ${assignmentId}`
      ),
    }));
    notifyStatus('Detail tugas diperbarui.');
  };

  const deleteAssignment = (assignmentId: string) => {
    setData((prev) => ({
      ...prev,
      assignments: prev.assignments.filter((a) => a.id !== assignmentId),
      auditLogs: appendAuditLog(
        prev,
        'e_tugas',
        'DELETE_ASSIGNMENT',
        assignmentId,
        `Menghapus tugas ${assignmentId}`
      ),
    }));
    notifyStatus('Tugas berhasil dihapus.');
  };

  const submitAssignmentPhotos = async (params: {
    assignmentId: string;
    photoDataUrls: string[];
    photoBlobs?: { blob: Blob; name: string }[];
    studentNote: string;
  }) => {
    const assignment = data.assignments.find((a) => a.id === params.assignmentId);
    if (!assignment) {
      return { ok: false, error: 'Tugas tidak ditemukan.' };
    }
    if (currentUser.role !== 'student') {
      return { ok: false, error: 'Hanya siswa yang dapat mengumpulkan jawaban tugas.' };
    }
    if (currentUser.classId !== assignment.classId) {
      return { ok: false, error: 'Anda bukan anggota kelas tujuan tugas ini.' };
    }

    let finalUrls = [...params.photoDataUrls];
    if (firebaseUser && params.photoBlobs && params.photoBlobs.length > 0 && !isOffline) {
      try {
        const uploadedUrls = await Promise.all(
          params.photoBlobs.map((item) =>
            uploadSubmissionPhotoToStorage(
              data.school.schoolId,
              assignment.id,
              currentUser.uid,
              item.blob,
              item.name
            )
          )
        );
        finalUrls = uploadedUrls;
      } catch {
        // Fallback to compressed inline dataUrls
      }
    }

    const nowIso = new Date().toISOString();
    const existing = data.submissions.find(
      (s) => s.assignmentId === assignment.id && s.studentId === currentUser.uid
    );
    const nextStatus = determineSubmissionStatus({
      dueDateIso: assignment.dueDate,
      nowIso,
      previousStatus: existing?.status,
    });
    const submissionId = existing?.id || `sub-${assignment.id}-${currentUser.uid}`;
    const updatedSub: AssignmentSubmission = {
      id: submissionId,
      schoolId: data.school.schoolId,
      assignmentId: assignment.id,
      studentId: currentUser.uid,
      classId: assignment.classId,
      teacherId: assignment.teacherId,
      status: nextStatus,
      photoUrls: finalUrls,
      studentNote: params.studentNote.trim(),
      teacherFeedback: existing?.teacherFeedback,
      score: existing?.score,
      submittedAt: nowIso,
      updatedAt: nowIso,
    };

    const existingHistCount = data.submissionHistory.filter(
      (h) => h.submissionId === submissionId
    ).length;

    const historyEntry: SubmissionHistoryEntry = {
      id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      schoolId: data.school.schoolId,
      submissionId,
      assignmentId: assignment.id,
      studentId: currentUser.uid,
      version: existingHistCount + 1,
      status: nextStatus,
      photoUrls: finalUrls,
      actorRole: 'student',
      note: params.studentNote.trim() || 'Pengumpulan jawaban foto oleh siswa.',
      createdAt: nowIso,
    };

    setData((prev) => {
      const eventType = nextStatus === 'resubmitted' ? 'resubmitted' : 'submitted';
      const nextNotifs = pushNotification(
        prev.notifications,
        assignment.teacherId,
        eventType,
        nextStatus === 'resubmitted' ? 'Revisi Tugas Dikirim Ulang' : 'Pengumpulan Tugas Baru',
        `${currentUser.name} mengirim ${finalUrls.length} foto jawaban untuk "${assignment.title}".`
      );
      return {
        ...prev,
        submissions: existing
          ? prev.submissions.map((s) => (s.id === submissionId ? updatedSub : s))
          : [updatedSub, ...prev.submissions],
        submissionHistory: [historyEntry, ...prev.submissionHistory],
        notifications: nextNotifs,
        auditLogs: appendAuditLog(
          prev,
          'e_tugas',
          nextStatus === 'resubmitted' ? 'RESUBMIT_ASSIGNMENT' : 'SUBMIT_ASSIGNMENT',
          submissionId,
          `${currentUser.name} mengirim jawaban (${nextStatus}) untuk "${assignment.title}"`
        ),
      };
    });

    if (firebaseUser) {
      void syncDocumentToFirestore('assignment_submissions', submissionId, updatedSub as unknown as Record<string, unknown>);
      void syncDocumentToFirestore('submission_history', historyEntry.id, historyEntry as unknown as Record<string, unknown>);
    }
    notifyStatus(
      nextStatus === 'resubmitted'
        ? 'Revisi jawaban berhasil dikirim sebagai riwayat baru.'
        : 'Jawaban foto berhasil dikirim untuk diverifikasi guru.'
    );
    return { ok: true };
  };

  const verifyAssignmentSubmission = (params: {
    submissionId: string;
    decision: 'approved' | 'revision_requested';
    feedback: string;
    score?: number;
  }) => {
    const sub = data.submissions.find((s) => s.id === params.submissionId);
    if (!sub) return { ok: false, error: 'Data pengumpulan tidak ditemukan.' };
    const assignment = data.assignments.find((a) => a.id === sub.assignmentId);
    if (!assignment) return { ok: false, error: 'Tugas tidak ditemukan.' };

    if (currentUser.role === 'teacher' && sub.teacherId !== currentUser.uid) {
      return {
        ok: false,
        error: 'Anda tidak dapat memverifikasi tugas milik guru lain.',
      };
    }

    const validation = validateTeacherVerificationDecision({
      decision: params.decision,
      feedback: params.feedback,
      score: params.score,
      allowNumericScore: assignment.allowNumericScore,
    });
    if (!validation.valid) {
      return { ok: false, error: validation.error };
    }

    const nowIso = new Date().toISOString();
    const updatedSub: AssignmentSubmission = {
      ...sub,
      status: params.decision,
      teacherFeedback: params.feedback.trim(),
      score:
        params.decision === 'approved' && assignment.allowNumericScore
          ? params.score
          : sub.score,
      updatedAt: nowIso,
    };

    const existingHistCount = data.submissionHistory.filter(
      (h) => h.submissionId === sub.id
    ).length;

    const historyEntry: SubmissionHistoryEntry = {
      id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      schoolId: data.school.schoolId,
      submissionId: sub.id,
      assignmentId: sub.assignmentId,
      studentId: sub.studentId,
      version: existingHistCount + 1,
      status: params.decision,
      photoUrls: sub.photoUrls,
      actorRole: currentUser.role,
      note: params.feedback.trim(),
      score: updatedSub.score,
      createdAt: nowIso,
    };

    const student = data.users.find((u) => u.uid === sub.studentId);
    const linkedParents = data.users.filter(
      (u) =>
        u.role === 'parent' &&
        (u.childStudentId === sub.studentId || u.linkedStudentIds?.includes(sub.studentId))
    );

    setData((prev) => {
      let nextNotifs = pushNotification(
        prev.notifications,
        sub.studentId,
        params.decision === 'revision_requested' ? 'revision_requested' : 'approved',
        params.decision === 'revision_requested'
          ? `Perlu Revisi: ${assignment.title}`
          : `Tugas Disetujui: ${assignment.title}`,
        params.decision === 'revision_requested'
          ? `Catatan guru: ${params.feedback.trim()}`
          : `Jawaban Anda telah disetujui${updatedSub.score !== undefined ? ` dengan nilai ${updatedSub.score}` : ''}.`
      );
      for (const parent of linkedParents) {
        nextNotifs = pushNotification(
          nextNotifs,
          parent.uid,
          params.decision === 'revision_requested' ? 'revision_requested' : 'graded',
          `Pembaruan Tugas ${student?.name || ''}`,
          `${assignment.title}: ${params.decision === 'revision_requested' ? 'Perlu Revisi' : 'Sudah Diterima'}.`
        );
      }
      return {
        ...prev,
        submissions: prev.submissions.map((s) => (s.id === sub.id ? updatedSub : s)),
        submissionHistory: [historyEntry, ...prev.submissionHistory],
        notifications: nextNotifs,
        auditLogs: appendAuditLog(
          prev,
          'e_tugas',
          params.decision === 'revision_requested' ? 'REQUEST_REVISION' : 'APPROVE_SUBMISSION',
          sub.id,
          `${params.decision === 'revision_requested' ? 'Meminta revisi' : 'Menyetujui'} tugas "${assignment.title}" milik ${student?.name || sub.studentId}`
        ),
      };
    });

    if (firebaseUser) {
      void syncDocumentToFirestore('assignment_submissions', sub.id, updatedSub as unknown as Record<string, unknown>);
      void syncDocumentToFirestore('submission_history', historyEntry.id, historyEntry as unknown as Record<string, unknown>);
    }
    notifyStatus(
      params.decision === 'revision_requested'
        ? 'Permintaan revisi dan catatan berhasil dikirim ke siswa.'
        : 'Jawaban siswa berhasil disetujui.'
    );
    return { ok: true };
  };

  const markNotificationRead = (notificationId: string) => {
    setData((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) =>
        n.id === notificationId ? { ...n, read: true } : n
      ),
    }));
  };

  const markAllNotificationsRead = () => {
    setData((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) =>
        n.recipientId === currentUser.uid ? { ...n, read: true } : n
      ),
    }));
  };

  // === PPDB, SURVEI, OSIS, BUKU TAMU ===
  const addPpdbRegistration = (
    payload: Omit<PpdbRegistration, 'id' | 'schoolId' | 'registrationCode' | 'status' | 'createdAt'>
  ) => {
    const code = `PPDB-2026-${String(data.ppdbRegistrations.length + 1).padStart(3, '0')}`;
    const item: PpdbRegistration = {
      ...payload,
      id: `ppdb-${Date.now()}`,
      schoolId: data.school.schoolId,
      registrationCode: code,
      status: 'menunggu',
      createdAt: new Date().toISOString(),
    };
    setData((prev) => ({
      ...prev,
      ppdbRegistrations: [item, ...prev.ppdbRegistrations],
    }));
    if (firebaseUser) {
      void syncDocumentToFirestore('ppdb_registrations', item.id, item as unknown as Record<string, unknown>);
    }
    notifyStatus(`Pendaftaran PPDB berhasil dikirim dengan kode ${code}.`);
    return code;
  };

  const updatePpdbStatus = (regId: string, status: PpdbRegistration['status']) => {
    setData((prev) => ({
      ...prev,
      ppdbRegistrations: prev.ppdbRegistrations.map((r) =>
        r.id === regId ? { ...r, status } : r
      ),
    }));
    notifyStatus(`Status pendaftar PPDB diubah menjadi "${status}".`);
  };

  const submitSurveyResponse = (
    surveyId: string,
    ratings: Record<string, number>,
    comment: string
  ) => {
    const resp: SurveyResponse = {
      id: `sr-${Date.now()}`,
      schoolId: data.school.schoolId,
      surveyId,
      respondentId: currentUser.uid,
      ratings,
      comment: comment.trim(),
      submittedAt: new Date().toISOString(),
    };
    setData((prev) => ({
      ...prev,
      surveyResponses: [resp, ...prev.surveyResponses],
    }));
    notifyStatus('Terima kasih, tanggapan survei Anda telah tercatat.');
  };

  const castOsisVote = (candidateId: string) => {
    const already = data.osisVotes.some((v) => v.voterId === currentUser.uid);
    if (already) {
      return { ok: false, error: 'Akun ini sudah menggunakan hak suara pada pemilihan OSIS.' };
    }
    const voteId = `${data.school.schoolId}_${currentUser.uid}`;
    const vote = {
      id: voteId,
      schoolId: data.school.schoolId,
      voterId: currentUser.uid,
      candidateId,
      votedAt: new Date().toISOString(),
    };
    setData((prev) => ({
      ...prev,
      osisVotes: [...prev.osisVotes, vote],
    }));
    if (firebaseUser) {
      void syncDocumentToFirestore('osis_votes', voteId, vote as unknown as Record<string, unknown>);
    }
    notifyStatus('Suara pemilihan OSIS Anda berhasil dicatat (1 akun = 1 suara).');
    return { ok: true };
  };

  const addGuestbookEntry = (
    payload: Omit<GuestbookEntry, 'id' | 'schoolId' | 'checkInAt' | 'status'>
  ) => {
    const item: GuestbookEntry = {
      ...payload,
      id: `gb-${Date.now()}`,
      schoolId: data.school.schoolId,
      checkInAt: new Date().toISOString(),
      status: 'bertamu',
    };
    setData((prev) => ({
      ...prev,
      guestbookEntries: [item, ...prev.guestbookEntries],
    }));
    if (firebaseUser) {
      void syncDocumentToFirestore('guestbook_entries', item.id, item as unknown as Record<string, unknown>);
    }
    notifyStatus(`Tamu "${item.visitorName}" tercatat masuk di Buku Tamu Digital.`);
  };

  const checkoutGuestbookEntry = (entryId: string) => {
    setData((prev) => ({
      ...prev,
      guestbookEntries: prev.guestbookEntries.map((g) =>
        g.id === entryId
          ? { ...g, status: 'selesai', checkOutAt: new Date().toISOString() }
          : g
      ),
    }));
    notifyStatus('Status kunjungan tamu ditandai selesai.');
  };

  // === ABSENSI & OFFLINE SYNC ===
  const recordAttendance = (
    payload: Omit<AttendanceRecord, 'id' | 'schoolId' | 'userId' | 'userName' | 'role' | 'syncSource'>
  ) => {
    const item: AttendanceRecord = {
      ...payload,
      id: `att-${Date.now()}`,
      schoolId: data.school.schoolId,
      userId: currentUser.uid,
      userName: currentUser.name,
      role: currentUser.role,
      syncSource: isOffline ? 'offline_sync' : 'online',
    };
    if (isOffline) {
      setOfflineQueue((q) => [
        ...q,
        {
          id: `oq-${Date.now()}`,
          type: 'attendance',
          label: `Absensi ${currentUser.name} (${item.checkInTime})`,
          payload: item,
          queuedAt: new Date().toISOString(),
        },
      ]);
      setData((prev) => ({
        ...prev,
        attendanceRecords: [item, ...prev.attendanceRecords],
      }));
      notifyStatus('Absensi dicatat dalam mode offline dan masuk ke antrean sinkronisasi.');
      return { ok: true, queued: true };
    }
    setData((prev) => ({
      ...prev,
      attendanceRecords: [item, ...prev.attendanceRecords],
    }));
    if (firebaseUser) {
      void syncDocumentToFirestore('attendance_records', item.id, item as unknown as Record<string, unknown>);
    }
    notifyStatus('Absensi kehadiran berhasil diverifikasi dan tersimpan.');
    return { ok: true, queued: false };
  };

  const syncOfflineQueueNow = async () => {
    if (isOffline) {
      notifyStatus('Koneksi masih offline. Aktifkan koneksi untuk menyinkronkan antrean.');
      return;
    }
    const count = offlineQueue.length;
    if (firebaseUser) {
      for (const item of offlineQueue) {
        if (item.type === 'attendance') {
          const rec = item.payload as AttendanceRecord;
          void syncDocumentToFirestore('attendance_records', rec.id, rec as unknown as Record<string, unknown>);
        } else if (item.type === 'teaching_agenda') {
          const ag = item.payload as TeachingAgenda;
          void syncDocumentToFirestore('teaching_agendas', ag.id, ag as unknown as Record<string, unknown>);
        }
      }
    }
    setOfflineQueue([]);
    notifyStatus(`${count} item antrean offline berhasil disinkronkan.`);
  };

  // === PENGATURAN SEKOLAH, LOKASI & BACKUP ===
  const updateSchoolProfile = (payload: {
    name: string;
    npsn: string;
    address: string;
    latitude: number;
    longitude: number;
    geofenceRadiusMeters: number;
    allowedWifiLabel: string;
    requireEmailVerificationForUsers?: boolean;
  }) => {
    if (currentUser.role !== 'school_admin' && currentUser.role !== 'principal') {
      return {
        ok: false,
        error: 'Hanya Admin Sekolah atau Kepala Sekolah yang berhak mengubah data sekolah.',
      };
    }
    const validation = validateSchoolProfileUpdate(payload);
    if (!validation.valid) {
      return { ok: false, error: validation.error };
    }
    const updatedSchool = {
      ...data.school,
      name: payload.name.trim(),
      npsn: payload.npsn.trim(),
      address: payload.address.trim(),
      latitude: Number(payload.latitude),
      longitude: Number(payload.longitude),
      geofenceRadiusMeters: Number(payload.geofenceRadiusMeters),
      allowedWifiLabel: payload.allowedWifiLabel.trim(),
      requireEmailVerificationForUsers:
        payload.requireEmailVerificationForUsers ??
        data.school.requireEmailVerificationForUsers ??
        false,
      updatedAt: new Date().toISOString(),
    };
    setData((prev) => ({
      ...prev,
      school: updatedSchool,
      auditLogs: appendAuditLog(
        prev,
        'akun',
        'UPDATE_SCHOOL_PROFILE',
        updatedSchool.schoolId,
        `Memperbarui data sekolah: ${updatedSchool.name} (NPSN ${updatedSchool.npsn})`
      ),
    }));
    if (firebaseUser) {
      void syncDocumentToFirestore(
        'schools',
        updatedSchool.schoolId,
        updatedSchool as unknown as Record<string, unknown>
      );
    }
    notifyStatus(`Data sekolah "${updatedSchool.name}" berhasil diperbarui.`);
    return { ok: true };
  };

  const saveSchoolLocation = (payload: {
    locationId?: string;
    locationName: string;
    latitude: number;
    longitude: number;
    address: string;
    radiusInMeters: number;
    isActive: boolean;
  }) => {
    if (currentUser.role !== 'school_admin' && currentUser.role !== 'principal') {
      return {
        ok: false,
        error: 'Hanya Admin Sekolah atau Kepala Sekolah yang berhak mengelola lokasi absensi.',
      };
    }
    const validation = validateSchoolLocationInput({
      locationName: payload.locationName,
      address: payload.address,
      latitude: payload.latitude,
      longitude: payload.longitude,
      radiusInMeters: payload.radiusInMeters,
    });
    if (!validation.valid) {
      return { ok: false, error: validation.error };
    }

    const nowIso = new Date().toISOString();
    const existing = payload.locationId
      ? data.schoolLocations.find((l) => l.locationId === payload.locationId)
      : undefined;

    const saved: SchoolLocation = {
      locationId: existing?.locationId || `loc-${Date.now()}`,
      schoolId: data.school.schoolId,
      locationName: payload.locationName.trim(),
      latitude: Number(payload.latitude.toFixed(6)),
      longitude: Number(payload.longitude.toFixed(6)),
      address: payload.address.trim(),
      radiusInMeters: Math.round(Number(payload.radiusInMeters)),
      isActive: Boolean(payload.isActive),
      createdAt: existing?.createdAt || nowIso,
      updatedAt: nowIso,
    };

    setData((prev) => {
      const nextLocations = existing
        ? prev.schoolLocations.map((l) => (l.locationId === saved.locationId ? saved : l))
        : [saved, ...prev.schoolLocations];

      const primaryActive = nextLocations.find((l) => l.isActive) || nextLocations[0];
      const nextSchool = primaryActive
        ? {
            ...prev.school,
            latitude: primaryActive.latitude,
            longitude: primaryActive.longitude,
            geofenceRadiusMeters: primaryActive.radiusInMeters,
          }
        : prev.school;

      return {
        ...prev,
        school: nextSchool,
        schoolLocations: nextLocations,
        auditLogs: appendAuditLog(
          prev,
          'akun',
          existing ? 'UPDATE_SCHOOL_LOCATION' : 'CREATE_SCHOOL_LOCATION',
          saved.locationId,
          `${existing ? 'Memperbarui' : 'Menambahkan'} titik lokasi absensi "${saved.locationName}" (radius ${saved.radiusInMeters} m)`
        ),
      };
    });

    if (firebaseUser) {
      void syncDocumentToFirestore(
        'school_locations',
        saved.locationId,
        saved as unknown as Record<string, unknown>
      );
    }
    notifyStatus(`Lokasi "${saved.locationName}" (radius ${saved.radiusInMeters} m) berhasil disimpan.`);
    return { ok: true, location: saved };
  };

  const toggleSchoolLocationActive = (locationId: string) => {
    if (currentUser.role !== 'school_admin' && currentUser.role !== 'principal') {
      return { ok: false, error: 'Hanya Admin Sekolah atau Kepala Sekolah yang dapat mengubah status lokasi.' };
    }
    const target = data.schoolLocations.find((l) => l.locationId === locationId);
    if (!target) {
      return { ok: false, error: 'Lokasi tidak ditemukan.' };
    }
    const updated: SchoolLocation = {
      ...target,
      isActive: !target.isActive,
      updatedAt: new Date().toISOString(),
    };
    setData((prev) => {
      const nextLocations = prev.schoolLocations.map((l) =>
        l.locationId === locationId ? updated : l
      );
      const primaryActive = nextLocations.find((l) => l.isActive) || nextLocations[0];
      return {
        ...prev,
        school: primaryActive
          ? {
              ...prev.school,
              latitude: primaryActive.latitude,
              longitude: primaryActive.longitude,
              geofenceRadiusMeters: primaryActive.radiusInMeters,
            }
          : prev.school,
        schoolLocations: nextLocations,
        auditLogs: appendAuditLog(
          prev,
          'akun',
          'TOGGLE_SCHOOL_LOCATION',
          locationId,
          `Mengubah status lokasi "${updated.locationName}" menjadi ${updated.isActive ? 'Aktif' : 'Nonaktif'}`
        ),
      };
    });
    if (firebaseUser) {
      void syncDocumentToFirestore(
        'school_locations',
        updated.locationId,
        updated as unknown as Record<string, unknown>
      );
    }
    notifyStatus(
      `Lokasi "${updated.locationName}" sekarang ${updated.isActive ? 'Aktif' : 'Nonaktif'}.`
    );
    return { ok: true };
  };

  const deleteSchoolLocation = (locationId: string) => {
    if (currentUser.role !== 'school_admin' && currentUser.role !== 'principal') {
      return { ok: false, error: 'Hanya Admin Sekolah atau Kepala Sekolah yang berhak menghapus lokasi.' };
    }
    const target = data.schoolLocations.find((l) => l.locationId === locationId);
    if (!target) {
      return { ok: false, error: 'Lokasi tidak ditemukan.' };
    }
    setData((prev) => {
      const nextLocations = prev.schoolLocations.filter((l) => l.locationId !== locationId);
      const primaryActive = nextLocations.find((l) => l.isActive) || nextLocations[0];
      return {
        ...prev,
        school: primaryActive
          ? {
              ...prev.school,
              latitude: primaryActive.latitude,
              longitude: primaryActive.longitude,
              geofenceRadiusMeters: primaryActive.radiusInMeters,
            }
          : prev.school,
        schoolLocations: nextLocations,
        auditLogs: appendAuditLog(
          prev,
          'akun',
          'DELETE_SCHOOL_LOCATION',
          locationId,
          `Menghapus titik lokasi absensi "${target.locationName}"`
        ),
      };
    });
    if (firebaseUser) {
      void deleteDocumentFromFirestore('school_locations', locationId);
    }
    notifyStatus(`Lokasi "${target.locationName}" berhasil dihapus.`);
    return { ok: true };
  };

  const exportFullBackupJson = () => {
    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        schemaVersion: 'sims-v6-auth-rbac',
        schoolId: data.school.schoolId,
        dataset: data,
      },
      null,
      2
    );
  };

  const restoreFullBackupJson = (jsonText: string) => {
    try {
      const parsed = JSON.parse(jsonText) as { dataset?: SimsDataset };
      if (!parsed.dataset || !parsed.dataset.school || !Array.isArray(parsed.dataset.users)) {
        return { ok: false, error: 'Format file backup JSON tidak sesuai skema SIMS.' };
      }
      setData(normalizeDataset(parsed.dataset));
      notifyStatus('Pemulihan data dari file backup JSON berhasil dilakukan.');
      return { ok: true };
    } catch {
      return { ok: false, error: 'File JSON rusak atau tidak dapat diparsing.' };
    }
  };

  return (
    <SimsContext.Provider
      value={{
        data,
        currentUser,
        firebaseUser,
        firebaseReady,
        authStatus,
        bootstrapInitialized,
        bootstrapLoading,
        pendingAdminDraft,
        pendingVerificationContext,
        resendRateLimitState: (auth.currentUser || firebaseUser)?.uid
          ? resendRateLimitMap[(auth.currentUser || firebaseUser)!.uid]
          : undefined,
        simulatedOffline,
        browserOffline,
        isOffline,
        offlineQueue,
        statusMessage,
        clearStatusMessage,
        setSimulatedOffline,
        refreshBootstrapStatus,
        registerFirstSchoolAdmin,
        resendVerificationEmail,
        checkEmailVerificationAndProceed,
        cancelPendingVerification,
        loginWithUsernamePassword,
        logoutSession,
        completeFirstLoginPasswordChange,
        changeMyPassword,
        loginWithGoogle,
        logoutGoogle,
        syncOfflineQueueNow,
        createSingleUserAccount,
        bulkCreateUsers,
        updateUserAccountProfile,
        toggleUserActiveStatus,
        resetUserPasswordAction,
        deleteUserAccount,
        linkParentAndStudent,
        unlinkParentAndStudent,
        addSubject,
        addCurriculum,
        setActiveCurriculum,
        addClass,
        addTeachingAssignment,
        addSchedule,
        addTeachingAgenda,
        updateAssessmentComponents,
        upsertAcademicGrade,
        createAssignment,
        updateAssignment,
        deleteAssignment,
        submitAssignmentPhotos,
        verifyAssignmentSubmission,
        markNotificationRead,
        markAllNotificationsRead,
        addPpdbRegistration,
        updatePpdbStatus,
        submitSurveyResponse,
        castOsisVote,
        addGuestbookEntry,
        checkoutGuestbookEntry,
        recordAttendance,
        updateSchoolProfile,
        saveSchoolLocation,
        toggleSchoolLocationActive,
        deleteSchoolLocation,
        exportFullBackupJson,
        restoreFullBackupJson,
      }}
    >
      {children}
    </SimsContext.Provider>
  );
};

export function useSims() {
  const ctx = useContext(SimsContext);
  if (!ctx) throw new Error('useSims must be used inside SimsProvider');
  return ctx;
}
