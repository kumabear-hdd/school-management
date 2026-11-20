import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canTeacherManageSubjectClass,
  canViewStudentGrades,
  calculateWeightedFinalScore,
  validateComponentWeights,
  validateSchoolProfileUpdate,
} from './academicLogic';
import {
  validatePhotoSubmission,
  determineSubmissionStatus,
  categorizeAssignmentForStudent,
  validateTeacherVerificationDecision,
  computeAssignmentRecapStats,
} from './assignmentLogic';
import {
  assessGpsQuality,
  haversineDistanceMeters,
  validateAttendanceCheckIn,
  validateSchoolLocationInput,
} from './attendanceLogic';
import { createInitialDemoDataset } from '../data/demoSeed';

test('Academic RBAC: teacher only manages assigned subject and class', () => {
  const demo = createInitialDemoDataset();
  assert.equal(
    canTeacherManageSubjectClass(demo.teachingAssignments, 'u-guru-01', 'subj-mat', 'cls-11-ipa-1'),
    true
  );
  assert.equal(
    canTeacherManageSubjectClass(demo.teachingAssignments, 'u-guru-01', 'subj-fis', 'cls-11-ipa-1'),
    false
  );
});

test('Academic RBAC: homeroom teacher, student, and parent grade access checks', () => {
  const demo = createInitialDemoDataset();
  const guru1 = demo.users.find((u) => u.uid === 'u-guru-01')!;
  const siswa1 = demo.users.find((u) => u.uid === 'u-siswa-01')!;
  const siswa2 = demo.users.find((u) => u.uid === 'u-siswa-02')!;
  const ortu1 = demo.users.find((u) => u.uid === 'u-ortu-01')!;

  // Homeroom teacher of XI IPA 1 can view Physics grade of student in XI IPA 1
  assert.equal(
    canViewStudentGrades(guru1, siswa1.uid, 'cls-11-ipa-1', demo.classes, demo.teachingAssignments, 'subj-fis'),
    true
  );
  // Student can view own grade, not another student's
  assert.equal(
    canViewStudentGrades(siswa1, siswa1.uid, 'cls-11-ipa-1', demo.classes, demo.teachingAssignments),
    true
  );
  assert.equal(
    canViewStudentGrades(siswa1, siswa2.uid, 'cls-11-ipa-1', demo.classes, demo.teachingAssignments),
    false
  );
  // Parent can view linked child only
  assert.equal(
    canViewStudentGrades(ortu1, siswa1.uid, 'cls-11-ipa-1', demo.classes, demo.teachingAssignments),
    true
  );
  assert.equal(
    canViewStudentGrades(ortu1, siswa2.uid, 'cls-11-ipa-1', demo.classes, demo.teachingAssignments),
    false
  );
});

test('Weighted final score and component weight validation', () => {
  const demo = createInitialDemoDataset();
  assert.equal(validateComponentWeights(demo.assessmentComponents).valid, true);
  const score = calculateWeightedFinalScore(
    { 'comp-tugas': 90, 'comp-uh': 80, 'comp-praktik': 85, 'comp-sts': 75 },
    demo.assessmentComponents
  );
  // 90*0.3 + 80*0.3 + 85*0.2 + 75*0.2 = 27 + 24 + 17 + 15 = 83
  assert.equal(score, 83);
});

test('E-Tugas photo validation enforces format, size, count, and class membership', () => {
  const demo = createInitialDemoDataset();
  const assignment = demo.assignments[0];

  const valid = validatePhotoSubmission({
    files: [{ name: 'jawaban.jpg', type: 'image/jpeg', sizeBytes: 500_000 }],
    assignment,
    studentClassId: 'cls-11-ipa-1',
    studentSchoolId: demo.school.schoolId,
  });
  assert.equal(valid.valid, true);

  const wrongClass = validatePhotoSubmission({
    files: [{ name: 'jawaban.jpg', type: 'image/jpeg', sizeBytes: 500_000 }],
    assignment,
    studentClassId: 'cls-10-ipa-1',
    studentSchoolId: demo.school.schoolId,
  });
  assert.equal(wrongClass.valid, false);

  const badFormat = validatePhotoSubmission({
    files: [{ name: 'malware.exe', type: 'application/octet-stream', sizeBytes: 1000 }],
    assignment,
    studentClassId: 'cls-11-ipa-1',
    studentSchoolId: demo.school.schoolId,
  });
  assert.equal(badFormat.valid, false);

  const tooMany = validatePhotoSubmission({
    files: Array.from({ length: 6 }, (_, i) => ({
      name: `p${i}.png`,
      type: 'image/png',
      sizeBytes: 100_000,
    })),
    assignment,
    studentClassId: 'cls-11-ipa-1',
    studentSchoolId: demo.school.schoolId,
  });
  assert.equal(tooMany.valid, false);
});

test('E-Tugas status transitions, revision requirement, and recap counts', () => {
  const demo = createInitialDemoDataset();
  assert.equal(
    determineSubmissionStatus({ dueDateIso: '2026-11-24T23:59', nowIso: '2026-11-19T12:00:00Z' }),
    'submitted'
  );
  assert.equal(
    determineSubmissionStatus({ dueDateIso: '2026-11-18T12:00', nowIso: '2026-11-19T12:00:00Z' }),
    'late'
  );
  assert.equal(
    determineSubmissionStatus({
      dueDateIso: '2026-11-18T12:00',
      nowIso: '2026-11-19T12:00:00Z',
      previousStatus: 'revision_requested',
    }),
    'resubmitted'
  );

  assert.equal(
    validateTeacherVerificationDecision({
      decision: 'revision_requested',
      feedback: '',
      allowNumericScore: true,
    }).valid,
    false
  );
  assert.equal(
    validateTeacherVerificationDecision({
      decision: 'revision_requested',
      feedback: 'Mohon foto lebih jelas pada soal nomor 3.',
      allowNumericScore: true,
    }).valid,
    true
  );

  const stats = computeAssignmentRecapStats({
    assignments: demo.assignments,
    submissions: demo.submissions,
    classes: demo.classes,
  });
  assert.equal(stats.totalTargetedStudents, 6);
  assert.equal(stats.totalSubmitted, 3);
  assert.equal(stats.notSubmitted, 3);
  assert.equal(stats.pendingVerification, 1);
  assert.equal(stats.needsRevision, 1);
  assert.equal(stats.approved, 1);

  assert.equal(
    categorizeAssignmentForStudent(demo.assignments[1], undefined, true, '2026-11-19T12:00:00Z'),
    'sedang_dikerjakan'
  );
});

test('Attendance Haversine GPS, Wi-Fi network, and face verification checks', () => {
  const demo = createInitialDemoDataset();
  const distZero = haversineDistanceMeters(
    demo.school.latitude,
    demo.school.longitude,
    demo.school.latitude,
    demo.school.longitude
  );
  assert.equal(distZero, 0);

  const ok = validateAttendanceCheckIn({
    school: demo.school,
    userLat: demo.school.latitude + 0.0005,
    userLon: demo.school.longitude,
    networkLabel: 'SIMS-KAMPUS-5G',
    faceCaptured: true,
  });
  assert.equal(ok.canSubmit, true);

  const far = validateAttendanceCheckIn({
    school: demo.school,
    userLat: demo.school.latitude + 0.02,
    userLon: demo.school.longitude,
    networkLabel: 'WiFi-Publik',
    faceCaptured: false,
  });
  assert.equal(far.canSubmit, false);
  assert.equal(far.reasons.length, 3);
});

test('School profile update validation rejects invalid NPSN or geofence radius', () => {
  assert.equal(
    validateSchoolProfileUpdate({
      name: 'SMA Negeri 1 Merdeka',
      npsn: '20219988',
      address: 'Jl. Merdeka No. 10, Bandung',
      latitude: -6.917464,
      longitude: 107.619123,
      geofenceRadiusMeters: 300,
      allowedWifiLabel: 'SMAN1-WIFI',
    }).valid,
    true
  );

  assert.equal(
    validateSchoolProfileUpdate({
      name: 'AB',
      npsn: '123',
      address: 'Jl.',
      latitude: -6.9,
      longitude: 107.6,
      geofenceRadiusMeters: 2,
      allowedWifiLabel: 'A',
    }).valid,
    false
  );
});

test('Multi-location geofencing matches active branches, ignores inactive ones, and flags poor GPS accuracy', () => {
  const demo = createInitialDemoDataset();
  const labLocation = demo.schoolLocations.find((l) => l.locationId === 'loc-gedung-praktik')!;
  const inactiveBranch = demo.schoolLocations.find((l) => l.locationId === 'loc-gedung-cabang')!;

  // Inside 2nd active location (Gedung Laboratorium & Praktik)
  const insideLab = validateAttendanceCheckIn({
    school: demo.school,
    schoolLocations: demo.schoolLocations,
    userLat: labLocation.latitude + 0.0002,
    userLon: labLocation.longitude,
    gpsAccuracyMeters: 15,
    networkLabel: 'SIMS-KAMPUS-5G',
    faceCaptured: true,
  });
  assert.equal(insideLab.canSubmit, true);
  assert.equal(insideLab.matchedLocationId, 'loc-gedung-praktik');
  assert.equal(insideLab.gpsAnomalyFlag, false);

  // Inside inactive branch should be rejected
  const atInactiveBranch = validateAttendanceCheckIn({
    school: demo.school,
    schoolLocations: demo.schoolLocations,
    userLat: inactiveBranch.latitude,
    userLon: inactiveBranch.longitude,
    gpsAccuracyMeters: 10,
    networkLabel: 'SIMS-KAMPUS-5G',
    faceCaptured: true,
  });
  assert.equal(atInactiveBranch.gpsValid, false);
  assert.equal(atInactiveBranch.canSubmit, false);

  // Poor GPS accuracy (> 100 m) raises gpsAnomalyFlag while preserving validation info
  const poorAccuracy = validateAttendanceCheckIn({
    school: demo.school,
    schoolLocations: demo.schoolLocations,
    userLat: labLocation.latitude,
    userLon: labLocation.longitude,
    gpsAccuracyMeters: 220,
    networkLabel: 'SIMS-KAMPUS-5G',
    faceCaptured: true,
  });
  assert.equal(poorAccuracy.gpsAnomalyFlag, true);
  assert.equal(poorAccuracy.gpsQualityLabel, 'Kurang Akurat');

  // Null Island (0, 0) flagged as anomaly and invalid coordinates
  const nullIsland = assessGpsQuality({ latitude: 0, longitude: 0, accuracyMeters: 5 });
  assert.equal(nullIsland.coordinatesValid, false);
  assert.equal(nullIsland.isAnomaly, true);
});

test('School location input validation checks name, address, lat/lng, and radius bounds', () => {
  assert.equal(
    validateSchoolLocationInput({
      locationName: 'Gedung Praktik Kimia',
      address: 'Jl. Ganesha No. 10, Bandung',
      latitude: -6.8915,
      longitude: 107.6107,
      radiusInMeters: 100,
    }).valid,
    true
  );

  assert.equal(
    validateSchoolLocationInput({
      locationName: 'A',
      address: 'Jl. Ganesha No. 10, Bandung',
      latitude: -6.8915,
      longitude: 107.6107,
      radiusInMeters: 100,
    }).valid,
    false
  );

  assert.equal(
    validateSchoolLocationInput({
      locationName: 'Gedung Cabang',
      address: 'Jl. Dago No. 5',
      latitude: -95,
      longitude: 107.6107,
      radiusInMeters: 5,
    }).valid,
    false
  );
});

import {
  canAccessNavSection,
  canManageSchoolSettings,
  canManageUsers,
  checkLoginRateLimit,
  generateStrongTempPassword,
  generateUsernameFromName,
  mustChangePasswordForRole,
  normalizeUserRole,
  recordFailedLoginAttempt,
  validateFirstAdminRegistration,
  validatePasswordStrength,
  validateUsernameFormat,
} from './authLogic';
import {
  createEmptyDraftRow,
  validateBulkUserRows,
} from './bulkUserUtils';

test('Multi-role normalization & first-login mandatory password policy', () => {
  assert.equal(normalizeUserRole('operator'), 'school_admin');
  assert.equal(normalizeUserRole('kepala_sekolah'), 'principal');
  assert.equal(normalizeUserRole('guru'), 'teacher');
  assert.equal(normalizeUserRole('siswa'), 'student');
  assert.equal(normalizeUserRole('orang_tua'), 'parent');
  assert.equal(normalizeUserRole('Kepala Sekolah'), 'principal');
  assert.equal(normalizeUserRole('Staff'), 'staff');
  assert.equal(normalizeUserRole('unknown_role'), null);

  // Wajib ganti password saat login pertama: principal, teacher, staff
  assert.equal(mustChangePasswordForRole('principal'), true);
  assert.equal(mustChangePasswordForRole('teacher'), true);
  assert.equal(mustChangePasswordForRole('staff'), true);

  // Tidak wajib ganti password saat login pertama: school_admin, student, parent
  assert.equal(mustChangePasswordForRole('school_admin'), false);
  assert.equal(mustChangePasswordForRole('student'), false);
  assert.equal(mustChangePasswordForRole('parent'), false);
});

test('Username generation uniqueness, format validation, and strong password rules', () => {
  const existing = ['rina.kusuma', 'rina.kusuma2'];
  assert.equal(generateUsernameFromName('Rina Kusuma, S.Pd.', existing), 'rina.kusuma3');
  assert.equal(validateUsernameFormat('Budi.Santoso').valid, true);
  assert.equal(validateUsernameFormat('ab').valid, false);
  assert.equal(validateUsernameFormat('bad user!').valid, false);

  const generatedPw = generateStrongTempPassword(12);
  assert.equal(generatedPw.length >= 12, true);
  assert.equal(validatePasswordStrength(generatedPw).valid, true);
  assert.equal(validatePasswordStrength('weak').valid, false);
  assert.equal(validatePasswordStrength('onlylowercase123').valid, false);
});

test('First admin registration validation and login rate limiter', () => {
  assert.equal(
    validateFirstAdminRegistration({
      adminName: 'Dewi Anggraini',
      username: 'admin.dewi',
      email: 'admin@sekolah.sch.id',
      phoneNumber: '081234567890',
      password: 'Password123!',
      confirmPassword: 'Password123!',
      schoolName: 'SMA Negeri 1 Merdeka',
      npsn: '20219988',
      schoolAddress: 'Jl. Merdeka No. 1, Bandung',
    }).valid,
    true
  );

  assert.equal(
    validateFirstAdminRegistration({
      adminName: 'Dewi Anggraini',
      username: 'admin.dewi',
      email: 'admin@sekolah.sch.id',
      phoneNumber: '081234567890',
      password: 'Password123!',
      confirmPassword: 'DifferentPassword123!',
      schoolName: 'SMA Negeri 1 Merdeka',
      schoolAddress: 'Jl. Merdeka No. 1, Bandung',
    }).valid,
    false
  );

  let rateState = recordFailedLoginAttempt(undefined, 1000);
  for (let i = 0; i < 4; i += 1) {
    rateState = recordFailedLoginAttempt(rateState, 1000 + i * 100);
  }
  const blocked = checkLoginRateLimit(rateState, 2000);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.remainingSeconds > 0, true);

  const unlocked = checkLoginRateLimit(rateState, 70_000);
  assert.equal(unlocked.allowed, true);
});

test('Bulk import row validation detects duplicates, invalid roles, unknown class, and accepts valid rows', () => {
  const demo = createInitialDemoDataset();
  const validStudent = {
    ...createEmptyDraftRow(1),
    roleInput: 'student',
    name: 'Bima Sakti',
    username: 'bima.sakti',
    password: 'Password123!',
    nisOrNip: '20269901',
    classInput: 'XI IPA 1',
  };
  const dupExistingUser = {
    ...createEmptyDraftRow(2),
    roleInput: 'teacher',
    name: 'Duplikat Guru',
    username: 'rina.kusuma',
    password: 'Password123!',
    nisOrNip: '19990101',
  };
  const badClassAndDupFile1 = {
    ...createEmptyDraftRow(3),
    roleInput: 'student',
    name: 'Siswa Salah Kelas',
    username: 'duplikat.file',
    password: 'Password123!',
    nisOrNip: '20269902',
    classInput: 'XII IPS 99',
  };
  const badRoleAndDupFile2 = {
    ...createEmptyDraftRow(4),
    roleInput: 'school_admin',
    name: 'Admin Illegal Bulk',
    username: 'duplikat.file',
    password: 'Password123!',
  };
  const validParent = {
    ...createEmptyDraftRow(5),
    roleInput: 'parent',
    name: 'Ibu Nadia Baru',
    username: 'ibu.nadia',
    password: 'Password123!',
    linkedStudentInput: '20250101',
    relationshipType: 'Ibu' as const,
  };

  const results = validateBulkUserRows(
    [validStudent, dupExistingUser, badClassAndDupFile1, badRoleAndDupFile2, validParent],
    {
      classes: demo.classes,
      subjects: demo.subjects,
      existingUsers: demo.users,
    }
  );

  assert.equal(results[0].valid, true);
  assert.equal(results[0].resolvedClassId, 'cls-11-ipa-1');
  assert.equal(results[0].mustChangePassword, false);

  assert.equal(results[1].valid, false);
  assert.equal(results[1].errorCodes.includes('duplicate_username_existing'), true);

  assert.equal(results[2].valid, false);
  assert.equal(results[2].errorCodes.includes('class_not_found'), true);
  assert.equal(results[2].errorCodes.includes('duplicate_username_in_file'), true);

  assert.equal(results[3].valid, false);
  assert.equal(results[3].errorCodes.includes('invalid_role'), true);

  assert.equal(results[4].valid, true);
  assert.deepEqual(results[4].resolvedStudentIds, ['u-siswa-01']);
});

test('RBAC navigation & management permission matrix across all 6 roles', () => {
  assert.equal(canManageUsers('school_admin'), true);
  assert.equal(canManageUsers('principal'), false);
  assert.equal(canManageUsers('staff'), false);
  assert.equal(canManageSchoolSettings('school_admin'), true);
  assert.equal(canManageSchoolSettings('principal'), true);
  assert.equal(canManageSchoolSettings('teacher'), false);

  assert.equal(canAccessNavSection('school_admin', 'manajemen_pengguna'), true);
  assert.equal(canAccessNavSection('teacher', 'manajemen_pengguna'), false);
  assert.equal(canAccessNavSection('staff', 'e_tugas'), false);
  assert.equal(canAccessNavSection('student', 'e_tugas'), true);
  assert.equal(canAccessNavSection('parent', 'administrasi'), false);
});

import {
  buildDeterministicSchoolId,
  checkResendRateLimit,
  isSyntheticSimsEmail,
  recordResendAttempt,
  RESEND_COOLDOWN_SECONDS,
  RESEND_MAX_ATTEMPTS_PER_WINDOW,
  RESEND_WINDOW_MS,
  shouldRequireEmailVerificationForLogin,
  validateBackendDecodedTokenClaims,
  validatePendingAdminDraftCompletion,
} from './emailVerificationLogic';

test('First admin registration rejects synthetic @sims.local email', () => {
  const res = validateFirstAdminRegistration({
    adminName: 'Dewi Anggraini',
    username: 'admin.dewi',
    email: 'admin.dewi@sims.local',
    phoneNumber: '081234567890',
    password: 'Password123!',
    confirmPassword: 'Password123!',
    schoolName: 'SMA Negeri 1 Merdeka',
    npsn: '20219988',
    schoolAddress: 'Jl. Merdeka No. 1, Bandung',
  });
  assert.equal(res.valid, false);
});

test('Email verification resend rate limit enforces 60s cooldown and 15m window quota', () => {
  const t0 = 1_700_000_000_000;
  const initialCheck = checkResendRateLimit(undefined, t0);
  assert.equal(initialCheck.allowed, true);
  assert.equal(initialCheck.remainingAttemptsInWindow, RESEND_MAX_ATTEMPTS_PER_WINDOW);

  let state = recordResendAttempt(undefined, t0);
  const blockedCooldown = checkResendRateLimit(state, t0 + 15_000);
  assert.equal(blockedCooldown.allowed, false);
  assert.equal(blockedCooldown.reason, 'cooldown');
  assert.equal(blockedCooldown.retryAfterSeconds, RESEND_COOLDOWN_SECONDS - 15);

  // Advance past cooldown and hit max attempts in window
  let t = t0 + RESEND_COOLDOWN_SECONDS * 1000 + 1000;
  for (let i = 1; i < RESEND_MAX_ATTEMPTS_PER_WINDOW; i += 1) {
    assert.equal(checkResendRateLimit(state, t).allowed, true);
    state = recordResendAttempt(state, t);
    t += RESEND_COOLDOWN_SECONDS * 1000 + 1000;
  }

  const blockedQuota = checkResendRateLimit(state, t);
  assert.equal(blockedQuota.allowed, false);
  assert.equal(blockedQuota.reason, 'window_quota');
  assert.equal(blockedQuota.remainingAttemptsInWindow, 0);

  // Advances past 15 minute rolling window from oldest attempt
  const unlockedAfterWindow = checkResendRateLimit(state, t0 + RESEND_WINDOW_MS + 1000);
  assert.equal(unlockedAfterWindow.allowed, true);
});

test('Backend decoded token claims validation blocks unverified email claims', () => {
  assert.equal(
    validateBackendDecodedTokenClaims({
      email: 'admin@sekolah.sch.id',
      email_verified: true,
    }).valid,
    false
  );
  const unverified = validateBackendDecodedTokenClaims({
    uid: 'uid-admin-1',
    email: 'admin@sekolah.sch.id',
    email_verified: false,
  });
  assert.equal(unverified.valid, false);
  assert.equal(unverified.emailVerified, false);

  const verified = validateBackendDecodedTokenClaims({
    uid: 'uid-admin-1',
    email: 'admin@sekolah.sch.id',
    email_verified: true,
  });
  assert.equal(verified.valid, true);
  assert.equal(verified.emailVerified, true);
  assert.equal(verified.uid, 'uid-admin-1');
});

test('School-wide email verification policy preserves existing logins when disabled and skips @sims.local', () => {
  assert.equal(isSyntheticSimsEmail('budi.guru.sman1@sims.local'), true);
  assert.equal(isSyntheticSimsEmail('guru@sekolah.sch.id'), false);

  // When school policy is false/undefined -> existing non-admin logins unaffected
  assert.equal(
    shouldRequireEmailVerificationForLogin({
      role: 'teacher',
      authEmail: 'guru@sekolah.sch.id',
      schoolRequireEmailVerification: false,
    }),
    false
  );

  // When school policy is true -> real emails require verification, synthetic @sims.local skipped
  assert.equal(
    shouldRequireEmailVerificationForLogin({
      role: 'teacher',
      authEmail: 'guru@sekolah.sch.id',
      schoolRequireEmailVerification: true,
    }),
    true
  );
  assert.equal(
    shouldRequireEmailVerificationForLogin({
      role: 'student',
      authEmail: 'ani.siswa.sman1@sims.local',
      schoolRequireEmailVerification: true,
    }),
    false
  );
});

test('Deterministic schoolId and pending admin draft completion prevent duplicates on retry and isolate tenants', () => {
  const idWithNpsn1 = buildDeterministicSchoolId('SMA Negeri 1 Merdeka', '20219988', 'UidAbc123456');
  const idWithNpsn2 = buildDeterministicSchoolId('SMA Negeri 1 Merdeka', '20219988', 'UidAbc123456');
  assert.equal(idWithNpsn1, idWithNpsn2);

  // Different admins registering schools with identical name & NPSN still get distinct schoolIds
  const idOtherAdmin = buildDeterministicSchoolId('SMA Negeri 1 Merdeka', '20219988', 'UidZyx987654');
  assert.notEqual(idWithNpsn1, idOtherAdmin);

  const idNoNpsn1 = buildDeterministicSchoolId('SMA Harapan', '', 'UidAbc123456');
  const idNoNpsn2 = buildDeterministicSchoolId('SMA Harapan', undefined, 'UidAbc123456');
  assert.equal(idNoNpsn1, idNoNpsn2);

  const badDraft = validatePendingAdminDraftCompletion({
    adminName: 'A',
    username: 'budi.admin',
    email: 'admin@sims.local',
    phoneNumber: '081234567890',
    schoolName: 'SMA Negeri 1',
    schoolAddress: 'Jl. Merdeka 1',
  });
  assert.equal(badDraft.valid, false);

  const goodDraft = validatePendingAdminDraftCompletion({
    adminName: 'Budi Hartono',
    username: 'Budi.Admin',
    email: 'admin@sekolah.sch.id',
    phoneNumber: '081234567890',
    schoolName: 'SMA Negeri 1',
    npsn: '20219988',
    schoolAddress: 'Jl. Merdeka 1, Bandung',
  });
  assert.equal(goodDraft.valid, true);
  assert.equal(goodDraft.normalizedUsername, 'budi.admin');
});


