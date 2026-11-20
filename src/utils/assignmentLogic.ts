import type {
  Assignment,
  AssignmentSubmission,
  SchoolClass,
  StudentTaskCategory,
  SubmissionStatus,
} from '../types/sims';

export interface PhotoValidationCandidate {
  name: string;
  type: string;
  sizeBytes: number;
}

export interface PhotoValidationParams {
  files: PhotoValidationCandidate[];
  assignment: Assignment;
  studentClassId?: string;
  studentSchoolId: string;
}

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

export function validatePhotoSubmission(params: PhotoValidationParams): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const { files, assignment, studentClassId, studentSchoolId } = params;

  if (assignment.schoolId !== studentSchoolId) {
    errors.push('Tugas tidak berasal dari sekolah yang sama.');
  }

  if (!studentClassId || studentClassId !== assignment.classId) {
    errors.push('Anda bukan anggota kelas tujuan tugas ini.');
  }

  if (assignment.status !== 'active') {
    errors.push('Tugas sudah diarsipkan dan tidak menerima pengumpulan baru.');
  }

  if (files.length === 0) {
    errors.push('Pilih minimal 1 foto jawaban sebelum mengirim.');
  }

  if (files.length > assignment.maxPhotos) {
    errors.push(`Maksimal ${assignment.maxPhotos} foto per pengumpulan (terpilih ${files.length}).`);
  }

  const maxBytes = assignment.maxFileSizeMb * 1024 * 1024;
  for (const file of files) {
    const lowerName = file.name.toLowerCase();
    const hasValidExt = ALLOWED_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
    const hasValidMime = ALLOWED_MIME_TYPES.has(file.type.toLowerCase());
    if (!hasValidMime && !hasValidExt) {
      errors.push(`Format file "${file.name}" tidak valid. Gunakan JPG, JPEG, PNG, atau WEBP.`);
    }
    if (file.sizeBytes > maxBytes) {
      errors.push(
        `Ukuran file "${file.name}" melebihi batas ${assignment.maxFileSizeMb} MB.`
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

export function determineSubmissionStatus(params: {
  dueDateIso: string;
  nowIso: string;
  previousStatus?: SubmissionStatus;
}): Exclude<SubmissionStatus, 'assigned'> {
  const { dueDateIso, nowIso, previousStatus } = params;
  if (previousStatus === 'revision_requested') {
    return 'resubmitted';
  }
  const dueMs = new Date(dueDateIso).getTime();
  const nowMs = new Date(nowIso).getTime();
  if (Number.isFinite(dueMs) && Number.isFinite(nowMs) && nowMs > dueMs) {
    return 'late';
  }
  return 'submitted';
}

export function categorizeAssignmentForStudent(
  assignment: Assignment,
  submission: AssignmentSubmission | undefined,
  hasLocalDraft: boolean,
  nowIso: string
): StudentTaskCategory {
  if (submission) {
    switch (submission.status) {
      case 'approved':
        return 'sudah_diterima';
      case 'revision_requested':
        return 'perlu_revisi';
      case 'submitted':
      case 'resubmitted':
        return 'menunggu_verifikasi';
      case 'late':
        return 'terlambat';
      case 'assigned':
      default:
        break;
    }
  }

  const dueMs = new Date(assignment.dueDate).getTime();
  const nowMs = new Date(nowIso).getTime();
  if (Number.isFinite(dueMs) && Number.isFinite(nowMs) && nowMs > dueMs) {
    return 'terlambat';
  }
  if (hasLocalDraft) {
    return 'sedang_dikerjakan';
  }
  return 'belum_dikerjakan';
}

export function validateTeacherVerificationDecision(params: {
  decision: 'approved' | 'revision_requested';
  feedback: string;
  score?: number;
  allowNumericScore: boolean;
}): { valid: boolean; error?: string } {
  const { decision, feedback, score, allowNumericScore } = params;
  if (decision === 'revision_requested' && feedback.trim().length < 3) {
    return {
      valid: false,
      error: 'Catatan revisi wajib diisi saat meminta perbaikan jawaban siswa.',
    };
  }
  if (allowNumericScore && score !== undefined) {
    if (!Number.isFinite(score) || score < 0 || score > 100) {
      return {
        valid: false,
        error: 'Nilai angka harus berada pada rentang 0 sampai 100.',
      };
    }
  }
  return { valid: true };
}

export interface AssignmentRecapStats {
  totalTargetedStudents: number;
  notSubmitted: number;
  totalSubmitted: number;
  pendingVerification: number;
  needsRevision: number;
  approved: number;
  late: number;
}

export function computeAssignmentRecapStats(params: {
  assignments: Assignment[];
  submissions: AssignmentSubmission[];
  classes: SchoolClass[];
  classIdFilter?: string;
  subjectIdFilter?: string;
  assignmentIdFilter?: string;
  periodStart?: string;
  periodEnd?: string;
}): AssignmentRecapStats {
  const {
    assignments,
    submissions,
    classes,
    classIdFilter,
    subjectIdFilter,
    assignmentIdFilter,
    periodStart,
    periodEnd,
  } = params;

  const filteredAssignments = assignments.filter((a) => {
    if (classIdFilter && classIdFilter !== 'all' && a.classId !== classIdFilter) return false;
    if (subjectIdFilter && subjectIdFilter !== 'all' && a.subjectId !== subjectIdFilter) return false;
    if (assignmentIdFilter && assignmentIdFilter !== 'all' && a.id !== assignmentIdFilter) return false;
    if (periodStart && a.assignedDate < periodStart) return false;
    if (periodEnd && a.assignedDate > periodEnd) return false;
    return true;
  });

  let totalTargetedStudents = 0;
  let notSubmitted = 0;
  let totalSubmitted = 0;
  let pendingVerification = 0;
  let needsRevision = 0;
  let approved = 0;
  let late = 0;

  for (const assignment of filteredAssignments) {
    const targetClass = classes.find((c) => c.id === assignment.classId);
    const studentIds = targetClass?.studentIds ?? [];
    totalTargetedStudents += studentIds.length;

    for (const studentId of studentIds) {
      const sub = submissions.find(
        (s) => s.assignmentId === assignment.id && s.studentId === studentId
      );
      if (!sub || sub.status === 'assigned') {
        notSubmitted += 1;
        continue;
      }
      totalSubmitted += 1;
      if (sub.status === 'submitted' || sub.status === 'resubmitted') {
        pendingVerification += 1;
      } else if (sub.status === 'revision_requested') {
        needsRevision += 1;
      } else if (sub.status === 'approved') {
        approved += 1;
      } else if (sub.status === 'late') {
        late += 1;
        pendingVerification += 1;
      }
    }
  }

  return {
    totalTargetedStudents,
    notSubmitted,
    totalSubmitted,
    pendingVerification,
    needsRevision,
    approved,
    late,
  };
}
