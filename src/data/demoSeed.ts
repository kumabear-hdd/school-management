import type {
  AcademicGrade,
  AssessmentComponent,
  Assignment,
  AssignmentNotification,
  AssignmentSubmission,
  AttendanceRecord,
  AuditLogEntry,
  Curriculum,
  GuestbookEntry,
  ImportJobRecord,
  OsisCandidate,
  OsisVote,
  ParentStudentRelation,
  PpdbRegistration,
  ScheduleItem,
  School,
  SchoolAnnouncement,
  SchoolClass,
  SchoolLocation,
  Subject,
  SubmissionHistoryEntry,
  Survey,
  SurveyResponse,
  TeachingAgenda,
  TeachingAssignment,
  UserAccount,
} from '../types/sims';

export interface SimsDataset {
  school: School;
  schoolLocations: SchoolLocation[];
  users: UserAccount[];
  parentStudentRelations: ParentStudentRelation[];
  importJobs: ImportJobRecord[];
  subjects: Subject[];
  curriculums: Curriculum[];
  classes: SchoolClass[];
  teachingAssignments: TeachingAssignment[];
  schedules: ScheduleItem[];
  teachingAgendas: TeachingAgenda[];
  assessmentComponents: AssessmentComponent[];
  academicGrades: AcademicGrade[];
  assignments: Assignment[];
  submissions: AssignmentSubmission[];
  submissionHistory: SubmissionHistoryEntry[];
  notifications: AssignmentNotification[];
  auditLogs: AuditLogEntry[];
  announcements: SchoolAnnouncement[];
  ppdbRegistrations: PpdbRegistration[];
  surveys: Survey[];
  surveyResponses: SurveyResponse[];
  osisCandidates: OsisCandidate[];
  osisVotes: OsisVote[];
  guestbookEntries: GuestbookEntry[];
  attendanceRecords: AttendanceRecord[];
}

export const DEFAULT_SCHOOL_ID = 'sma-nusantara-01';

export function createEmptySchoolDataset(
  school?: School,
  adminUser?: UserAccount
): SimsDataset {
  const nowIso = new Date().toISOString();
  const baseSchool: School = school || {
    schoolId: 'pending-tenant',
    name: 'SIMS Terpadu',
    npsn: '',
    address: '',
    latitude: -6.208763,
    longitude: 106.845599,
    geofenceRadiusMeters: 150,
    allowedWifiLabel: 'SIMS-SCHOOL-WIFI',
    createdAt: nowIso,
  };

  return {
    school: baseSchool,
    schoolLocations: school
      ? [
          {
            locationId: 'loc-gedung-utama',
            schoolId: baseSchool.schoolId,
            locationName: 'Lokasi Utama Sekolah',
            latitude: baseSchool.latitude,
            longitude: baseSchool.longitude,
            address: baseSchool.address,
            radiusInMeters: baseSchool.geofenceRadiusMeters || 150,
            isActive: true,
            createdAt: nowIso,
            updatedAt: nowIso,
          },
        ]
      : [],
    users: adminUser ? [adminUser] : [],
    parentStudentRelations: [],
    importJobs: [],
    subjects: [],
    curriculums: [
      {
        id: 'curr-active-01',
        schoolId: baseSchool.schoolId,
        name: 'Kurikulum Merdeka',
        academicYear: `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`,
        semester: 'Ganjil',
        isActive: true,
      },
    ],
    classes: [],
    teachingAssignments: [],
    schedules: [],
    teachingAgendas: [],
    assessmentComponents: [
      { id: 'comp-tugas', schoolId: baseSchool.schoolId, name: 'Tugas & Latihan', weightPercent: 30, isActive: true },
      { id: 'comp-uts', schoolId: baseSchool.schoolId, name: 'Penilaian Tengah Semester', weightPercent: 30, isActive: true },
      { id: 'comp-uas', schoolId: baseSchool.schoolId, name: 'Penilaian Akhir Semester', weightPercent: 40, isActive: true },
    ],
    academicGrades: [],
    assignments: [],
    submissions: [],
    submissionHistory: [],
    notifications: [],
    auditLogs: [],
    announcements: [],
    ppdbRegistrations: [],
    surveys: [],
    surveyResponses: [],
    osisCandidates: [],
    osisVotes: [],
    guestbookEntries: [],
    attendanceRecords: [],
  };
}

export function createInitialDemoDataset(): SimsDataset {
  const school: School = {
    schoolId: DEFAULT_SCHOOL_ID,
    name: 'SMA Nusantara Cendekia',
    npsn: '20109988',
    address: 'Jl. Pendidikan Terpadu No. 45, Bandung',
    latitude: -6.917464,
    longitude: 107.619123,
    geofenceRadiusMeters: 250,
    allowedWifiLabel: 'SIMS-KAMPUS-5G',
    adminUid: 'u-admin-01',
    createdAt: '2026-11-01T07:00:00.000Z',
  };

  const schoolLocations: SchoolLocation[] = [
    {
      locationId: 'loc-gedung-utama',
      schoolId: DEFAULT_SCHOOL_ID,
      locationName: 'Gedung Utama Kampus',
      latitude: -6.917464,
      longitude: 107.619123,
      address: 'Jl. Pendidikan Terpadu No. 45, Bandung',
      radiusInMeters: 250,
      isActive: true,
      createdAt: '2026-11-01T07:00:00.000Z',
      updatedAt: '2026-11-18T09:00:00.000Z',
    },
    {
      locationId: 'loc-gedung-praktik',
      schoolId: DEFAULT_SCHOOL_ID,
      locationName: 'Gedung Laboratorium & Praktik',
      latitude: -6.91582,
      longitude: 107.62148,
      address: 'Jl. Taman Sari No. 18, Bandung (Area Lab Sains)',
      radiusInMeters: 150,
      isActive: true,
      createdAt: '2026-11-02T08:30:00.000Z',
      updatedAt: '2026-11-18T09:00:00.000Z',
    },
    {
      locationId: 'loc-gedung-cabang',
      schoolId: DEFAULT_SCHOOL_ID,
      locationName: 'Gedung Cabang Timur',
      latitude: -6.9219,
      longitude: 107.6321,
      address: 'Jl. Supratman No. 88, Bandung',
      radiusInMeters: 120,
      isActive: false,
      createdAt: '2026-11-05T10:00:00.000Z',
      updatedAt: '2026-11-18T09:00:00.000Z',
    },
  ];

  const users: UserAccount[] = [
    {
      uid: 'u-admin-01',
      schoolId: DEFAULT_SCHOOL_ID,
      name: 'Dewi Anggraini, S.Kom.',
      username: 'admin.dewi',
      usernameKey: 'admin.dewi',
      email: 'admin@smanusantara.sch.id',
      phoneNumber: '081122334400',
      role: 'school_admin',
      isActive: true,
      mustChangePassword: false,
      nisOrNip: '199308212019032009',
      jobTitle: 'Administrator Sekolah',
      createdAt: '2026-11-01T07:00:00.000Z',
      lastLoginAt: '2026-11-19T07:15:00.000Z',
    },
    {
      uid: 'u-kepsek-01',
      schoolId: DEFAULT_SCHOOL_ID,
      name: 'Dr. Hendra Wijaya, M.Pd.',
      username: 'hendra.kepsek',
      usernameKey: 'hendra.kepsek',
      email: 'kepsek@smanusantara.sch.id',
      phoneNumber: '081122334401',
      role: 'principal',
      isActive: true,
      mustChangePassword: false,
      nisOrNip: '197204121998021001',
      jobTitle: 'Kepala Sekolah',
      createdAt: '2026-11-01T07:05:00.000Z',
      firstLoginAt: '2026-11-02T07:30:00.000Z',
      lastLoginAt: '2026-11-19T07:00:00.000Z',
    },
    {
      uid: 'u-guru-01',
      schoolId: DEFAULT_SCHOOL_ID,
      name: 'Rina Kusuma, S.Pd.',
      username: 'rina.kusuma',
      usernameKey: 'rina.kusuma',
      email: 'rina.kusuma@smanusantara.sch.id',
      phoneNumber: '081122334402',
      role: 'teacher',
      isActive: true,
      mustChangePassword: false,
      nisOrNip: '198605182010012014',
      teachingSubjectIds: ['subj-mat', 'subj-inf'],
      teachingClassIds: ['cls-11-ipa-1'],
      isHomeroomTeacher: true,
      homeroomClassId: 'cls-11-ipa-1',
      createdAt: '2026-11-01T07:10:00.000Z',
      firstLoginAt: '2026-11-02T08:00:00.000Z',
      lastLoginAt: '2026-11-19T06:54:00.000Z',
    },
    {
      uid: 'u-guru-02',
      schoolId: DEFAULT_SCHOOL_ID,
      name: 'Bagus Pratama, M.Si.',
      username: 'bagus.pratama',
      usernameKey: 'bagus.pratama',
      email: 'bagus.pratama@smanusantara.sch.id',
      phoneNumber: '081122334403',
      role: 'teacher',
      isActive: true,
      mustChangePassword: true,
      nisOrNip: '198911032014021006',
      teachingSubjectIds: ['subj-fis', 'subj-ind'],
      teachingClassIds: ['cls-11-ipa-1', 'cls-10-ipa-1'],
      isHomeroomTeacher: true,
      homeroomClassId: 'cls-10-ipa-1',
      createdAt: '2026-11-01T07:12:00.000Z',
    },
    {
      uid: 'u-staff-01',
      schoolId: DEFAULT_SCHOOL_ID,
      name: 'Arif Budiman, A.Md.',
      username: 'arif.staff',
      usernameKey: 'arif.staff',
      email: 'arif.tu@smanusantara.sch.id',
      phoneNumber: '081122334404',
      role: 'staff',
      isActive: true,
      mustChangePassword: true,
      nisOrNip: '199105142020011003',
      jobTitle: 'Staf Tata Usaha',
      department: 'Administrasi & PPDB',
      createdAt: '2026-11-01T07:15:00.000Z',
    },
    {
      uid: 'u-siswa-01',
      schoolId: DEFAULT_SCHOOL_ID,
      name: 'Nadia Putri Rahmawati',
      username: 'nadia.putri',
      usernameKey: 'nadia.putri',
      email: 'nadia.putri@siswa.smanusantara.sch.id',
      phoneNumber: '081233445501',
      role: 'student',
      isActive: true,
      mustChangePassword: false,
      nisOrNip: '20250101',
      nis: '20250101',
      nisn: '0098112201',
      entryYear: '2025',
      parentPhone: '081344556601',
      classId: 'cls-11-ipa-1',
      createdAt: '2026-11-01T07:20:00.000Z',
      lastLoginAt: '2026-11-19T07:05:00.000Z',
    },
    {
      uid: 'u-siswa-02',
      schoolId: DEFAULT_SCHOOL_ID,
      name: 'Fajar Ramadhan',
      username: 'fajar.ramadhan',
      usernameKey: 'fajar.ramadhan',
      email: 'fajar.ramadhan@siswa.smanusantara.sch.id',
      phoneNumber: '081233445502',
      role: 'student',
      isActive: true,
      mustChangePassword: false,
      nisOrNip: '20250102',
      nis: '20250102',
      nisn: '0098112202',
      entryYear: '2025',
      parentPhone: '081344556602',
      classId: 'cls-11-ipa-1',
      createdAt: '2026-11-01T07:22:00.000Z',
    },
    {
      uid: 'u-siswa-03',
      schoolId: DEFAULT_SCHOOL_ID,
      name: 'Siti Aisyah Lestari',
      username: 'siti.aisyah',
      usernameKey: 'siti.aisyah',
      email: 'siti.aisyah@siswa.smanusantara.sch.id',
      phoneNumber: '081233445503',
      role: 'student',
      isActive: true,
      mustChangePassword: false,
      nisOrNip: '20250201',
      nis: '20250201',
      nisn: '0098112203',
      entryYear: '2025',
      parentPhone: '081344556603',
      classId: 'cls-10-ipa-1',
      createdAt: '2026-11-01T07:25:00.000Z',
    },
    {
      uid: 'u-ortu-01',
      schoolId: DEFAULT_SCHOOL_ID,
      name: 'Bambang Santoso (Wali Nadia)',
      username: 'bambang.ortu',
      usernameKey: 'bambang.ortu',
      email: 'bambang.santoso@gmail.com',
      phoneNumber: '081344556601',
      role: 'parent',
      isActive: true,
      mustChangePassword: false,
      relationshipType: 'Ayah',
      childStudentId: 'u-siswa-01',
      linkedStudentIds: ['u-siswa-01'],
      createdAt: '2026-11-01T07:30:00.000Z',
      lastLoginAt: '2026-11-18T19:00:00.000Z',
    },
  ];

  const parentStudentRelations: ParentStudentRelation[] = [
    {
      id: 'rel-u-ortu-01-u-siswa-01',
      schoolId: DEFAULT_SCHOOL_ID,
      parentUid: 'u-ortu-01',
      studentUid: 'u-siswa-01',
      relationship: 'Ayah',
      isPrimary: true,
      createdAt: '2026-11-01T07:30:00.000Z',
      createdBy: 'u-admin-01',
    },
  ];

  const importJobs: ImportJobRecord[] = [];

  const subjects: Subject[] = [
    { id: 'subj-mat', schoolId: DEFAULT_SCHOOL_ID, code: 'MAT-11', name: 'Matematika Lanjut', category: 'Wajib', kkm: 75 },
    { id: 'subj-fis', schoolId: DEFAULT_SCHOOL_ID, code: 'FIS-11', name: 'Fisika Terapan', category: 'Peminatan', kkm: 75 },
    { id: 'subj-ind', schoolId: DEFAULT_SCHOOL_ID, code: 'IND-10', name: 'Bahasa Indonesia', category: 'Wajib', kkm: 78 },
    { id: 'subj-inf', schoolId: DEFAULT_SCHOOL_ID, code: 'INF-11', name: 'Informatika', category: 'Peminatan', kkm: 76 },
  ];

  const curriculums: Curriculum[] = [
    {
      id: 'curr-2026-ganjil',
      schoolId: DEFAULT_SCHOOL_ID,
      name: 'Kurikulum Merdeka — Fase F & E',
      academicYear: '2026/2027',
      semester: 'Ganjil',
      isActive: true,
    },
    {
      id: 'curr-2025-genap',
      schoolId: DEFAULT_SCHOOL_ID,
      name: 'Kurikulum Merdeka — Periode Sebelumnya',
      academicYear: '2025/2026',
      semester: 'Genap',
      isActive: false,
    },
  ];

  const classes: SchoolClass[] = [
    {
      id: 'cls-11-ipa-1',
      schoolId: DEFAULT_SCHOOL_ID,
      name: 'XI IPA 1',
      gradeLevel: 'XI',
      homeroomTeacherId: 'u-guru-01',
      studentIds: ['u-siswa-01', 'u-siswa-02'],
    },
    {
      id: 'cls-10-ipa-1',
      schoolId: DEFAULT_SCHOOL_ID,
      name: 'X IPA 1',
      gradeLevel: 'X',
      homeroomTeacherId: 'u-guru-02',
      studentIds: ['u-siswa-03'],
    },
  ];

  const teachingAssignments: TeachingAssignment[] = [
    { id: 'ta-01', schoolId: DEFAULT_SCHOOL_ID, teacherId: 'u-guru-01', subjectId: 'subj-mat', classId: 'cls-11-ipa-1' },
    { id: 'ta-02', schoolId: DEFAULT_SCHOOL_ID, teacherId: 'u-guru-01', subjectId: 'subj-inf', classId: 'cls-11-ipa-1' },
    { id: 'ta-03', schoolId: DEFAULT_SCHOOL_ID, teacherId: 'u-guru-02', subjectId: 'subj-fis', classId: 'cls-11-ipa-1' },
    { id: 'ta-04', schoolId: DEFAULT_SCHOOL_ID, teacherId: 'u-guru-02', subjectId: 'subj-ind', classId: 'cls-10-ipa-1' },
  ];

  const schedules: ScheduleItem[] = [
    { id: 'sch-01', schoolId: DEFAULT_SCHOOL_ID, classId: 'cls-11-ipa-1', subjectId: 'subj-mat', teacherId: 'u-guru-01', day: 'Senin', startTime: '07:30', endTime: '09:00', room: 'R.201' },
    { id: 'sch-02', schoolId: DEFAULT_SCHOOL_ID, classId: 'cls-11-ipa-1', subjectId: 'subj-fis', teacherId: 'u-guru-02', day: 'Selasa', startTime: '09:15', endTime: '10:45', room: 'Lab Fisika' },
    { id: 'sch-03', schoolId: DEFAULT_SCHOOL_ID, classId: 'cls-11-ipa-1', subjectId: 'subj-inf', teacherId: 'u-guru-01', day: 'Rabu', startTime: '10:45', endTime: '12:15', room: 'Lab Komputer' },
    { id: 'sch-04', schoolId: DEFAULT_SCHOOL_ID, classId: 'cls-10-ipa-1', subjectId: 'subj-ind', teacherId: 'u-guru-02', day: 'Kamis', startTime: '07:30', endTime: '09:00', room: 'R.104' },
  ];

  const teachingAgendas: TeachingAgenda[] = [
    {
      id: 'ag-01',
      schoolId: DEFAULT_SCHOOL_ID,
      teacherId: 'u-guru-01',
      classId: 'cls-11-ipa-1',
      subjectId: 'subj-mat',
      date: '2026-11-18',
      topic: 'Turunan Fungsi Aljabar & Gradien Garis Singgung',
      notes: 'Seluruh siswa mengikuti latihan soal turunan orde pertama dan diskusi kelompok.',
      presentCount: 32,
    },
    {
      id: 'ag-02',
      schoolId: DEFAULT_SCHOOL_ID,
      teacherId: 'u-guru-02',
      classId: 'cls-11-ipa-1',
      subjectId: 'subj-fis',
      date: '2026-11-17',
      topic: 'Hukum Kekekalan Momentum dan Tumbukan Lenting',
      notes: 'Praktikum lintasan kereta dinamika berjalan lancar.',
      presentCount: 31,
    },
  ];

  const assessmentComponents: AssessmentComponent[] = [
    { id: 'comp-tugas', schoolId: DEFAULT_SCHOOL_ID, name: 'Tugas Mandiri & E-Tugas', weightPercent: 30, isActive: true },
    { id: 'comp-uh', schoolId: DEFAULT_SCHOOL_ID, name: 'Evaluasi Lingkup Materi', weightPercent: 30, isActive: true },
    { id: 'comp-praktik', schoolId: DEFAULT_SCHOOL_ID, name: 'Proyek & Praktikum', weightPercent: 20, isActive: true },
    { id: 'comp-sts', schoolId: DEFAULT_SCHOOL_ID, name: 'Asesmen Tengah Semester', weightPercent: 20, isActive: true },
  ];

  const academicGrades: AcademicGrade[] = [
    {
      id: 'grd-01',
      schoolId: DEFAULT_SCHOOL_ID,
      studentId: 'u-siswa-01',
      classId: 'cls-11-ipa-1',
      subjectId: 'subj-mat',
      teacherId: 'u-guru-01',
      scores: { 'comp-tugas': 90, 'comp-uh': 86, 'comp-praktik': 88, 'comp-sts': 85 },
      finalScore: 87.4,
      updatedAt: '2026-11-18T10:15:00.000Z',
    },
    {
      id: 'grd-02',
      schoolId: DEFAULT_SCHOOL_ID,
      studentId: 'u-siswa-02',
      classId: 'cls-11-ipa-1',
      subjectId: 'subj-mat',
      teacherId: 'u-guru-01',
      scores: { 'comp-tugas': 78, 'comp-uh': 74, 'comp-praktik': 80, 'comp-sts': 76 },
      finalScore: 76.8,
      updatedAt: '2026-11-18T10:20:00.000Z',
    },
    {
      id: 'grd-03',
      schoolId: DEFAULT_SCHOOL_ID,
      studentId: 'u-siswa-01',
      classId: 'cls-11-ipa-1',
      subjectId: 'subj-fis',
      teacherId: 'u-guru-02',
      scores: { 'comp-tugas': 88, 'comp-uh': 84, 'comp-praktik': 90, 'comp-sts': 82 },
      finalScore: 86.0,
      updatedAt: '2026-11-17T14:00:00.000Z',
    },
  ];

  const assignments: Assignment[] = [
    {
      id: 'asg-01',
      schoolId: DEFAULT_SCHOOL_ID,
      teacherId: 'u-guru-01',
      subjectId: 'subj-mat',
      classId: 'cls-11-ipa-1',
      title: 'Latihan Kalkulus Turunan & Aplikasi Segitiga',
      instructions:
        'Kerjakan soal nomor 1–5 pada buku tulis bergaris dengan langkah penyelesaian lengkap. Foto lembar jawaban dengan pencahayaan terang dan pastikan tulisan terbaca jelas.',
      assignedDate: '2026-11-15',
      dueDate: '2026-11-24T23:59',
      allowNumericScore: true,
      maxPhotos: 5,
      maxFileSizeMb: 5,
      attachmentName: 'Lembar_Soal_Turunan_Bab4.pdf',
      status: 'active',
      createdAt: '2026-11-15T08:00:00.000Z',
    },
    {
      id: 'asg-02',
      schoolId: DEFAULT_SCHOOL_ID,
      teacherId: 'u-guru-01',
      subjectId: 'subj-inf',
      classId: 'cls-11-ipa-1',
      title: 'Diagram Alir Algoritma Pencarian Biner',
      instructions:
        'Gambar diagram alir (flowchart) pencarian biner di kertas HVS atau buku catatan, lalu unggah foto hasil pekerjaan Anda.',
      assignedDate: '2026-11-16',
      dueDate: '2026-11-26T23:59',
      allowNumericScore: true,
      maxPhotos: 3,
      maxFileSizeMb: 5,
      attachmentName: 'Panduan_Simbol_Flowchart.png',
      status: 'active',
      createdAt: '2026-11-16T09:00:00.000Z',
    },
    {
      id: 'asg-03',
      schoolId: DEFAULT_SCHOOL_ID,
      teacherId: 'u-guru-02',
      subjectId: 'subj-fis',
      classId: 'cls-11-ipa-1',
      title: 'Laporan Sketsa Percobaan Momentum',
      instructions:
        'Foto tabel data hasil praktikum momentum beserta grafik vektor kecepatan sebelum dan sesudah tumbukan.',
      assignedDate: '2026-11-10',
      dueDate: '2026-11-18T17:00',
      allowNumericScore: true,
      maxPhotos: 4,
      maxFileSizeMb: 5,
      status: 'active',
      createdAt: '2026-11-10T08:00:00.000Z',
    },
  ];

  const sampleHomeworkUrl = '/src/assets/images/student_homework_sample_1795139324529.jpg';

  const submissions: AssignmentSubmission[] = [
    {
      id: 'sub-asg01-siswa01',
      schoolId: DEFAULT_SCHOOL_ID,
      assignmentId: 'asg-01',
      studentId: 'u-siswa-01',
      classId: 'cls-11-ipa-1',
      teacherId: 'u-guru-01',
      status: 'submitted',
      photoUrls: [sampleHomeworkUrl],
      studentNote: 'Sudah dikerjakan lengkap untuk soal nomor 1 sampai 5.',
      submittedAt: '2026-11-19T14:20:00.000Z',
      updatedAt: '2026-11-19T14:20:00.000Z',
    },
    {
      id: 'sub-asg01-siswa02',
      schoolId: DEFAULT_SCHOOL_ID,
      assignmentId: 'asg-01',
      studentId: 'u-siswa-02',
      classId: 'cls-11-ipa-1',
      teacherId: 'u-guru-01',
      status: 'revision_requested',
      photoUrls: [sampleHomeworkUrl],
      studentNote: 'Mohon koreksi Bu, ini hasil kerja saya.',
      teacherFeedback: 'Langkah perhitungan nomor 2 masih terpotong di sisi kanan foto. Mohon foto ulang seluruh halaman.',
      submittedAt: '2026-11-18T16:10:00.000Z',
      updatedAt: '2026-11-19T08:30:00.000Z',
    },
    {
      id: 'sub-asg03-siswa01',
      schoolId: DEFAULT_SCHOOL_ID,
      assignmentId: 'asg-03',
      studentId: 'u-siswa-01',
      classId: 'cls-11-ipa-1',
      teacherId: 'u-guru-02',
      status: 'approved',
      photoUrls: [sampleHomeworkUrl],
      studentNote: 'Laporan praktikum momentum terlampir.',
      teacherFeedback: 'Perhitungan vektor dan analisis tumbukan sangat rapi dan tepat.',
      score: 92,
      submittedAt: '2026-11-16T15:00:00.000Z',
      updatedAt: '2026-11-17T09:15:00.000Z',
    },
  ];

  const submissionHistory: SubmissionHistoryEntry[] = [
    {
      id: 'hist-01',
      schoolId: DEFAULT_SCHOOL_ID,
      submissionId: 'sub-asg01-siswa01',
      assignmentId: 'asg-01',
      studentId: 'u-siswa-01',
      version: 1,
      status: 'submitted',
      photoUrls: [sampleHomeworkUrl],
      actorRole: 'student',
      note: 'Sudah dikerjakan lengkap untuk soal nomor 1 sampai 5.',
      createdAt: '2026-11-19T14:20:00.000Z',
    },
    {
      id: 'hist-02',
      schoolId: DEFAULT_SCHOOL_ID,
      submissionId: 'sub-asg01-siswa02',
      assignmentId: 'asg-01',
      studentId: 'u-siswa-02',
      version: 1,
      status: 'submitted',
      photoUrls: [sampleHomeworkUrl],
      actorRole: 'student',
      note: 'Mohon koreksi Bu, ini hasil kerja saya.',
      createdAt: '2026-11-18T16:10:00.000Z',
    },
    {
      id: 'hist-03',
      schoolId: DEFAULT_SCHOOL_ID,
      submissionId: 'sub-asg01-siswa02',
      assignmentId: 'asg-01',
      studentId: 'u-siswa-02',
      version: 2,
      status: 'revision_requested',
      photoUrls: [sampleHomeworkUrl],
      actorRole: 'teacher',
      note: 'Langkah perhitungan nomor 2 masih terpotong di sisi kanan foto. Mohon foto ulang seluruh halaman.',
      createdAt: '2026-11-19T08:30:00.000Z',
    },
    {
      id: 'hist-04',
      schoolId: DEFAULT_SCHOOL_ID,
      submissionId: 'sub-asg03-siswa01',
      assignmentId: 'asg-03',
      studentId: 'u-siswa-01',
      version: 1,
      status: 'approved',
      photoUrls: [sampleHomeworkUrl],
      actorRole: 'teacher',
      note: 'Perhitungan vektor dan analisis tumbukan sangat rapi dan tepat.',
      score: 92,
      createdAt: '2026-11-17T09:15:00.000Z',
    },
  ];

  const notifications: AssignmentNotification[] = [
    {
      id: 'notif-01',
      schoolId: DEFAULT_SCHOOL_ID,
      recipientId: 'u-guru-01',
      eventType: 'submitted',
      title: 'Pengumpulan Tugas Baru',
      message: 'Nadia Putri Rahmawati mengumpulkan foto jawaban untuk Latihan Kalkulus Turunan.',
      read: false,
      createdAt: '2026-11-19T14:20:00.000Z',
    },
    {
      id: 'notif-02',
      schoolId: DEFAULT_SCHOOL_ID,
      recipientId: 'u-siswa-01',
      eventType: 'new_assignment',
      title: 'Tugas Baru: Diagram Alir Algoritma',
      message: 'Rina Kusuma, S.Pd. memberikan tugas baru di kelas XI IPA 1. Tenggat: 26 Nov 2026.',
      read: false,
      createdAt: '2026-11-16T09:05:00.000Z',
    },
    {
      id: 'notif-03',
      schoolId: DEFAULT_SCHOOL_ID,
      recipientId: 'u-siswa-01',
      eventType: 'approved',
      title: 'Tugas Disetujui & Dinilai (92)',
      message: 'Bagus Pratama, M.Si. menyetujui Laporan Sketsa Percobaan Momentum.',
      read: true,
      createdAt: '2026-11-17T09:16:00.000Z',
    },
    {
      id: 'notif-04',
      schoolId: DEFAULT_SCHOOL_ID,
      recipientId: 'u-siswa-02',
      eventType: 'revision_requested',
      title: 'Permintaan Revisi Jawaban',
      message: 'Rina Kusuma, S.Pd. meminta revisi pada Latihan Kalkulus Turunan.',
      read: false,
      createdAt: '2026-11-19T08:30:00.000Z',
    },
  ];

  const auditLogs: AuditLogEntry[] = [
    {
      id: 'log-01',
      schoolId: DEFAULT_SCHOOL_ID,
      actorId: 'u-guru-01',
      actorName: 'Rina Kusuma, S.Pd.',
      actorRole: 'teacher',
      module: 'akademik',
      action: 'UPDATE_GRADE',
      targetId: 'grd-01',
      summary: 'Perubahan nilai Matematika Lanjut untuk Nadia Putri Rahmawati: 85.0 → 87.4',
      createdAt: '2026-11-18T10:15:00.000Z',
    },
    {
      id: 'log-02',
      schoolId: DEFAULT_SCHOOL_ID,
      actorId: 'u-guru-01',
      actorName: 'Rina Kusuma, S.Pd.',
      actorRole: 'teacher',
      module: 'e_tugas',
      action: 'REQUEST_REVISION',
      targetId: 'sub-asg01-siswa02',
      summary: 'Meminta revisi tugas Latihan Kalkulus Turunan milik Fajar Ramadhan',
      createdAt: '2026-11-19T08:30:00.000Z',
    },
    {
      id: 'log-03',
      schoolId: DEFAULT_SCHOOL_ID,
      actorId: 'u-guru-02',
      actorName: 'Bagus Pratama, M.Si.',
      actorRole: 'teacher',
      module: 'e_tugas',
      action: 'APPROVE_SUBMISSION',
      targetId: 'sub-asg03-siswa01',
      summary: 'Menyetujui tugas Laporan Sketsa Percobaan Momentum (Nilai: 92)',
      createdAt: '2026-11-17T09:15:00.000Z',
    },
  ];

  const announcements: SchoolAnnouncement[] = [
    {
      id: 'ann-01',
      schoolId: DEFAULT_SCHOOL_ID,
      title: 'Penerimaan Peserta Didik Baru (PPDB) Gelombang I Tahun Ajaran 2027/2028',
      category: 'PPDB',
      publishedAt: '2026-11-15',
      authorName: 'Panitia PPDB Sekolah',
      excerpt: 'Pendaftaran jalur Zonasi, Prestasi, dan Afirmasi kini dibuka secara daring melalui portal SIMS.',
      content: 'Calon peserta didik dapat mendaftar dengan menyiapkan NISN, nilai rata-rata semester terakhir, dan memilih jalur seleksi yang sesuai.',
    },
    {
      id: 'ann-02',
      schoolId: DEFAULT_SCHOOL_ID,
      title: 'Pemilihan Ketua dan Wakil Ketua OSIS Periode 2026/2027',
      category: 'Kegiatan',
      publishedAt: '2026-11-18',
      authorName: 'Pembina OSIS',
      excerpt: 'Seluruh siswa aktif berhak memberikan 1 suara secara daring melalui fitur E-Voting OSIS.',
      content: 'Gunakan akun siswa masing-masing untuk membaca visi dan misi kandidat sebelum memberikan suara.',
    },
  ];

  const ppdbRegistrations: PpdbRegistration[] = [
    {
      id: 'ppdb-01',
      schoolId: DEFAULT_SCHOOL_ID,
      registrationCode: 'PPDB-2026-001',
      applicantName: 'Rafi Akbar Pratama',
      nisn: '0098123456',
      track: 'Prestasi',
      previousSchool: 'SMP Negeri 2 Bandung',
      parentPhone: '081234567890',
      averageScore: 91.4,
      status: 'terverifikasi',
      createdAt: '2026-11-16T09:12:00.000Z',
    },
    {
      id: 'ppdb-02',
      schoolId: DEFAULT_SCHOOL_ID,
      registrationCode: 'PPDB-2026-002',
      applicantName: 'Alya Zahra Putri',
      nisn: '0098654321',
      track: 'Zonasi',
      previousSchool: 'SMP Negeri 5 Bandung',
      parentPhone: '081398765432',
      averageScore: 86.2,
      status: 'menunggu',
      createdAt: '2026-11-18T11:45:00.000Z',
    },
  ];

  const surveys: Survey[] = [
    {
      id: 'srv-01',
      schoolId: DEFAULT_SCHOOL_ID,
      title: 'Survei Kepuasan Layanan Akademik & E-Tugas Semester Ganjil',
      description: 'Masukan siswa dan orang tua terhadap efektivitas jadwal, materi ajar, dan pengumpulan tugas foto.',
      targetAudience: 'Siswa & Orang Tua',
      isActive: true,
      questions: [
        { id: 'q1', text: 'Kejelasan instruksi tugas online dan jadwal pengumpulan' },
        { id: 'q2', text: 'Kecepatan umpan balik dan verifikasi tugas oleh guru' },
        { id: 'q3', text: 'Kenyamanan akses portal SIMS pada perangkat seluler maupun desktop' },
      ],
    },
  ];

  const surveyResponses: SurveyResponse[] = [
    {
      id: 'sr-01',
      schoolId: DEFAULT_SCHOOL_ID,
      surveyId: 'srv-01',
      respondentId: 'u-ortu-01',
      ratings: { q1: 5, q2: 4, q3: 5 },
      comment: 'Sangat terbantu memantau perkembangan tugas anak setiap minggu.',
      submittedAt: '2026-11-18T19:00:00.000Z',
    },
  ];

  const osisCandidates: OsisCandidate[] = [
    {
      id: 'cand-01',
      schoolId: DEFAULT_SCHOOL_ID,
      number: 1,
      chairName: 'Kezia Maharani',
      viceName: 'Dimas Aditya',
      classLabel: 'XI IPA 1',
      vision: 'Mewujudkan OSIS yang kolaboratif, peduli literasi digital, dan ramah lingkungan.',
      mission: [
        'Mengadakan klinik belajar sebaya dan bank catatan materi lintas angkatan.',
        'Program Jumat Bersih dan pengurangan plastik sekali pakai di kantin sekolah.',
      ],
      photoUrl: '/src/assets/images/osis_candidate_one_1795139325859.jpg',
    },
    {
      id: 'cand-02',
      schoolId: DEFAULT_SCHOOL_ID,
      number: 2,
      chairName: 'Nabila Khairunnisa',
      viceName: 'Raka Mahendra',
      classLabel: 'XI IPA 2',
      vision: 'Membangun ekosistem ekstrakurikuler aktif, inklusif, dan berprestasi di tingkat kota.',
      mission: [
        'Digitalisasi pendaftaran dan jadwal kegiatan ekstrakurikuler sekolah.',
        'Menyelenggarakan festival seni, olahraga, dan sains tahunan antar kelas.',
      ],
      photoUrl: '/src/assets/images/osis_candidate_two_1795139323918.jpg',
    },
  ];

  const osisVotes: OsisVote[] = [
    {
      id: `${DEFAULT_SCHOOL_ID}_u-siswa-02`,
      schoolId: DEFAULT_SCHOOL_ID,
      voterId: 'u-siswa-02',
      candidateId: 'cand-01',
      votedAt: '2026-11-18T12:15:00.000Z',
    },
    {
      id: `${DEFAULT_SCHOOL_ID}_u-siswa-03`,
      schoolId: DEFAULT_SCHOOL_ID,
      voterId: 'u-siswa-03',
      candidateId: 'cand-02',
      votedAt: '2026-11-18T13:10:00.000Z',
    },
  ];

  const guestbookEntries: GuestbookEntry[] = [
    {
      id: 'gb-01',
      schoolId: DEFAULT_SCHOOL_ID,
      visitorName: 'Ir. Suryanto Hadi',
      institution: 'Dinas Pendidikan Provinsi',
      purpose: 'Monitoring implementasi Kurikulum Merdeka & agenda ajar',
      hostName: 'Dr. Hendra Wijaya, M.Pd.',
      checkInAt: '2026-11-19T09:10:00.000Z',
      checkOutAt: '2026-11-19T11:30:00.000Z',
      status: 'selesai',
    },
    {
      id: 'gb-02',
      schoolId: DEFAULT_SCHOOL_ID,
      visitorName: 'Ratna Permatasari',
      institution: 'Orang Tua Siswa (XI IPA 1)',
      purpose: 'Konsultasi perkembangan akademik dengan Wali Kelas',
      hostName: 'Rina Kusuma, S.Pd.',
      checkInAt: '2026-11-19T13:45:00.000Z',
      status: 'bertamu',
    },
  ];

  const attendanceRecords: AttendanceRecord[] = [
    {
      id: 'att-01',
      schoolId: DEFAULT_SCHOOL_ID,
      userId: 'u-guru-01',
      userName: 'Rina Kusuma, S.Pd.',
      role: 'teacher',
      date: '2026-11-19',
      checkInTime: '06:54 WIB',
      distanceMeters: 42,
      networkLabel: 'SIMS-KAMPUS-5G',
      gpsValid: true,
      networkValid: true,
      faceVerified: true,
      userLat: -6.9172,
      userLon: 107.6193,
      gpsAccuracyMeters: 12,
      matchedLocationId: 'loc-gedung-utama',
      matchedLocationName: 'Gedung Utama Kampus',
      gpsAnomalyFlag: false,
      locationCapturedAt: '2026-11-19T06:54:00.000Z',
      syncSource: 'online',
    },
    {
      id: 'att-02',
      schoolId: DEFAULT_SCHOOL_ID,
      userId: 'u-siswa-01',
      userName: 'Nadia Putri Rahmawati',
      role: 'student',
      date: '2026-11-19',
      checkInTime: '07:05 WIB',
      distanceMeters: 78,
      networkLabel: 'SIMS-KAMPUS-5G',
      gpsValid: true,
      networkValid: true,
      faceVerified: true,
      userLat: -6.9154,
      userLon: 107.6211,
      gpsAccuracyMeters: 18,
      matchedLocationId: 'loc-gedung-praktik',
      matchedLocationName: 'Gedung Laboratorium & Praktik',
      gpsAnomalyFlag: false,
      locationCapturedAt: '2026-11-19T07:05:00.000Z',
      syncSource: 'online',
    },
  ];

  return {
    school,
    schoolLocations,
    users,
    parentStudentRelations,
    importJobs,
    subjects,
    curriculums,
    classes,
    teachingAssignments,
    schedules,
    teachingAgendas,
    assessmentComponents,
    academicGrades,
    assignments,
    submissions,
    submissionHistory,
    notifications,
    auditLogs,
    announcements,
    ppdbRegistrations,
    surveys,
    surveyResponses,
    osisCandidates,
    osisVotes,
    guestbookEntries,
    attendanceRecords,
  };
}
