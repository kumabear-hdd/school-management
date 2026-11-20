import type {
  AssessmentComponent,
  SchoolClass,
  TeachingAssignment,
  UserAccount,
} from '../types/sims';

export function canTeacherManageSubjectClass(
  teachingAssignments: TeachingAssignment[],
  teacherId: string,
  subjectId: string,
  classId: string
): boolean {
  return teachingAssignments.some(
    (item) =>
      item.teacherId === teacherId &&
      item.subjectId === subjectId &&
      item.classId === classId
  );
}

export function canViewStudentGrades(
  viewer: UserAccount,
  studentId: string,
  classId: string,
  classes: SchoolClass[],
  teachingAssignments: TeachingAssignment[],
  subjectId?: string
): boolean {
  if (viewer.role === 'principal' || viewer.role === 'school_admin') {
    return true;
  }
  if (viewer.role === 'student') {
    return viewer.uid === studentId;
  }
  if (viewer.role === 'parent') {
    return (
      viewer.childStudentId === studentId ||
      Boolean(viewer.linkedStudentIds?.includes(studentId))
    );
  }
  if (viewer.role === 'teacher') {
    const isHomeroom = classes.some(
      (cls) => cls.id === classId && cls.homeroomTeacherId === viewer.uid
    );
    if (isHomeroom) {
      return true;
    }
    if (subjectId) {
      return canTeacherManageSubjectClass(
        teachingAssignments,
        viewer.uid,
        subjectId,
        classId
      );
    }
    return teachingAssignments.some(
      (item) => item.teacherId === viewer.uid && item.classId === classId
    );
  }
  return false;
}

export function calculateWeightedFinalScore(
  scores: Record<string, number>,
  components: AssessmentComponent[]
): number {
  const active = components.filter((c) => c.isActive && c.weightPercent > 0);
  if (active.length === 0) return 0;

  let weightedSum = 0;
  let totalWeight = 0;
  for (const comp of active) {
    const val = Number(scores[comp.id] ?? 0);
    const clamped = Math.max(0, Math.min(100, Number.isFinite(val) ? val : 0));
    weightedSum += clamped * comp.weightPercent;
    totalWeight += comp.weightPercent;
  }
  if (totalWeight === 0) return 0;
  return Math.round((weightedSum / totalWeight) * 10) / 10;
}

export function validateComponentWeights(components: AssessmentComponent[]): {
  valid: boolean;
  totalActiveWeight: number;
  error?: string;
} {
  const active = components.filter((c) => c.isActive);
  const totalActiveWeight = active.reduce((acc, c) => acc + c.weightPercent, 0);
  if (active.length === 0) {
    return {
      valid: false,
      totalActiveWeight: 0,
      error: 'Minimal harus ada 1 komponen penilaian aktif.',
    };
  }
  if (totalActiveWeight !== 100) {
    return {
      valid: false,
      totalActiveWeight,
      error: `Total bobot komponen aktif harus 100% (saat ini ${totalActiveWeight}%).`,
    };
  }
  return { valid: true, totalActiveWeight };
}

export function buildGradeAuditSummary(
  studentName: string,
  subjectName: string,
  previousScore: number | null,
  nextScore: number
): string {
  if (previousScore === null) {
    return `Input nilai awal ${subjectName} untuk ${studentName}: ${nextScore}`;
  }
  return `Perubahan nilai ${subjectName} untuk ${studentName}: ${previousScore} → ${nextScore}`;
}

export function validateSchoolProfileUpdate(input: {
  name: string;
  npsn: string;
  address: string;
  latitude: number;
  longitude: number;
  geofenceRadiusMeters: number;
  allowedWifiLabel: string;
}): { valid: boolean; error?: string } {
  if (input.name.trim().length < 3 || input.name.trim().length > 160) {
    return { valid: false, error: 'Nama sekolah harus antara 3 hingga 160 karakter.' };
  }
  if (!/^\d{8,16}$/.test(input.npsn.trim())) {
    return { valid: false, error: 'NPSN harus terdiri dari 8 hingga 16 digit angka.' };
  }
  if (input.address.trim().length < 5 || input.address.trim().length > 300) {
    return { valid: false, error: 'Alamat sekolah minimal 5 karakter.' };
  }
  if (!Number.isFinite(input.latitude) || input.latitude < -90 || input.latitude > 90) {
    return { valid: false, error: 'Latitude harus berada di antara -90 dan 90.' };
  }
  if (!Number.isFinite(input.longitude) || input.longitude < -180 || input.longitude > 180) {
    return { valid: false, error: 'Longitude harus berada di antara -180 dan 180.' };
  }
  if (
    !Number.isFinite(input.geofenceRadiusMeters) ||
    input.geofenceRadiusMeters < 10 ||
    input.geofenceRadiusMeters > 5000
  ) {
    return { valid: false, error: 'Radius geofence harus antara 10 sampai 5000 meter.' };
  }
  if (input.allowedWifiLabel.trim().length < 2 || input.allowedWifiLabel.trim().length > 120) {
    return { valid: false, error: 'Nama jaringan Wi-Fi resmi minimal 2 karakter.' };
  }
  return { valid: true };
}

