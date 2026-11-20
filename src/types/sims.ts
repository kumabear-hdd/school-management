export type UserRole =
  | 'school_admin'
  | 'principal'
  | 'teacher'
  | 'staff'
  | 'student'
  | 'parent';

export type LegacyUserRole =
  | 'operator'
  | 'kepala_sekolah'
  | 'guru'
  | 'siswa'
  | 'orang_tua';

export type AuthSessionStatus =
  | 'loading'
  | 'unauthenticated'
  | 'must_change_password'
  | 'authenticated';

export type SubmissionStatus =
  | 'assigned'
  | 'submitted'
  | 'revision_requested'
  | 'resubmitted'
  | 'approved'
  | 'late';

export type StudentTaskCategory =
  | 'belum_dikerjakan'
  | 'sedang_dikerjakan'
  | 'menunggu_verifikasi'
  | 'perlu_revisi'
  | 'sudah_diterima'
  | 'terlambat';

export interface BootstrapConfig {
  initialized: boolean;
  primarySchoolId: string;
  primaryAdminUid: string;
  createdAt: string;
}

export interface School {
  schoolId: string;
  name: string;
  npsn: string;
  address: string;
  latitude: number;
  longitude: number;
  geofenceRadiusMeters: number;
  allowedWifiLabel: string;
  adminUid?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SchoolLocation {
  locationId: string;
  schoolId: string;
  locationName: string;
  latitude: number;
  longitude: number;
  address: string;
  radiusInMeters: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserAccount {
  uid: string;
  schoolId: string;
  name: string;
  username: string;
  usernameKey: string;
  email: string;
  authEmail?: string;
  phoneNumber?: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
  firstLoginAt?: string;
  lastLoginAt?: string;
  passwordChangedAt?: string;
  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
  nisOrNip?: string;
  nis?: string;
  nisn?: string;
  entryYear?: string;
  parentPhone?: string;
  jobTitle?: string;
  department?: string;
  relationshipType?: 'Ayah' | 'Ibu' | 'Wali';
  classId?: string;
  childStudentId?: string;
  linkedStudentIds?: string[];
  teachingSubjectIds?: string[];
  teachingClassIds?: string[];
  isHomeroomTeacher?: boolean;
  homeroomClassId?: string;
}

export interface ParentStudentRelation {
  id: string;
  schoolId: string;
  parentUid: string;
  studentUid: string;
  relationship: 'Ayah' | 'Ibu' | 'Wali';
  isPrimary?: boolean;
  createdAt: string;
  createdBy?: string;
}

export interface ImportJobRecord {
  id: string;
  schoolId: string;
  createdByUid: string;
  createdByName: string;
  sourceType: 'excel_csv' | 'dynamic_table';
  totalRows: number;
  successCount: number;
  failedCount: number;
  status: 'completed' | 'partial' | 'failed';
  createdAt: string;
}

export interface Subject {
  id: string;
  schoolId: string;
  code: string;
  name: string;
  category: 'Wajib' | 'Peminatan' | 'Muatan Lokal';
  kkm: number;
}

export interface Curriculum {
  id: string;
  schoolId: string;
  name: string;
  academicYear: string;
  semester: 'Ganjil' | 'Genap';
  isActive: boolean;
}

export interface SchoolClass {
  id: string;
  schoolId: string;
  name: string;
  gradeLevel: string;
  homeroomTeacherId: string;
  studentIds: string[];
}

export interface TeachingAssignment {
  id: string;
  schoolId: string;
  teacherId: string;
  subjectId: string;
  classId: string;
}

export interface ScheduleItem {
  id: string;
  schoolId: string;
  classId: string;
  subjectId: string;
  teacherId: string;
  day: 'Senin' | 'Selasa' | 'Rabu' | 'Kamis' | 'Jumat' | 'Sabtu';
  startTime: string;
  endTime: string;
  room: string;
}

export interface TeachingAgenda {
  id: string;
  schoolId: string;
  teacherId: string;
  classId: string;
  subjectId: string;
  date: string;
  topic: string;
  notes: string;
  presentCount: number;
}

export interface AssessmentComponent {
  id: string;
  schoolId: string;
  name: string;
  weightPercent: number;
  isActive: boolean;
}

export interface AcademicGrade {
  id: string;
  schoolId: string;
  studentId: string;
  classId: string;
  subjectId: string;
  teacherId: string;
  scores: Record<string, number>;
  finalScore: number;
  updatedAt: string;
}

export interface Assignment {
  id: string;
  schoolId: string;
  teacherId: string;
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
  attachmentUrl?: string;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt?: string;
}

export interface AssignmentSubmission {
  id: string;
  schoolId: string;
  assignmentId: string;
  studentId: string;
  classId: string;
  teacherId: string;
  status: SubmissionStatus;
  photoUrls: string[];
  studentNote?: string;
  teacherFeedback?: string;
  score?: number;
  submittedAt?: string;
  updatedAt: string;
}

export interface SubmissionHistoryEntry {
  id: string;
  schoolId: string;
  submissionId: string;
  assignmentId: string;
  studentId: string;
  version: number;
  status: Exclude<SubmissionStatus, 'assigned'>;
  photoUrls: string[];
  actorRole: UserRole;
  note?: string;
  score?: number;
  createdAt: string;
}

export type AssignmentNotificationEvent =
  | 'new_assignment'
  | 'due_soon'
  | 'submitted'
  | 'revision_requested'
  | 'resubmitted'
  | 'approved'
  | 'graded';

export interface AssignmentNotification {
  id: string;
  schoolId: string;
  recipientId: string;
  eventType: AssignmentNotificationEvent;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  schoolId: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  module: 'akademik' | 'e_tugas' | 'keamanan' | 'akun';
  action: string;
  targetId: string;
  summary: string;
  createdAt: string;
}

export interface SchoolAnnouncement {
  id: string;
  schoolId: string;
  title: string;
  category: 'Akademik' | 'Kegiatan' | 'PPDB' | 'Pengumuman';
  publishedAt: string;
  authorName: string;
  excerpt: string;
  content: string;
}

export interface PpdbRegistration {
  id: string;
  schoolId: string;
  registrationCode: string;
  applicantName: string;
  nisn: string;
  track: 'Zonasi' | 'Prestasi' | 'Afirmasi' | 'Perpindahan';
  previousSchool: string;
  parentPhone: string;
  averageScore: number;
  status: 'menunggu' | 'terverifikasi' | 'diterima' | 'ditolak';
  createdAt: string;
}

export interface Survey {
  id: string;
  schoolId: string;
  title: string;
  description: string;
  targetAudience: string;
  isActive: boolean;
  questions: { id: string; text: string }[];
}

export interface SurveyResponse {
  id: string;
  schoolId: string;
  surveyId: string;
  respondentId: string;
  ratings: Record<string, number>;
  comment: string;
  submittedAt: string;
}

export interface OsisCandidate {
  id: string;
  schoolId: string;
  number: number;
  chairName: string;
  viceName: string;
  classLabel: string;
  vision: string;
  mission: string[];
  photoUrl: string;
}

export interface OsisVote {
  id: string;
  schoolId: string;
  voterId: string;
  candidateId: string;
  votedAt: string;
}

export interface GuestbookEntry {
  id: string;
  schoolId: string;
  visitorName: string;
  institution: string;
  purpose: string;
  hostName: string;
  checkInAt: string;
  checkOutAt?: string;
  status: 'bertamu' | 'selesai';
}

export interface AttendanceRecord {
  id: string;
  schoolId: string;
  userId: string;
  userName: string;
  role: UserRole;
  date: string;
  checkInTime: string;
  distanceMeters: number;
  networkLabel: string;
  gpsValid: boolean;
  networkValid: boolean;
  faceVerified: boolean;
  faceSnapshotUrl?: string;
  userLat?: number;
  userLon?: number;
  gpsAccuracyMeters?: number;
  matchedLocationId?: string;
  matchedLocationName?: string;
  gpsAnomalyFlag?: boolean;
  gpsAnomalyReason?: string;
  locationCapturedAt?: string;
  syncSource: 'online' | 'offline_sync';
}

export interface OfflineQueueItem {
  id: string;
  type: 'attendance' | 'teaching_agenda' | 'guestbook';
  label: string;
  payload: unknown;
  queuedAt: string;
}
