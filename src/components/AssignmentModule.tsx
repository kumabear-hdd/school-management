import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  Camera,
  Check,
  CheckCircle2,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  History,
  ImagePlus,
  Plus,
  RotateCw,
  Send,
  Trash2,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useSims } from '../context/SimsContext';
import {
  categorizeAssignmentForStudent,
  computeAssignmentRecapStats,
  validatePhotoSubmission,
} from '../utils/assignmentLogic';
import { canTeacherManageSubjectClass } from '../utils/academicLogic';
import { compressPhotoFile, formatBytes } from '../utils/photoCompressor';
import {
  exportAssignmentRecapToExcel,
  exportAssignmentRecapToPdf,
} from '../utils/exportUtils';
import type { Assignment, AssignmentSubmission, StudentTaskCategory } from '../types/sims';

type ETugasTab = 'daftar_siswa' | 'kelola_guru' | 'verifikasi_guru' | 'rekap_ekspor';

interface PreparedPhoto {
  id: string;
  name: string;
  type: string;
  originalBytes: number;
  compressedBytes: number;
  dataUrl: string;
  blob: Blob;
}

const CATEGORY_LABELS: Record<StudentTaskCategory, string> = {
  belum_dikerjakan: 'Belum dikerjakan',
  sedang_dikerjakan: 'Sedang dikerjakan',
  menunggu_verifikasi: 'Menunggu verifikasi',
  perlu_revisi: 'Perlu revisi',
  sudah_diterima: 'Sudah diterima',
  terlambat: 'Terlambat',
};

const STATUS_LABELS: Record<string, string> = {
  assigned: 'Belum dikerjakan',
  submitted: 'Menunggu verifikasi',
  revision_requested: 'Perlu revisi',
  resubmitted: 'Menunggu verifikasi (Revisi)',
  approved: 'Sudah diterima',
  late: 'Terlambat',
};

export const AssignmentModule: React.FC = () => {
  const {
    data,
    currentUser,
    createAssignment,
    updateAssignment,
    deleteAssignment,
    submitAssignmentPhotos,
    verifyAssignmentSubmission,
  } = useSims();

  const isStudentOrParent =
    currentUser.role === 'student' || currentUser.role === 'parent';

  const [tab, setTab] = useState<ETugasTab>(
    isStudentOrParent ? 'daftar_siswa' : 'verifikasi_guru'
  );

  useEffect(() => {
    if (isStudentOrParent) {
      setTab('daftar_siswa');
    } else if (tab === 'daftar_siswa') {
      setTab('verifikasi_guru');
    }
  }, [isStudentOrParent]);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Student filters & draft work tracking
  const [studentCategory, setStudentCategory] = useState<'all' | StudentTaskCategory>('all');
  const [workingDraftIds, setWorkingDraftIds] = useState<Record<string, boolean>>({});
  const [selectedStudentAssignmentId, setSelectedStudentAssignmentId] = useState<string>(
    data.assignments[0]?.id || ''
  );
  const [preparedPhotos, setPreparedPhotos] = useState<PreparedPhoto[]>([]);
  const [studentNote, setStudentNote] = useState('');
  const [photoErrors, setPhotoErrors] = useState<string[]>([]);
  const [isCompressing, setIsCompressing] = useState(false);

  // Live Camera Modal state for smartphone/desktop capture
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Teacher Create Assignment form
  const myTeachingAssignments = data.teachingAssignments.filter((ta) =>
    currentUser.role === 'teacher' ? ta.teacherId === currentUser.uid : true
  );
  const [newTitle, setNewTitle] = useState('');
  const [newInstructions, setNewInstructions] = useState('');
  const [newSubjectId, setNewSubjectId] = useState(
    myTeachingAssignments[0]?.subjectId || data.subjects[0]?.id || ''
  );
  const [newClassId, setNewClassId] = useState(
    myTeachingAssignments[0]?.classId || data.classes[0]?.id || ''
  );
  const [newAssignedDate, setNewAssignedDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [newDueDate, setNewDueDate] = useState('2026-11-28T23:59');
  const [newAttachmentName, setNewAttachmentName] = useState('');
  const [newAllowScore, setNewAllowScore] = useState(true);
  const [newMaxPhotos, setNewMaxPhotos] = useState(5);
  const [newMaxFileMb, setNewMaxFileMb] = useState(5);

  // Teacher Verification Viewer state
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string>(
    data.submissions[0]?.id || ''
  );
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotationDeg, setRotationDeg] = useState(0);
  const [verifyFeedback, setVerifyFeedback] = useState('');
  const [verifyScore, setVerifyScore] = useState<string>('90');
  const [compareHistoryIndex, setCompareHistoryIndex] = useState<number | null>(null);

  // Recap Filters
  const [recapClassId, setRecapClassId] = useState('all');
  const [recapSubjectId, setRecapSubjectId] = useState('all');
  const [recapAssignmentId, setRecapAssignmentId] = useState('all');
  const [recapStart, setRecapStart] = useState('');
  const [recapEnd, setRecapEnd] = useState('');

  const parentChildIds =
    currentUser.role === 'parent'
      ? currentUser.linkedStudentIds?.length
        ? currentUser.linkedStudentIds
        : currentUser.childStudentId
        ? [currentUser.childStudentId]
        : []
      : [];
  const [selectedChildId, setSelectedChildId] = useState<string>(parentChildIds[0] || '');

  useEffect(() => {
    if (parentChildIds.length > 0 && !parentChildIds.includes(selectedChildId)) {
      setSelectedChildId(parentChildIds[0]);
    }
  }, [currentUser.uid, currentUser.role]);

  const effectiveStudent =
    currentUser.role === 'parent'
      ? data.users.find((u) => u.uid === (selectedChildId || parentChildIds[0])) || currentUser
      : currentUser;

  const studentAssignments = useMemo(() => {
    const nowIso = new Date().toISOString();
    return data.assignments
      .filter((a) => {
        if (currentUser.role === 'student' || currentUser.role === 'parent') {
          return a.classId === effectiveStudent.classId && a.status === 'active';
        }
        return true;
      })
      .map((a) => {
        const sub = data.submissions.find(
          (s) => s.assignmentId === a.id && s.studentId === effectiveStudent.uid
        );
        const category = categorizeAssignmentForStudent(
          a,
          sub,
          !!workingDraftIds[a.id],
          nowIso
        );
        return { assignment: a, submission: sub, category };
      });
  }, [data.assignments, data.submissions, currentUser.role, effectiveStudent, workingDraftIds]);

  const filteredStudentAssignments = studentAssignments.filter(
    (item) => studentCategory === 'all' || item.category === studentCategory
  );

  const selectedStudentItem =
    studentAssignments.find((item) => item.assignment.id === selectedStudentAssignmentId) ||
    studentAssignments[0];

  const handleFilesSelected = async (
    fileList: FileList | null,
    assignment: Assignment
  ) => {
    if (!fileList || fileList.length === 0) return;
    setPhotoErrors([]);
    const filesArr = Array.from(fileList);

    const validation = validatePhotoSubmission({
      files: [
        ...preparedPhotos.map((p) => ({
          name: p.name,
          type: p.type,
          sizeBytes: p.originalBytes,
        })),
        ...filesArr.map((f) => ({
          name: f.name,
          type: f.type,
          sizeBytes: f.size,
        })),
      ],
      assignment,
      studentClassId: effectiveStudent.classId,
      studentSchoolId: data.school.schoolId,
    });

    if (!validation.valid) {
      setPhotoErrors(validation.errors);
      return;
    }

    setIsCompressing(true);
    try {
      const compressedList: PreparedPhoto[] = [];
      for (const file of filesArr) {
        const res = await compressPhotoFile(file);
        compressedList.push({
          id: `ph-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: file.name,
          type: res.mimeType,
          originalBytes: res.originalBytes,
          compressedBytes: res.compressedBytes,
          dataUrl: res.dataUrl,
          blob: res.blob,
        });
      }
      setPreparedPhotos((prev) => [...prev, ...compressedList]);
      setWorkingDraftIds((prev) => ({ ...prev, [assignment.id]: true }));
    } catch (err) {
      setPhotoErrors([
        err instanceof Error ? err.message : 'Gagal memproses foto.',
      ]);
    } finally {
      setIsCompressing(false);
    }
  };

  const openCamera = async () => {
    setCameraError(null);
    setCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      setCameraError(
        'Kamera perangkat tidak terdeteksi atau izin ditolak. Anda tetap dapat mengunggah foto dari galeri atau menggunakan tombol simulasi foto.'
      );
    }
  };

  const closeCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraOpen(false);
  };

  const captureFromCamera = async (assignment: Assignment) => {
    const video = videoRef.current;
    if (video && video.videoWidth > 0) {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, 'image/jpeg', 0.8)
        );
        if (blob) {
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          setPreparedPhotos((prev) => [
            ...prev,
            {
              id: `cam-${Date.now()}`,
              name: `kamera_${Date.now()}.jpg`,
              type: 'image/jpeg',
              originalBytes: blob.size,
              compressedBytes: blob.size,
              dataUrl,
              blob,
            },
          ]);
          setWorkingDraftIds((prev) => ({ ...prev, [assignment.id]: true }));
          closeCamera();
          return;
        }
      }
    }
    // Fallback deterministic capture when webcam hardware isn't present
    const sampleUrl = '/src/assets/images/student_homework_sample_1795139324529.jpg';
    const resp = await fetch(sampleUrl);
    const blob = await resp.blob();
    setPreparedPhotos((prev) => [
      ...prev,
      {
        id: `cam-${Date.now()}`,
        name: `foto_kamera_${Date.now()}.jpg`,
        type: 'image/jpeg',
        originalBytes: blob.size,
        compressedBytes: blob.size,
        dataUrl: sampleUrl,
        blob,
      },
    ]);
    setWorkingDraftIds((prev) => ({ ...prev, [assignment.id]: true }));
    closeCamera();
  };

  const handleSubmitPhotos = async (assignment: Assignment) => {
    const validation = validatePhotoSubmission({
      files: preparedPhotos.map((p) => ({
        name: p.name,
        type: p.type,
        sizeBytes: p.compressedBytes,
      })),
      assignment,
      studentClassId: effectiveStudent.classId,
      studentSchoolId: data.school.schoolId,
    });
    if (!validation.valid) {
      setPhotoErrors(validation.errors);
      return;
    }

    const res = await submitAssignmentPhotos({
      assignmentId: assignment.id,
      photoDataUrls: preparedPhotos.map((p) => p.dataUrl),
      photoBlobs: preparedPhotos.map((p) => ({ blob: p.blob, name: p.name })),
      studentNote,
    });
    if (!res.ok) {
      setFeedback({ type: 'err', text: res.error || 'Gagal mengirim jawaban.' });
    } else {
      setPreparedPhotos([]);
      setStudentNote('');
      setPhotoErrors([]);
      setFeedback({
        type: 'ok',
        text: 'Jawaban foto berhasil dikirim dan tercatat di riwayat pengumpulan.',
      });
    }
  };

  // Teacher submissions filtered by ownership
  const teacherSubmissions = data.submissions.filter((sub) =>
    currentUser.role === 'teacher' ? sub.teacherId === currentUser.uid : true
  );
  const activeSubmission: AssignmentSubmission | undefined =
    teacherSubmissions.find((s) => s.id === selectedSubmissionId) ||
    teacherSubmissions[0];
  const activeSubmissionAssignment = activeSubmission
    ? data.assignments.find((a) => a.id === activeSubmission.assignmentId)
    : undefined;
  const activeSubmissionHistory = activeSubmission
    ? data.submissionHistory
        .filter((h) => h.submissionId === activeSubmission.id)
        .sort((a, b) => b.version - a.version)
    : [];

  const recapStats = computeAssignmentRecapStats({
    assignments: data.assignments,
    submissions: data.submissions,
    classes: data.classes,
    classIdFilter: recapClassId,
    subjectIdFilter: recapSubjectId,
    assignmentIdFilter: recapAssignmentId,
    periodStart: recapStart || undefined,
    periodEnd: recapEnd || undefined,
  });

  const buildRecapExportRows = () => {
    const rows: {
      assignmentTitle: string;
      subjectName: string;
      className: string;
      studentName: string;
      statusLabel: string;
      submittedAt: string;
      scoreLabel: string;
    }[] = [];
    for (const asg of data.assignments) {
      if (recapClassId !== 'all' && asg.classId !== recapClassId) continue;
      if (recapSubjectId !== 'all' && asg.subjectId !== recapSubjectId) continue;
      if (recapAssignmentId !== 'all' && asg.id !== recapAssignmentId) continue;
      const cls = data.classes.find((c) => c.id === asg.classId);
      const subj = data.subjects.find((s) => s.id === asg.subjectId);
      for (const sid of cls?.studentIds || []) {
        const stu = data.users.find((u) => u.uid === sid);
        const sub = data.submissions.find(
          (s) => s.assignmentId === asg.id && s.studentId === sid
        );
        rows.push({
          assignmentTitle: asg.title,
          subjectName: subj?.name || asg.subjectId,
          className: cls?.name || asg.classId,
          studentName: stu?.name || sid,
          statusLabel: sub ? STATUS_LABELS[sub.status] || sub.status : 'Belum dikerjakan',
          submittedAt: sub?.submittedAt ? sub.submittedAt.slice(0, 16).replace('T', ' ') : '-',
          scoreLabel: sub?.score !== undefined ? String(sub.score) : '-',
        });
      }
    }
    return rows;
  };

  return (
    <div className="space-y-6">
      {/* Header & Tabs */}
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Modul Tugas Online (E-Tugas) Berbasis Foto
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Pengelolaan tugas mandiri, unggah foto hasil pekerjaan siswa, verifikasi guru, permintaan revisi, dan riwayat pengumpulan.
          </p>
          {currentUser.role === 'parent' && parentChildIds.length > 1 && (
            <div className="mt-2 flex items-center gap-2">
              <label htmlFor="etugas-child-select" className="text-xs font-medium text-slate-600">
                Memantau Siswa:
              </label>
              <select
                id="etugas-child-select"
                value={effectiveStudent.uid}
                onChange={(e) => setSelectedChildId(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium"
              >
                {parentChildIds.map((cid) => {
                  const child = data.users.find((u) => u.uid === cid);
                  return (
                    <option key={cid} value={cid}>
                      {child?.name || cid}
                    </option>
                  );
                })}
              </select>
            </div>
          )}
        </div>
        <div
          role="tablist"
          aria-label="Navigasi Modul E-Tugas"
          className="inline-flex w-fit max-w-full overflow-x-auto items-center gap-1 rounded-lg bg-slate-100 p-1"
        >
          {(isStudentOrParent
            ? ([['daftar_siswa', 'Daftar Tugas & Kumpul Foto']] as [ETugasTab, string][])
            : ([
                ['verifikasi_guru', 'Verifikasi Foto'],
                ['kelola_guru', 'Kelola Tugas'],
                ['rekap_ekspor', 'Rekap & Ekspor'],
                ['daftar_siswa', 'Pratinjau Siswa'],
              ] as [ETugasTab, string][])
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => {
                setTab(key);
                setFeedback(null);
              }}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                tab === key
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {feedback && (
        <div
          role="alert"
          className={`rounded-lg border px-4 py-3 text-sm ${
            feedback.type === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-red-200 bg-red-50 text-red-900'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* VIEW 1: DASHBOARD TUGAS SISWA & PENGUMPULAN FOTO */}
      {tab === 'daftar_siswa' && (
        <div className="space-y-4">
          {/* Category Filter Bar */}
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-3">
            {(
              [
                ['all', 'Semua Tugas'],
                ['belum_dikerjakan', 'Belum dikerjakan'],
                ['sedang_dikerjakan', 'Sedang dikerjakan'],
                ['menunggu_verifikasi', 'Menunggu verifikasi'],
                ['perlu_revisi', 'Perlu revisi'],
                ['sudah_diterima', 'Sudah diterima'],
                ['terlambat', 'Terlambat'],
              ] as ['all' | StudentTaskCategory, string][]
            ).map(([catKey, catLabel]) => (
              <button
                key={catKey}
                type="button"
                onClick={() => setStudentCategory(catKey)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  studentCategory === catKey
                    ? 'bg-[#0F4C81] text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {catLabel}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Task List */}
            <div className="space-y-3 lg:col-span-5">
              {filteredStudentAssignments.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
                  Tidak ada tugas pada kategori ini.
                </div>
              ) : (
                filteredStudentAssignments.map(({ assignment, submission, category }) => {
                  const subj = data.subjects.find((s) => s.id === assignment.subjectId);
                  const teacher = data.users.find((u) => u.uid === assignment.teacherId);
                  const isSelected = selectedStudentItem?.assignment.id === assignment.id;
                  return (
                    <button
                      key={assignment.id}
                      type="button"
                      onClick={() => {
                        setSelectedStudentAssignmentId(assignment.id);
                        setPreparedPhotos([]);
                        setPhotoErrors([]);
                      }}
                      className={`w-full rounded-xl border p-4 text-left transition-colors ${
                        isSelected
                          ? 'border-[#0F4C81] bg-sky-50/40'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-900">
                          {assignment.title}
                        </p>
                        <span
                          className={`shrink-0 text-xs font-semibold ${
                            category === 'sudah_diterima'
                              ? 'text-emerald-700'
                              : category === 'perlu_revisi' || category === 'terlambat'
                              ? 'text-amber-700'
                              : 'text-slate-600'
                          }`}
                        >
                          {CATEGORY_LABELS[category]}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {subj?.name} · {teacher?.name}
                      </p>
                      <p className="mt-2 text-xs font-mono text-slate-600 tabular-nums">
                        Diberikan: {assignment.assignedDate} · Tenggat:{' '}
                        {assignment.dueDate.replace('T', ' ')}
                      </p>
                      {submission?.score !== undefined && (
                        <p className="mt-1 text-xs font-semibold text-emerald-700 tabular-nums">
                          Nilai Tugas: {submission.score}
                        </p>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {/* Selected Assignment Detail + Photo Submission */}
            <div className="lg:col-span-7">
              {selectedStudentItem ? (
                <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
                  <div>
                    <p className="text-xs font-medium text-slate-500">
                      {
                        data.subjects.find(
                          (s) => s.id === selectedStudentItem.assignment.subjectId
                        )?.name
                      }{' '}
                      · Pengampu:{' '}
                      {
                        data.users.find(
                          (u) => u.uid === selectedStudentItem.assignment.teacherId
                        )?.name
                      }{' '}
                      · Status: {CATEGORY_LABELS[selectedStudentItem.category]}
                    </p>
                    <h2 className="mt-1 text-lg font-bold text-slate-900">
                      {selectedStudentItem.assignment.title}
                    </h2>
                    <p className="mt-2 text-sm text-slate-700 leading-relaxed">
                      {selectedStudentItem.assignment.instructions}
                    </p>
                    {selectedStudentItem.assignment.attachmentName && (
                      <div className="mt-3 flex items-center gap-2 text-xs text-[#0F4C81] font-medium">
                        <FileText className="h-4 w-4" aria-hidden="true" />
                        <span>Lampiran: {selectedStudentItem.assignment.attachmentName}</span>
                      </div>
                    )}
                  </div>

                  {/* Teacher revision feedback if any */}
                  {selectedStudentItem.submission?.teacherFeedback && (
                    <div
                      className={`rounded-lg border p-4 text-sm ${
                        selectedStudentItem.submission.status === 'revision_requested'
                          ? 'border-amber-300 bg-amber-50 text-amber-950'
                          : 'border-emerald-200 bg-emerald-50 text-emerald-950'
                      }`}
                    >
                      <p className="font-semibold">
                        {selectedStudentItem.submission.status === 'revision_requested'
                          ? 'Catatan Revisi dari Guru'
                          : 'Komentar Akhir Guru'}
                      </p>
                      <p className="mt-1">
                        {selectedStudentItem.submission.teacherFeedback}
                      </p>
                    </div>
                  )}

                  {/* Photo upload area for Student (only when not approved and user is student) */}
                  {currentUser.role === 'student' &&
                    selectedStudentItem.submission?.status !== 'approved' && (
                      <div className="border-t border-slate-100 pt-5 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <h3 className="text-sm font-semibold text-slate-900">
                              {selectedStudentItem.submission?.status === 'revision_requested'
                                ? 'Kirim Ulang Foto Jawaban (Revisi)'
                                : 'Kumpulkan Jawaban Berbasis Foto'}
                            </h3>
                            <p className="text-xs text-slate-500">
                              Format JPG, JPEG, PNG, WEBP · Maks{' '}
                              {selectedStudentItem.assignment.maxPhotos} foto · Batas{' '}
                              {selectedStudentItem.assignment.maxFileSizeMb} MB/foto (otomatis dikompres)
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                              <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
                              Pilih dari Galeri
                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                multiple
                                className="sr-only"
                                onChange={(e) =>
                                  handleFilesSelected(
                                    e.target.files,
                                    selectedStudentItem.assignment
                                  )
                                }
                              />
                            </label>
                            <button
                              type="button"
                              onClick={openCamera}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              <Camera className="h-3.5 w-3.5" aria-hidden="true" />
                              Ambil Foto Kamera
                            </button>
                          </div>
                        </div>

                        {photoErrors.length > 0 && (
                          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800 space-y-1">
                            {photoErrors.map((err, idx) => (
                              <p key={idx}>{err}</p>
                            ))}
                          </div>
                        )}

                        {isCompressing && (
                          <p className="text-xs text-slate-600">
                            Mengompresi foto sebelum pratinjau...
                          </p>
                        )}

                        {preparedPhotos.length > 0 && (
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            {preparedPhotos.map((ph) => (
                              <div
                                key={ph.id}
                                className="rounded-lg border border-slate-200 p-2.5 space-y-2"
                              >
                                <img
                                  src={ph.dataUrl}
                                  alt={ph.name}
                                  referrerPolicy="no-referrer"
                                  className="h-40 w-full rounded object-cover bg-slate-100"
                                />
                                <div className="flex items-center justify-between gap-2 text-xs">
                                  <span className="truncate text-slate-600">
                                    {ph.name} ({formatBytes(ph.compressedBytes)})
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setPreparedPhotos((prev) =>
                                        prev.filter((item) => item.id !== ph.id)
                                      )
                                    }
                                    aria-label={`Hapus foto ${ph.name}`}
                                    className="text-red-600 hover:text-red-800"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        <div>
                          <label
                            htmlFor="student-note"
                            className="block text-xs font-medium text-slate-700"
                          >
                            Catatan Pengumpulan (Opsional)
                          </label>
                          <textarea
                            id="student-note"
                            rows={2}
                            value={studentNote}
                            onChange={(e) => setStudentNote(e.target.value)}
                            placeholder="Tambahkan keterangan halaman atau catatan untuk guru..."
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => handleSubmitPhotos(selectedStudentItem.assignment)}
                          className="inline-flex items-center gap-2 rounded-lg bg-[#0F4C81] px-4 py-2 text-sm font-medium text-white hover:bg-[#0C3D68]"
                        >
                          <Send className="h-4 w-4" aria-hidden="true" />
                          {selectedStudentItem.submission?.status === 'revision_requested'
                            ? 'Kirim Ulang Revisi Jawaban'
                            : 'Kirim Jawaban Foto'}
                        </button>
                      </div>
                    )}

                  {/* Submission History (Read-only, never overwritten) */}
                  {selectedStudentItem.submission && (
                    <div className="border-t border-slate-100 pt-5 space-y-3">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <History className="h-4 w-4 text-[#0F4C81]" aria-hidden="true" />
                        <span>Riwayat Pengumpulan Sebelumnya</span>
                      </div>
                      <div className="space-y-2.5">
                        {data.submissionHistory
                          .filter(
                            (h) => h.submissionId === selectedStudentItem.submission!.id
                          )
                          .sort((a, b) => b.version - a.version)
                          .map((hist) => (
                            <div
                              key={hist.id}
                              className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-xs"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-slate-900">
                                  Versi {hist.version} · {STATUS_LABELS[hist.status] || hist.status}
                                </span>
                                <span className="font-mono text-slate-500 tabular-nums">
                                  {hist.createdAt.slice(0, 16).replace('T', ' ')}
                                </span>
                              </div>
                              {hist.note && <p className="mt-1 text-slate-700">{hist.note}</p>}
                              {hist.photoUrls.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {hist.photoUrls.map((url, idx) => (
                                    <img
                                      key={idx}
                                      src={url}
                                      alt={`Lampiran versi ${hist.version} foto ${idx + 1}`}
                                      referrerPolicy="no-referrer"
                                      className="h-16 w-20 rounded border border-slate-200 object-cover"
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
                  Pilih salah satu tugas di sebelah kiri untuk melihat detail instruksi dan pengumpulan foto.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: KELOLA TUGAS OLEH GURU */}
      {tab === 'kelola_guru' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <section className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-5">
            <h2 className="text-base font-semibold text-slate-900">Buat Tugas Online Baru</h2>
            <p className="mt-1 text-xs text-slate-500">
              Guru hanya dapat membuat tugas untuk kelas dan mata pelajaran yang diampunya.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const res = createAssignment({
                  subjectId: newSubjectId,
                  classId: newClassId,
                  title: newTitle,
                  instructions: newInstructions,
                  assignedDate: newAssignedDate,
                  dueDate: newDueDate,
                  allowNumericScore: newAllowScore,
                  maxPhotos: newMaxPhotos,
                  maxFileSizeMb: newMaxFileMb,
                  attachmentName: newAttachmentName.trim() || undefined,
                });
                if (!res.ok) {
                  setFeedback({ type: 'err', text: res.error || 'Gagal membuat tugas.' });
                } else {
                  setNewTitle('');
                  setNewInstructions('');
                  setNewAttachmentName('');
                  setFeedback({
                    type: 'ok',
                    text: 'Tugas baru berhasil diterbitkan dan notifikasi dikirim ke siswa.',
                  });
                }
              }}
              className="mt-4 space-y-3"
            >
              <div>
                <label htmlFor="asg-title" className="block text-xs font-medium text-slate-700">
                  Judul Tugas
                </label>
                <input
                  id="asg-title"
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Contoh: Latihan Persamaan Kuadrat"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="asg-subj" className="block text-xs font-medium text-slate-700">
                    Mata Pelajaran
                  </label>
                  <select
                    id="asg-subj"
                    value={newSubjectId}
                    onChange={(e) => setNewSubjectId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    {data.subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="asg-cls" className="block text-xs font-medium text-slate-700">
                    Kelas Tujuan
                  </label>
                  <select
                    id="asg-cls"
                    value={newClassId}
                    onChange={(e) => setNewClassId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    {data.classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {currentUser.role === 'teacher' &&
                !canTeacherManageSubjectClass(
                  data.teachingAssignments,
                  currentUser.uid,
                  newSubjectId,
                  newClassId
                ) && (
                  <p className="text-xs text-amber-700">
                    Peringatan: Anda tidak tercatat sebagai pengampu kombinasi kelas dan mapel ini.
                  </p>
                )}
              <div>
                <label htmlFor="asg-inst" className="block text-xs font-medium text-slate-700">
                  Deskripsi & Instruksi Pengerjaan
                </label>
                <textarea
                  id="asg-inst"
                  rows={3}
                  required
                  value={newInstructions}
                  onChange={(e) => setNewInstructions(e.target.value)}
                  placeholder="Tuliskan langkah pengerjaan tugas dan format foto yang diharapkan..."
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="asg-start" className="block text-xs font-medium text-slate-700">
                    Tanggal Pemberian
                  </label>
                  <input
                    id="asg-start"
                    type="date"
                    value={newAssignedDate}
                    onChange={(e) => setNewAssignedDate(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="asg-due" className="block text-xs font-medium text-slate-700">
                    Tenggat Pengumpulan
                  </label>
                  <input
                    id="asg-due"
                    type="datetime-local"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="asg-maxp" className="block text-xs font-medium text-slate-700">
                    Maks Foto
                  </label>
                  <input
                    id="asg-maxp"
                    type="number"
                    min={1}
                    max={10}
                    value={newMaxPhotos}
                    onChange={(e) => setNewMaxPhotos(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums"
                  />
                </div>
                <div>
                  <label htmlFor="asg-maxmb" className="block text-xs font-medium text-slate-700">
                    Batas Ukuran (MB)
                  </label>
                  <input
                    id="asg-maxmb"
                    type="number"
                    min={1}
                    max={15}
                    value={newMaxFileMb}
                    onChange={(e) => setNewMaxFileMb(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Lampiran Pendukung (PDF/Gambar/Dokumen)
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                    <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                    Pilih File Lampiran
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                      className="sr-only"
                      onChange={(e) =>
                        setNewAttachmentName(e.target.files?.[0]?.name || '')
                      }
                    />
                  </label>
                  {newAttachmentName && (
                    <span className="truncate text-xs text-slate-600">{newAttachmentName}</span>
                  )}
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={newAllowScore}
                  onChange={(e) => setNewAllowScore(e.target.checked)}
                />
                Aktifkan penilaian angka saat verifikasi guru
              </label>
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#0F4C81] px-4 py-2 text-sm font-medium text-white hover:bg-[#0C3D68]"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Terbitkan Tugas Online
              </button>
            </form>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-7">
            <h2 className="text-base font-semibold text-slate-900">Daftar Tugas Dikelola</h2>
            <div className="mt-4 divide-y divide-slate-100">
              {data.assignments
                .filter((a) =>
                  currentUser.role === 'teacher' ? a.teacherId === currentUser.uid : true
                )
                .map((asg) => {
                  const subj = data.subjects.find((s) => s.id === asg.subjectId);
                  const cls = data.classes.find((c) => c.id === asg.classId);
                  return (
                    <div key={asg.id} className="py-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {asg.title}{' '}
                            {asg.status === 'archived' && (
                              <span className="text-xs font-normal text-slate-500">
                                (Diarsipkan)
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-slate-500">
                            {subj?.name} · Kelas {cls?.name} · Tenggat{' '}
                            {asg.dueDate.replace('T', ' ')}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              updateAssignment(asg.id, {
                                status: asg.status === 'active' ? 'archived' : 'active',
                              })
                            }
                            className="inline-flex items-center gap-1 rounded border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                            {asg.status === 'active' ? 'Arsipkan' : 'Aktifkan'}
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteAssignment(asg.id)}
                            aria-label={`Hapus tugas ${asg.title}`}
                            className="inline-flex items-center gap-1 rounded border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            Hapus
                          </button>
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-slate-600">{asg.instructions}</p>
                    </div>
                  );
                })}
            </div>
          </section>
        </div>
      )}

      {/* VIEW 3: DASHBOARD VERIFIKASI GURU */}
      {tab === 'verifikasi_guru' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-3 lg:col-span-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-slate-900">
                Antrean Pengumpulan Siswa ({teacherSubmissions.length})
              </h2>
              <p className="text-xs text-slate-500">
                Pilih pengumpulan untuk memeriksa foto jawaban dan riwayat revisi.
              </p>
            </div>
            {teacherSubmissions.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
                Belum ada pengumpulan siswa untuk tugas Anda.
              </div>
            ) : (
              teacherSubmissions.map((sub) => {
                const stu = data.users.find((u) => u.uid === sub.studentId);
                const asg = data.assignments.find((a) => a.id === sub.assignmentId);
                const cls = data.classes.find((c) => c.id === sub.classId);
                const subj = data.subjects.find((s) => s.id === asg?.subjectId);
                const isSelected = activeSubmission?.id === sub.id;
                return (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => {
                      setSelectedSubmissionId(sub.id);
                      setActivePhotoIndex(0);
                      setZoomLevel(1);
                      setRotationDeg(0);
                      setCompareHistoryIndex(null);
                      setVerifyFeedback(sub.teacherFeedback || '');
                      setVerifyScore(sub.score !== undefined ? String(sub.score) : '90');
                    }}
                    className={`w-full rounded-xl border p-4 text-left transition-colors ${
                      isSelected
                        ? 'border-[#0F4C81] bg-sky-50/40'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">
                        {stu?.name || sub.studentId}
                      </p>
                      <span
                        className={`text-xs font-semibold ${
                          sub.status === 'approved'
                            ? 'text-emerald-700'
                            : sub.status === 'revision_requested'
                            ? 'text-amber-700'
                            : 'text-[#0F4C81]'
                        }`}
                      >
                        {STATUS_LABELS[sub.status] || sub.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">
                      {cls?.name} · {subj?.name}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">{asg?.title}</p>
                    <p className="mt-1.5 text-xs font-mono text-slate-500 tabular-nums">
                      {sub.submittedAt ? sub.submittedAt.slice(0, 16).replace('T', ' ') : '-'} ·{' '}
                      {sub.photoUrls.length} foto
                    </p>
                  </button>
                );
              })
            )}
          </div>

          {/* Large Photo Viewer + Verification Panel */}
          <div className="lg:col-span-8">
            {activeSubmission && activeSubmissionAssignment ? (
              <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
                <div className="flex flex-col gap-2 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs text-slate-500">
                      {data.classes.find((c) => c.id === activeSubmission.classId)?.name} ·{' '}
                      {
                        data.subjects.find(
                          (s) => s.id === activeSubmissionAssignment.subjectId
                        )?.name
                      }{' '}
                      · Status: {STATUS_LABELS[activeSubmission.status]}
                    </p>
                    <h2 className="mt-0.5 text-lg font-bold text-slate-900">
                      {
                        data.users.find((u) => u.uid === activeSubmission.studentId)
                          ?.name
                      }{' '}
                      — {activeSubmissionAssignment.title}
                    </h2>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setZoomLevel((z) => Math.max(0.75, z - 0.25))}
                      aria-label="Perkecil foto"
                      className="rounded-lg border border-slate-300 p-2 text-slate-700 hover:bg-slate-50"
                    >
                      <ZoomOut className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <span className="px-2 text-xs font-mono tabular-nums text-slate-700">
                      {Math.round(zoomLevel * 100)}%
                    </span>
                    <button
                      type="button"
                      onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.25))}
                      aria-label="Perbesar foto"
                      className="rounded-lg border border-slate-300 p-2 text-slate-700 hover:bg-slate-50"
                    >
                      <ZoomIn className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setRotationDeg((r) => (r + 90) % 360)}
                      aria-label="Putar foto 90 derajat"
                      className="rounded-lg border border-slate-300 p-2 text-slate-700 hover:bg-slate-50"
                    >
                      <RotateCw className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {/* Large Zoomable Photo Canvas */}
                <div className="overflow-auto rounded-lg border border-slate-200 bg-slate-900/95 p-4 flex items-center justify-center min-h-[320px] max-h-[460px]">
                  {activeSubmission.photoUrls[activePhotoIndex] ? (
                    <img
                      src={activeSubmission.photoUrls[activePhotoIndex]}
                      alt={`Foto jawaban ${activePhotoIndex + 1}`}
                      referrerPolicy="no-referrer"
                      style={{
                        transform: `scale(${zoomLevel}) rotate(${rotationDeg}deg)`,
                        transition: 'transform 180ms ease-out',
                      }}
                      className="max-h-[400px] w-auto object-contain rounded"
                    />
                  ) : (
                    <p className="text-sm text-slate-300">Tidak ada foto terlampir.</p>
                  )}
                </div>

                {/* Multi-Photo Thumbnail Switcher */}
                {activeSubmission.photoUrls.length > 1 && (
                  <div className="flex flex-wrap items-center gap-2">
                    {activeSubmission.photoUrls.map((url, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setActivePhotoIndex(idx)}
                        className={`overflow-hidden rounded-lg border-2 ${
                          activePhotoIndex === idx
                            ? 'border-[#0F4C81]'
                            : 'border-slate-200'
                        }`}
                      >
                        <img
                          src={url}
                          alt={`Thumbnail foto ${idx + 1}`}
                          referrerPolicy="no-referrer"
                          className="h-14 w-20 object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}

                {activeSubmission.studentNote && (
                  <p className="text-xs text-slate-600">
                    <strong>Catatan Siswa:</strong> {activeSubmission.studentNote}
                  </p>
                )}

                {/* Verification Form */}
                <div className="border-t border-slate-100 pt-4 space-y-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="sm:col-span-2">
                      <label
                        htmlFor="verify-feedback"
                        className="block text-xs font-medium text-slate-700"
                      >
                        Catatan Revisi / Komentar Akhir Guru (Wajib saat minta revisi)
                      </label>
                      <textarea
                        id="verify-feedback"
                        rows={2}
                        value={verifyFeedback}
                        onChange={(e) => setVerifyFeedback(e.target.value)}
                        placeholder="Tuliskan catatan pemeriksaan atau alasan revisi..."
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                    {activeSubmissionAssignment.allowNumericScore && (
                      <div>
                        <label
                          htmlFor="verify-score"
                          className="block text-xs font-medium text-slate-700"
                        >
                          Nilai Tugas (0–100)
                        </label>
                        <input
                          id="verify-score"
                          type="number"
                          min={0}
                          max={100}
                          value={verifyScore}
                          onChange={(e) => setVerifyScore(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums"
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        const res = verifyAssignmentSubmission({
                          submissionId: activeSubmission.id,
                          decision: 'approved',
                          feedback: verifyFeedback || 'Jawaban telah diperiksa dan diterima.',
                          score: activeSubmissionAssignment.allowNumericScore
                            ? Number(verifyScore)
                            : undefined,
                        });
                        setFeedback(
                          res.ok
                            ? { type: 'ok', text: 'Jawaban disetujui dan notifikasi terkirim.' }
                            : { type: 'err', text: res.error || 'Gagal memverifikasi.' }
                        );
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
                    >
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      Setujui Jawaban
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const res = verifyAssignmentSubmission({
                          submissionId: activeSubmission.id,
                          decision: 'revision_requested',
                          feedback: verifyFeedback,
                        });
                        setFeedback(
                          res.ok
                            ? { type: 'ok', text: 'Permintaan revisi berhasil dikirim ke siswa.' }
                            : { type: 'err', text: res.error || 'Catatan revisi wajib diisi.' }
                        );
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100"
                    >
                      Minta Revisi
                    </button>
                  </div>
                </div>

                {/* History & Comparison */}
                <div className="border-t border-slate-100 pt-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-900">
                      Riwayat & Perbandingan Pengumpulan ({activeSubmissionHistory.length} versi)
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {activeSubmissionHistory.map((h, idx) => (
                      <div
                        key={h.id}
                        className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3 text-xs sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p className="font-semibold text-slate-900">
                            Versi {h.version} · {STATUS_LABELS[h.status] || h.status} ·{' '}
                            {h.actorRole}
                          </p>
                          <p className="text-slate-600">{h.note || '-'}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono text-slate-500 tabular-nums">
                            {h.createdAt.slice(0, 16).replace('T', ' ')}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setCompareHistoryIndex(compareHistoryIndex === idx ? null : idx)
                            }
                            className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            <Eye className="h-3 w-3" aria-hidden="true" />
                            {compareHistoryIndex === idx ? 'Tutup' : 'Bandingkan'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {compareHistoryIndex !== null &&
                    activeSubmissionHistory[compareHistoryIndex] && (
                      <div className="grid grid-cols-1 gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
                        <div>
                          <p className="text-xs font-semibold text-slate-700">
                            Foto Versi Dipilih (Versi{' '}
                            {activeSubmissionHistory[compareHistoryIndex].version})
                          </p>
                          <img
                            src={
                              activeSubmissionHistory[compareHistoryIndex].photoUrls[0] ||
                              ''
                            }
                            alt="Foto versi historis"
                            referrerPolicy="no-referrer"
                            className="mt-2 h-48 w-full rounded border border-slate-200 object-contain bg-white"
                          />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-700">
                            Foto Pengumpulan Terbaru
                          </p>
                          <img
                            src={activeSubmission.photoUrls[0] || ''}
                            alt="Foto pengumpulan terbaru"
                            referrerPolicy="no-referrer"
                            className="mt-2 h-48 w-full rounded border border-slate-200 object-contain bg-white"
                          />
                        </div>
                      </div>
                    )}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
                Pilih salah satu pengumpulan di sebelah kiri untuk melakukan verifikasi.
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 4: REKAP TUGAS & EKSPOR */}
      {tab === 'rekap_ekspor' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 lg:flex-row lg:items-center lg:justify-between">
              <h2 className="text-base font-semibold text-slate-900">
                Rekap Pengumpulan Tugas Online
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={recapClassId}
                  onChange={(e) => setRecapClassId(e.target.value)}
                  aria-label="Filter kelas rekap tugas"
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
                >
                  <option value="all">Semua Kelas</option>
                  {data.classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <select
                  value={recapSubjectId}
                  onChange={(e) => setRecapSubjectId(e.target.value)}
                  aria-label="Filter mapel rekap tugas"
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
                >
                  <option value="all">Semua Mapel</option>
                  {data.subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <select
                  value={recapAssignmentId}
                  onChange={(e) => setRecapAssignmentId(e.target.value)}
                  aria-label="Filter judul tugas"
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
                >
                  <option value="all">Semua Tugas</option>
                  {data.assignments.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  value={recapStart}
                  onChange={(e) => setRecapStart(e.target.value)}
                  aria-label="Periode mulai"
                  className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-mono"
                />
                <input
                  type="date"
                  value={recapEnd}
                  onChange={(e) => setRecapEnd(e.target.value)}
                  aria-label="Periode akhir"
                  className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-mono"
                />
                <button
                  type="button"
                  onClick={() => exportAssignmentRecapToExcel(buildRecapExportRows())}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
                  Ekspor Excel
                </button>
                <button
                  type="button"
                  onClick={() =>
                    exportAssignmentRecapToPdf(
                      buildRecapExportRows(),
                      data.school.name,
                      `Rekap E-Tugas · Dicetak oleh ${currentUser.name}`
                    )
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F4C81] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#0C3D68]"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  Ekspor PDF
                </button>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
              {[
                ['Ditugaskan', recapStats.totalTargetedStudents],
                ['Belum Kumpul', recapStats.notSubmitted],
                ['Sudah Kumpul', recapStats.totalSubmitted],
                ['Menunggu Cek', recapStats.pendingVerification],
                ['Perlu Revisi', recapStats.needsRevision],
                ['Disetujui', recapStats.approved],
                ['Terlambat', recapStats.late],
              ].map(([label, val]) => (
                <div
                  key={String(label)}
                  className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5"
                >
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="mt-1 text-xl font-bold text-slate-900 tabular-nums">{val}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                    <th className="py-2.5 pr-4">Tugas</th>
                    <th className="py-2.5 pr-4">Kelas</th>
                    <th className="py-2.5 pr-4">Siswa</th>
                    <th className="py-2.5 pr-4">Status</th>
                    <th className="py-2.5 pr-4">Waktu Kumpul</th>
                    <th className="py-2.5 text-right">Nilai</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {buildRecapExportRows().map((row, idx) => (
                    <tr key={idx}>
                      <td className="py-2.5 pr-4 font-medium text-slate-900">
                        {row.assignmentTitle}
                      </td>
                      <td className="py-2.5 pr-4 text-slate-600">{row.className}</td>
                      <td className="py-2.5 pr-4 text-slate-700">{row.studentName}</td>
                      <td className="py-2.5 pr-4 text-xs font-semibold text-slate-700">
                        {row.statusLabel}
                      </td>
                      <td className="py-2.5 pr-4 font-mono text-xs text-slate-500 tabular-nums">
                        {row.submittedAt}
                      </td>
                      <td className="py-2.5 text-right font-mono font-semibold tabular-nums text-slate-900">
                        {row.scoreLabel}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Camera Modal */}
      {cameraOpen && selectedStudentItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">
                Ambil Foto Jawaban via Kamera
              </h3>
              <button
                type="button"
                onClick={closeCamera}
                aria-label="Tutup kamera"
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            {cameraError ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
                {cameraError}
              </div>
            ) : (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full rounded-lg bg-slate-900 aspect-video object-cover"
              />
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeCamera}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => captureFromCamera(selectedStudentItem.assignment)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F4C81] px-4 py-2 text-xs font-medium text-white hover:bg-[#0C3D68]"
              >
                <Check className="h-4 w-4" aria-hidden="true" />
                {cameraError ? 'Gunakan Foto Contoh' : 'Ambil Foto'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
