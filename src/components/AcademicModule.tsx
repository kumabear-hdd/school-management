import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  Calendar,
  Download,
  FileSpreadsheet,
  Lock,
  Plus,
  Save,
  Sliders,
} from 'lucide-react';
import { useSims } from '../context/SimsContext';
import {
  canTeacherManageSubjectClass,
  canViewStudentGrades,
  validateComponentWeights,
} from '../utils/academicLogic';
import { exportGradesToExcel, exportGradesToPdf } from '../utils/exportUtils';
import type { AssessmentComponent } from '../types/sims';

type AcademicTab = 'mapel_kurikulum' | 'kelas_pengampu' | 'jadwal_agenda' | 'nilai_rekap';

export const AcademicModule: React.FC = () => {
  const {
    data,
    currentUser,
    addSubject,
    addCurriculum,
    setActiveCurriculum,
    addClass,
    addTeachingAssignment,
    addSchedule,
    addTeachingAgenda,
    updateAssessmentComponents,
    upsertAcademicGrade,
  } = useSims();

  const [tab, setTab] = useState<AcademicTab>('nilai_rekap');
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Forms for Master Mapel & Kurikulum
  const [subjCode, setSubjCode] = useState('');
  const [subjName, setSubjName] = useState('');
  const [subjCategory, setSubjCategory] = useState<'Wajib' | 'Peminatan' | 'Muatan Lokal'>('Wajib');
  const [subjKkm, setSubjKkm] = useState(75);

  const [currName, setCurrName] = useState('');
  const [currYear, setCurrYear] = useState('2026/2027');
  const [currSemester, setCurrSemester] = useState<'Ganjil' | 'Genap'>('Ganjil');

  // Forms for Kelas & Guru Pengampu
  const [className, setClassName] = useState('');
  const [gradeLevel, setGradeLevel] = useState('X');
  const [homeroomTeacherId, setHomeroomTeacherId] = useState(
    data.users.find((u) => u.role === 'teacher')?.uid || ''
  );

  const [mapTeacherId, setMapTeacherId] = useState(
    data.users.find((u) => u.role === 'teacher')?.uid || ''
  );
  const [mapSubjectId, setMapSubjectId] = useState(data.subjects[0]?.id || '');
  const [mapClassId, setMapClassId] = useState(data.classes[0]?.id || '');

  // Forms for Jadwal & Agenda
  const [schClassId, setSchClassId] = useState(data.classes[0]?.id || '');
  const [schSubjectId, setSchSubjectId] = useState(data.subjects[0]?.id || '');
  const [schTeacherId, setSchTeacherId] = useState(
    data.users.find((u) => u.role === 'teacher')?.uid || ''
  );
  const [schDay, setSchDay] = useState<'Senin' | 'Selasa' | 'Rabu' | 'Kamis' | 'Jumat' | 'Sabtu'>('Senin');
  const [schStart, setSchStart] = useState('07:30');
  const [schEnd, setSchEnd] = useState('09:00');
  const [schRoom, setSchRoom] = useState('R.202');

  const [agendaClassId, setAgendaClassId] = useState(data.classes[0]?.id || '');
  const [agendaSubjectId, setAgendaSubjectId] = useState(data.subjects[0]?.id || '');
  const [agendaTopic, setAgendaTopic] = useState('');
  const [agendaNotes, setAgendaNotes] = useState('');
  const [agendaPresent, setAgendaPresent] = useState(30);

  // Nilai & Rekap state
  const [filterClassId, setFilterClassId] = useState<string>('all');
  const [filterSubjectId, setFilterSubjectId] = useState<string>('all');
  const [filterStudentId, setFilterStudentId] = useState<string>('all');

  const [draftComponents, setDraftComponents] = useState<AssessmentComponent[]>(
    data.assessmentComponents
  );
  const [editingStudentId, setEditingStudentId] = useState(
    data.users.find((u) => u.role === 'student')?.uid || ''
  );
  const [editingClassId, setEditingClassId] = useState(data.classes[0]?.id || '');
  const [editingSubjectId, setEditingSubjectId] = useState(data.subjects[0]?.id || '');
  const [scoreInputs, setScoreInputs] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const c of data.assessmentComponents) {
      initial[c.id] = 85;
    }
    return initial;
  });

  const canManageAcademicMaster =
    currentUser.role === 'principal' || currentUser.role === 'school_admin';
  const isTeacherOrPrincipal =
    currentUser.role === 'teacher' || currentUser.role === 'principal';

  const canEditSelectedGrade =
    currentUser.role === 'principal' ||
    (currentUser.role === 'teacher' &&
      canTeacherManageSubjectClass(
        data.teachingAssignments,
        currentUser.uid,
        editingSubjectId,
        editingClassId
      ));

  const teachers = data.users.filter((u) => u.role === 'teacher');
  const students = data.users.filter((u) => u.role === 'student');

  const visibleGrades = useMemo(() => {
    return data.academicGrades.filter((grd) => {
      if (
        !canViewStudentGrades(
          currentUser,
          grd.studentId,
          grd.classId,
          data.classes,
          data.teachingAssignments,
          grd.subjectId
        )
      ) {
        return false;
      }
      if (filterClassId !== 'all' && grd.classId !== filterClassId) return false;
      if (filterSubjectId !== 'all' && grd.subjectId !== filterSubjectId) return false;
      if (filterStudentId !== 'all' && grd.studentId !== filterStudentId) return false;
      return true;
    });
  }, [data, currentUser, filterClassId, filterSubjectId, filterStudentId]);

  const buildExportRows = () =>
    visibleGrades.map((grd) => {
      const student = data.users.find((u) => u.uid === grd.studentId);
      const cls = data.classes.find((c) => c.id === grd.classId);
      const subj = data.subjects.find((s) => s.id === grd.subjectId);
      const kkm = subj?.kkm ?? 75;
      const summary = data.assessmentComponents
        .filter((c) => c.isActive)
        .map((c) => `${c.name}: ${grd.scores[c.id] ?? 0}`)
        .join(' | ');
      return {
        studentName: student?.name || grd.studentId,
        className: cls?.name || grd.classId,
        subjectName: subj?.name || grd.subjectId,
        componentSummary: summary,
        finalScore: grd.finalScore,
        kkm,
        status: grd.finalScore >= kkm ? 'Tuntas' : 'Perlu Pendampingan',
      };
    });

  const handleSaveGrade = (e: React.FormEvent) => {
    e.preventDefault();
    const res = upsertAcademicGrade({
      studentId: editingStudentId,
      classId: editingClassId,
      subjectId: editingSubjectId,
      scores: scoreInputs,
    });
    if (!res.ok) {
      setFeedback({ type: 'err', text: res.error || 'Gagal menyimpan nilai.' });
    } else {
      setFeedback({
        type: 'ok',
        text: 'Nilai akademik berhasil disimpan dan dicatat ke dalam audit log.',
      });
    }
  };

  const handleSaveComponents = () => {
    const check = validateComponentWeights(draftComponents);
    if (!check.valid) {
      setFeedback({ type: 'err', text: check.error || 'Bobot tidak valid.' });
      return;
    }
    const res = updateAssessmentComponents(draftComponents);
    if (res.ok) {
      setFeedback({ type: 'ok', text: 'Komponen penilaian dan bobot 100% berhasil disimpan.' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Modul Akademik & Pengelolaan Nilai
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Pengelolaan mata pelajaran, kurikulum, kelas, jadwal, agenda mengajar, komponen penilaian, dan rekap nilai akademik.
          </p>
        </div>

        {/* Segmented Sub-Navigation */}
        <div
          role="tablist"
          aria-label="Navigasi Modul Akademik"
          className="inline-flex w-fit max-w-full overflow-x-auto items-center gap-1 rounded-lg bg-slate-100 p-1"
        >
          {(
            [
              ['nilai_rekap', 'Nilai & Rekap'],
              ['jadwal_agenda', 'Jadwal & Agenda'],
              ['kelas_pengampu', 'Kelas & Pengampu'],
              ['mapel_kurikulum', 'Mapel & Kurikulum'],
            ] as [AcademicTab, string][]
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

      {/* TAB 1: MAPEL & KURIKULUM */}
      {tab === 'mapel_kurikulum' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-base font-semibold text-slate-900">Master Mata Pelajaran</h2>
            {canManageAcademicMaster && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!subjCode.trim() || !subjName.trim()) return;
                  addSubject({
                    code: subjCode.trim().toUpperCase(),
                    name: subjName.trim(),
                    category: subjCategory,
                    kkm: Number(subjKkm),
                  });
                  setSubjCode('');
                  setSubjName('');
                }}
                className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-4"
              >
                <input
                  type="text"
                  value={subjCode}
                  onChange={(e) => setSubjCode(e.target.value)}
                  placeholder="Kode (BIO-11)"
                  aria-label="Kode mata pelajaran"
                  required
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  value={subjName}
                  onChange={(e) => setSubjName(e.target.value)}
                  placeholder="Nama mata pelajaran"
                  aria-label="Nama mata pelajaran"
                  required
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
                />
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={subjKkm}
                  onChange={(e) => setSubjKkm(Number(e.target.value))}
                  aria-label="KKM"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums"
                />
                <select
                  value={subjCategory}
                  onChange={(e) =>
                    setSubjCategory(e.target.value as 'Wajib' | 'Peminatan' | 'Muatan Lokal')
                  }
                  aria-label="Kategori mata pelajaran"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
                >
                  <option value="Wajib">Wajib</option>
                  <option value="Peminatan">Peminatan</option>
                  <option value="Muatan Lokal">Muatan Lokal</option>
                </select>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#0F4C81] px-4 py-2 text-sm font-medium text-white hover:bg-[#0C3D68] sm:col-span-2"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Tambah Mapel
                </button>
              </form>
            )}
            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                    <th className="py-2 pr-3">Kode</th>
                    <th className="py-2 pr-3">Mata Pelajaran</th>
                    <th className="py-2 pr-3">Kategori</th>
                    <th className="py-2 text-right">KKM</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.subjects.map((s) => (
                    <tr key={s.id}>
                      <td className="py-2.5 pr-3 font-mono text-xs text-slate-600">{s.code}</td>
                      <td className="py-2.5 pr-3 font-medium text-slate-900">{s.name}</td>
                      <td className="py-2.5 pr-3 text-xs text-slate-600">{s.category}</td>
                      <td className="py-2.5 text-right font-mono tabular-nums text-slate-900">
                        {s.kkm}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-base font-semibold text-slate-900">Pengelolaan Kurikulum</h2>
            {canManageAcademicMaster && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!currName.trim()) return;
                  addCurriculum({
                    name: currName.trim(),
                    academicYear: currYear,
                    semester: currSemester,
                    isActive: true,
                  });
                  setCurrName('');
                }}
                className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3"
              >
                <input
                  type="text"
                  value={currName}
                  onChange={(e) => setCurrName(e.target.value)}
                  placeholder="Nama kurikulum"
                  aria-label="Nama kurikulum"
                  required
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-3"
                />
                <input
                  type="text"
                  value={currYear}
                  onChange={(e) => setCurrYear(e.target.value)}
                  placeholder="2026/2027"
                  aria-label="Tahun ajaran"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <select
                  value={currSemester}
                  onChange={(e) => setCurrSemester(e.target.value as 'Ganjil' | 'Genap')}
                  aria-label="Semester"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="Ganjil">Ganjil</option>
                  <option value="Genap">Genap</option>
                </select>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#0F4C81] px-4 py-2 text-sm font-medium text-white hover:bg-[#0C3D68]"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Simpan
                </button>
              </form>
            )}
            <div className="mt-5 divide-y divide-slate-100">
              {data.curriculums.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{c.name}</p>
                    <p className="text-xs text-slate-500">
                      Tahun Ajaran {c.academicYear} · Semester {c.semester}
                    </p>
                  </div>
                  {c.isActive ? (
                    <span className="text-xs font-semibold text-emerald-700">Aktif</span>
                  ) : (
                    canManageAcademicMaster && (
                      <button
                        type="button"
                        onClick={() => setActiveCurriculum(c.id)}
                        className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Aktifkan
                      </button>
                    )
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* TAB 2: KELAS & GURU PENGAMPU */}
      {tab === 'kelas_pengampu' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-base font-semibold text-slate-900">Pengelolaan Kelas & Wali Kelas</h2>
            {canManageAcademicMaster && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!className.trim()) return;
                  addClass({
                    name: className.trim(),
                    gradeLevel,
                    homeroomTeacherId,
                    studentIds: [],
                  });
                  setClassName('');
                }}
                className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3"
              >
                <input
                  type="text"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  placeholder="Nama kelas (XII IPA 1)"
                  aria-label="Nama kelas"
                  required
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <select
                  value={gradeLevel}
                  onChange={(e) => setGradeLevel(e.target.value)}
                  aria-label="Tingkat kelas"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="X">Tingkat X</option>
                  <option value="XI">Tingkat XI</option>
                  <option value="XII">Tingkat XII</option>
                </select>
                <select
                  value={homeroomTeacherId}
                  onChange={(e) => setHomeroomTeacherId(e.target.value)}
                  aria-label="Wali kelas"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {teachers.map((t) => (
                    <option key={t.uid} value={t.uid}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#0F4C81] px-4 py-2 text-sm font-medium text-white hover:bg-[#0C3D68] sm:col-span-3"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Tambah Kelas
                </button>
              </form>
            )}
            <div className="mt-5 divide-y divide-slate-100">
              {data.classes.map((cls) => {
                const homeroom = data.users.find((u) => u.uid === cls.homeroomTeacherId);
                return (
                  <div key={cls.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {cls.name} · Tingkat {cls.gradeLevel}
                      </p>
                      <p className="text-xs text-slate-500">
                        Wali Kelas: {homeroom?.name || '-'}
                      </p>
                    </div>
                    <span className="text-xs font-mono text-slate-600 tabular-nums">
                      {cls.studentIds.length} siswa
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-base font-semibold text-slate-900">
              Pengelolaan Guru Pengampu Mata Pelajaran
            </h2>
            {canManageAcademicMaster && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  addTeachingAssignment({
                    teacherId: mapTeacherId,
                    subjectId: mapSubjectId,
                    classId: mapClassId,
                  });
                }}
                className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3"
              >
                <select
                  value={mapTeacherId}
                  onChange={(e) => setMapTeacherId(e.target.value)}
                  aria-label="Pilih guru pengampu"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {teachers.map((t) => (
                    <option key={t.uid} value={t.uid}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <select
                  value={mapSubjectId}
                  onChange={(e) => setMapSubjectId(e.target.value)}
                  aria-label="Pilih mata pelajaran"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {data.subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <select
                  value={mapClassId}
                  onChange={(e) => setMapClassId(e.target.value)}
                  aria-label="Pilih kelas"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {data.classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#0F4C81] px-4 py-2 text-sm font-medium text-white hover:bg-[#0C3D68] sm:col-span-3"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Tetapkan Guru Pengampu
                </button>
              </form>
            )}
            <div className="mt-5 divide-y divide-slate-100">
              {data.teachingAssignments.map((ta) => {
                const teacher = data.users.find((u) => u.uid === ta.teacherId);
                const subject = data.subjects.find((s) => s.id === ta.subjectId);
                const cls = data.classes.find((c) => c.id === ta.classId);
                return (
                  <div key={ta.id} className="py-3">
                    <p className="text-sm font-semibold text-slate-900">
                      {teacher?.name || ta.teacherId}
                    </p>
                    <p className="text-xs text-slate-500">
                      Mengampu {subject?.name || ta.subjectId} · Kelas {cls?.name || ta.classId}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {/* TAB 3: JADWAL & AGENDA MENGAJAR */}
      {tab === 'jadwal_agenda' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-[#0F4C81]" aria-hidden="true" />
              <h2 className="text-base font-semibold text-slate-900">
                Jadwal Pelajaran & Mengajar Guru
              </h2>
            </div>
            {canManageAcademicMaster && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  addSchedule({
                    classId: schClassId,
                    subjectId: schSubjectId,
                    teacherId: schTeacherId,
                    day: schDay,
                    startTime: schStart,
                    endTime: schEnd,
                    room: schRoom,
                  });
                }}
                className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3"
              >
                <select
                  value={schClassId}
                  onChange={(e) => setSchClassId(e.target.value)}
                  aria-label="Kelas jadwal"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {data.classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <select
                  value={schSubjectId}
                  onChange={(e) => setSchSubjectId(e.target.value)}
                  aria-label="Mapel jadwal"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {data.subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <select
                  value={schTeacherId}
                  onChange={(e) => setSchTeacherId(e.target.value)}
                  aria-label="Guru jadwal"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {teachers.map((t) => (
                    <option key={t.uid} value={t.uid}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <select
                  value={schDay}
                  onChange={(e) => setSchDay(e.target.value as typeof schDay)}
                  aria-label="Hari jadwal"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'].map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={schStart}
                  onChange={(e) => setSchStart(e.target.value)}
                  aria-label="Jam mulai"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                />
                <input
                  type="text"
                  value={schEnd}
                  onChange={(e) => setSchEnd(e.target.value)}
                  aria-label="Jam selesai"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                />
                <input
                  type="text"
                  value={schRoom}
                  onChange={(e) => setSchRoom(e.target.value)}
                  placeholder="Ruang"
                  aria-label="Ruang kelas"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-[#0F4C81] px-4 py-2 text-sm font-medium text-white hover:bg-[#0C3D68]"
                >
                  Tambah Jadwal
                </button>
              </form>
            )}

            <div className="mt-5 divide-y divide-slate-100">
              {data.schedules.map((sch) => {
                const cls = data.classes.find((c) => c.id === sch.classId);
                const subj = data.subjects.find((s) => s.id === sch.subjectId);
                const teacher = data.users.find((u) => u.uid === sch.teacherId);
                return (
                  <div key={sch.id} className="flex items-center justify-between gap-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {cls?.name} · {subj?.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {teacher?.name} · {sch.room}
                      </p>
                    </div>
                    <span className="text-xs font-mono text-slate-700 tabular-nums">
                      {sch.day}, {sch.startTime}–{sch.endTime}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-[#0F4C81]" aria-hidden="true" />
              <h2 className="text-base font-semibold text-slate-900">Agenda Mengajar Guru</h2>
            </div>
            {(currentUser.role === 'teacher' || currentUser.role === 'principal') && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!agendaTopic.trim()) return;
                  addTeachingAgenda({
                    classId: agendaClassId,
                    subjectId: agendaSubjectId,
                    date: new Date().toISOString().slice(0, 10),
                    topic: agendaTopic.trim(),
                    notes: agendaNotes.trim(),
                    presentCount: Number(agendaPresent),
                  });
                  setAgendaTopic('');
                  setAgendaNotes('');
                }}
                className="mt-4 space-y-3"
              >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <select
                    value={agendaClassId}
                    onChange={(e) => setAgendaClassId(e.target.value)}
                    aria-label="Kelas agenda mengajar"
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    {data.classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={agendaSubjectId}
                    onChange={(e) => setAgendaSubjectId(e.target.value)}
                    aria-label="Mata pelajaran agenda mengajar"
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    {data.subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={0}
                    max={60}
                    value={agendaPresent}
                    onChange={(e) => setAgendaPresent(Number(e.target.value))}
                    aria-label="Jumlah siswa hadir"
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums"
                  />
                </div>
                <input
                  type="text"
                  value={agendaTopic}
                  onChange={(e) => setAgendaTopic(e.target.value)}
                  placeholder="Materi pokok pertemuan hari ini"
                  aria-label="Materi pokok"
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <textarea
                  rows={2}
                  value={agendaNotes}
                  onChange={(e) => setAgendaNotes(e.target.value)}
                  placeholder="Catatan pelaksanaan pembelajaran"
                  aria-label="Catatan agenda mengajar"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F4C81] px-4 py-2 text-sm font-medium text-white hover:bg-[#0C3D68]"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Catat Agenda Mengajar
                </button>
              </form>
            )}

            <div className="mt-5 divide-y divide-slate-100">
              {data.teachingAgendas.map((ag) => {
                const cls = data.classes.find((c) => c.id === ag.classId);
                const subj = data.subjects.find((s) => s.id === ag.subjectId);
                const teacher = data.users.find((u) => u.uid === ag.teacherId);
                return (
                  <div key={ag.id} className="py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">{ag.topic}</p>
                      <span className="text-xs font-mono text-slate-500 tabular-nums">
                        {ag.date}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {cls?.name} · {subj?.name} · {teacher?.name} · Hadir {ag.presentCount} siswa
                    </p>
                    {ag.notes && <p className="mt-1 text-xs text-slate-600">{ag.notes}</p>}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {/* TAB 4: NILAI & REKAP */}
      {tab === 'nilai_rekap' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Input Nilai Guru (RBAC Protected) */}
            {isTeacherOrPrincipal && (
              <section className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-5">
                <h2 className="text-base font-semibold text-slate-900">
                  Input Nilai Akademik Siswa
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Guru hanya dapat menginput atau memperbarui nilai untuk mata pelajaran dan kelas yang diampunya. Setiap perubahan nilai dicatat ke audit log.
                </p>

                <form onSubmit={handleSaveGrade} className="mt-4 space-y-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label htmlFor="grade-class" className="block text-xs font-medium text-slate-700">
                        Kelas
                      </label>
                      <select
                        id="grade-class"
                        value={editingClassId}
                        onChange={(e) => setEditingClassId(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      >
                        {data.classes.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="grade-subject" className="block text-xs font-medium text-slate-700">
                        Mata Pelajaran
                      </label>
                      <select
                        id="grade-subject"
                        value={editingSubjectId}
                        onChange={(e) => setEditingSubjectId(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      >
                        {data.subjects.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="grade-student" className="block text-xs font-medium text-slate-700">
                      Siswa
                    </label>
                    <select
                      id="grade-student"
                      value={editingStudentId}
                      onChange={(e) => setEditingStudentId(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    >
                      {students.map((st) => (
                        <option key={st.uid} value={st.uid}>
                          {st.name} (
                          {data.classes.find((c) => c.id === st.classId)?.name || '-'})
                        </option>
                      ))}
                    </select>
                  </div>

                  {!canEditSelectedGrade && (
                    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                      <Lock className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                      <span>
                        Anda bukan guru pengampu untuk kombinasi kelas & mata pelajaran ini. Pilih kelas/mapel yang Anda ampu.
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    {data.assessmentComponents
                      .filter((c) => c.isActive)
                      .map((comp) => (
                        <div key={comp.id}>
                          <label
                            htmlFor={`score-${comp.id}`}
                            className="block text-xs font-medium text-slate-700 truncate"
                          >
                            {comp.name} ({comp.weightPercent}%)
                          </label>
                          <input
                            id={`score-${comp.id}`}
                            type="number"
                            min={0}
                            max={100}
                            value={scoreInputs[comp.id] ?? 0}
                            onChange={(e) =>
                              setScoreInputs((prev) => ({
                                ...prev,
                                [comp.id]: Number(e.target.value),
                              }))
                            }
                            disabled={!canEditSelectedGrade}
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-mono tabular-nums disabled:bg-slate-100"
                          />
                        </div>
                      ))}
                  </div>

                  <button
                    type="submit"
                    disabled={!canEditSelectedGrade}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#0F4C81] px-4 py-2 text-sm font-medium text-white hover:bg-[#0C3D68] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" aria-hidden="true" />
                    Simpan Nilai Akademik
                  </button>
                </form>
              </section>
            )}

            {/* Komponen Penilaian Konfigurasi */}
            <section
              className={`rounded-xl border border-slate-200 bg-white p-6 ${
                isTeacherOrPrincipal ? 'lg:col-span-7' : 'lg:col-span-12'
              }`}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Sliders className="h-5 w-5 text-[#0F4C81]" aria-hidden="true" />
                  <h2 className="text-base font-semibold text-slate-900">
                    Konfigurasi Komponen Penilaian
                  </h2>
                </div>
                <span className="text-xs font-mono text-slate-600 tabular-nums">
                  Total Aktif:{' '}
                  {draftComponents
                    .filter((c) => c.isActive)
                    .reduce((s, c) => s + c.weightPercent, 0)}
                  %
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Bobot komponen penilaian dapat disesuaikan sesuai kebijakan sekolah (total bobot aktif harus 100%).
              </p>

              <div className="mt-4 divide-y divide-slate-100">
                {draftComponents.map((comp, idx) => (
                  <div
                    key={comp.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-2.5"
                  >
                    <div className="flex items-center gap-3 min-w-[200px] flex-1">
                      <input
                        type="checkbox"
                        checked={comp.isActive}
                        disabled={!canManageAcademicMaster}
                        aria-label={`Aktifkan ${comp.name}`}
                        onChange={(e) => {
                          const next = [...draftComponents];
                          next[idx] = { ...comp, isActive: e.target.checked };
                          setDraftComponents(next);
                        }}
                      />
                      <input
                        type="text"
                        value={comp.name}
                        disabled={!canManageAcademicMaster}
                        aria-label={`Nama komponen ${comp.name}`}
                        onChange={(e) => {
                          const next = [...draftComponents];
                          next[idx] = { ...comp, name: e.target.value };
                          setDraftComponents(next);
                        }}
                        className="w-full rounded border border-slate-200 px-2.5 py-1 text-sm disabled:bg-slate-50"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={comp.weightPercent}
                        disabled={!canManageAcademicMaster}
                        aria-label={`Bobot ${comp.name}`}
                        onChange={(e) => {
                          const next = [...draftComponents];
                          next[idx] = { ...comp, weightPercent: Number(e.target.value) };
                          setDraftComponents(next);
                        }}
                        className="w-20 rounded border border-slate-200 px-2.5 py-1 text-right text-sm font-mono tabular-nums disabled:bg-slate-50"
                      />
                      <span className="text-xs text-slate-500">%</span>
                    </div>
                  </div>
                ))}
              </div>

              {canManageAcademicMaster && (
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveComponents}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Save className="h-3.5 w-3.5" aria-hidden="true" />
                    Simpan Komponen Penilaian
                  </button>
                </div>
              )}
            </section>
          </div>

          {/* Rekap Nilai Per Siswa, Kelas, dan Mata Pelajaran + Ekspor Excel/PDF */}
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Rekap Nilai Akademik (Per Siswa, Kelas & Mata Pelajaran)
                </h2>
                <p className="text-xs text-slate-500">
                  Menampilkan nilai sesuai hak akses peran ({currentUser.role.replace('_', ' ')}).
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={filterClassId}
                  onChange={(e) => setFilterClassId(e.target.value)}
                  aria-label="Filter kelas rekap nilai"
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
                  value={filterSubjectId}
                  onChange={(e) => setFilterSubjectId(e.target.value)}
                  aria-label="Filter mapel rekap nilai"
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
                  value={filterStudentId}
                  onChange={(e) => setFilterStudentId(e.target.value)}
                  aria-label="Filter siswa rekap nilai"
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
                >
                  <option value="all">Semua Siswa</option>
                  {students.map((st) => (
                    <option key={st.uid} value={st.uid}>
                      {st.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => exportGradesToExcel(buildExportRows())}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
                  Ekspor Excel
                </button>
                <button
                  type="button"
                  onClick={() =>
                    exportGradesToPdf(
                      buildExportRows(),
                      data.school.name,
                      `Rekap Nilai Akademik · Dicetak oleh ${currentUser.name}`
                    )
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F4C81] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#0C3D68] whitespace-nowrap"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  Ekspor PDF
                </button>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                    <th className="py-2.5 pr-4">Siswa</th>
                    <th className="py-2.5 pr-4">Kelas</th>
                    <th className="py-2.5 pr-4">Mata Pelajaran</th>
                    {data.assessmentComponents
                      .filter((c) => c.isActive)
                      .map((c) => (
                        <th key={c.id} className="py-2.5 pr-4 text-right whitespace-nowrap">
                          {c.name} ({c.weightPercent}%)
                        </th>
                      ))}
                    <th className="py-2.5 pr-4 text-right">Nilai Akhir</th>
                    <th className="py-2.5 text-right">Status KKM</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleGrades.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5 + data.assessmentComponents.filter((c) => c.isActive).length}
                        className="py-6 text-center text-sm text-slate-500"
                      >
                        Tidak ada data nilai yang sesuai filter atau hak akses Anda.
                      </td>
                    </tr>
                  ) : (
                    visibleGrades.map((grd) => {
                      const student = data.users.find((u) => u.uid === grd.studentId);
                      const cls = data.classes.find((c) => c.id === grd.classId);
                      const subj = data.subjects.find((s) => s.id === grd.subjectId);
                      const kkm = subj?.kkm ?? 75;
                      const passed = grd.finalScore >= kkm;
                      return (
                        <tr key={grd.id} className="hover:bg-slate-50/70">
                          <td className="py-2.5 pr-4 font-medium text-slate-900">
                            {student?.name || grd.studentId}
                          </td>
                          <td className="py-2.5 pr-4 text-slate-600">{cls?.name || grd.classId}</td>
                          <td className="py-2.5 pr-4 text-slate-700">
                            {subj?.name || grd.subjectId}
                          </td>
                          {data.assessmentComponents
                            .filter((c) => c.isActive)
                            .map((c) => (
                              <td
                                key={c.id}
                                className="py-2.5 pr-4 text-right font-mono tabular-nums text-slate-600"
                              >
                                {grd.scores[c.id] ?? '-'}
                              </td>
                            ))}
                          <td className="py-2.5 pr-4 text-right font-mono font-bold tabular-nums text-slate-900">
                            {grd.finalScore.toFixed(1)}
                          </td>
                          <td
                            className={`py-2.5 text-right text-xs font-semibold ${
                              passed ? 'text-emerald-700' : 'text-amber-700'
                            }`}
                          >
                            {passed ? `Tuntas (≥${kkm})` : `Di Bawah KKM (${kkm})`}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
