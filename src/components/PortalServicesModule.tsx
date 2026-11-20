import React, { useState } from 'react';
import {
  Award,
  BookMarked,
  CheckCircle2,
  ClipboardCheck,
  MessageSquare,
  UserPlus,
  Vote,
} from 'lucide-react';
import { useSims } from '../context/SimsContext';
import type { PpdbRegistration } from '../types/sims';

type PortalTab = 'portal_survei' | 'ppdb' | 'osis' | 'buku_tamu';

export const PortalServicesModule: React.FC = () => {
  const {
    data,
    currentUser,
    addPpdbRegistration,
    updatePpdbStatus,
    submitSurveyResponse,
    castOsisVote,
    addGuestbookEntry,
    checkoutGuestbookEntry,
  } = useSims();

  const [tab, setTab] = useState<PortalTab>('portal_survei');
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // PPDB form
  const [ppdbName, setPpdbName] = useState('');
  const [ppdbNisn, setPpdbNisn] = useState('');
  const [ppdbTrack, setPpdbTrack] = useState<PpdbRegistration['track']>('Zonasi');
  const [ppdbPrevSchool, setPpdbPrevSchool] = useState('');
  const [ppdbPhone, setPpdbPhone] = useState('');
  const [ppdbAvg, setPpdbAvg] = useState(88);

  // Survey state
  const activeSurvey = data.surveys[0];
  const [surveyRatings, setSurveyRatings] = useState<Record<string, number>>({
    q1: 5,
    q2: 5,
    q3: 5,
  });
  const [surveyComment, setSurveyComment] = useState('');

  // Guestbook form
  const [gbName, setGbName] = useState('');
  const [gbInst, setGbInst] = useState('');
  const [gbPurpose, setGbPurpose] = useState('');
  const [gbHost, setGbHost] = useState('');

  const canVerifyPpdb =
    currentUser.role === 'school_admin' ||
    currentUser.role === 'principal' ||
    currentUser.role === 'staff';
  const hasVotedOsis = data.osisVotes.some((v) => v.voterId === currentUser.uid);

  const totalVotes = data.osisVotes.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Portal Sekolah, PPDB, Survei, OSIS & Buku Tamu
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Layanan publik dan partisipasi warga sekolah terintegrasi dalam satu portal.
          </p>
        </div>
        <div
          role="tablist"
          aria-label="Navigasi Layanan Portal"
          className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1"
        >
          {(
            [
              ['portal_survei', 'Portal & Survei'],
              ['ppdb', 'PPDB Online'],
              ['osis', 'Pemilihan OSIS'],
              ['buku_tamu', 'Buku Tamu'],
            ] as [PortalTab, string][]
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

      {/* TAB 1: PORTAL SEKOLAH & SURVEI */}
      {tab === 'portal_survei' && (
        <div className="space-y-6">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
              <div className="p-6 lg:col-span-6 flex flex-col justify-center">
                <p className="text-xs font-medium text-slate-500">
                  NPSN {data.school.npsn} · {data.school.address}
                </p>
                <h2 className="mt-2 text-2xl font-bold text-slate-900">
                  {data.school.name}
                </h2>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  Pusat informasi resmi akademik, pengumuman kegiatan siswa, penerimaan peserta didik baru, dan aspirasi warga sekolah.
                </p>
              </div>
              <div className="lg:col-span-6 min-h-[220px] bg-slate-100">
                <img
                  src="/src/assets/images/school_campus_hero_1795139323991.jpg"
                  alt="Gedung kampus SMA Nusantara Cendekia"
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <section className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-6">
              <div className="flex items-center gap-2">
                <BookMarked className="h-5 w-5 text-[#0F4C81]" aria-hidden="true" />
                <h3 className="text-base font-semibold text-slate-900">
                  Pengumuman & Berita Sekolah
                </h3>
              </div>
              <div className="mt-4 divide-y divide-slate-100">
                {data.announcements.map((ann) => (
                  <article key={ann.id} className="py-4 first:pt-0 last:pb-0">
                    <p className="text-xs text-slate-500">
                      {ann.category} · {ann.publishedAt} · {ann.authorName}
                    </p>
                    <h4 className="mt-1 text-sm font-semibold text-slate-900">{ann.title}</h4>
                    <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                      {ann.content}
                    </p>
                  </article>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-6">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-[#0F4C81]" aria-hidden="true" />
                <h3 className="text-base font-semibold text-slate-900">
                  {activeSurvey?.title || 'Survei Layanan Sekolah'}
                </h3>
              </div>
              {activeSurvey && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    submitSurveyResponse(activeSurvey.id, surveyRatings, surveyComment);
                    setSurveyComment('');
                    setFeedback({
                      type: 'ok',
                      text: 'Tanggapan survei Anda berhasil disimpan.',
                    });
                  }}
                  className="mt-4 space-y-4"
                >
                  {activeSurvey.questions.map((q) => (
                    <div key={q.id} className="space-y-1.5">
                      <p className="text-xs font-medium text-slate-700">{q.text}</p>
                      <div className="flex items-center gap-2">
                        {[1, 2, 3, 4, 5].map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() =>
                              setSurveyRatings((prev) => ({ ...prev, [q.id]: val }))
                            }
                            className={`h-8 w-8 rounded-lg border text-xs font-mono font-semibold ${
                              surveyRatings[q.id] === val
                                ? 'border-[#0F4C81] bg-[#0F4C81] text-white'
                                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            {val}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div>
                    <label
                      htmlFor="survey-comment"
                      className="block text-xs font-medium text-slate-700"
                    >
                      Saran & Masukan
                    </label>
                    <textarea
                      id="survey-comment"
                      rows={2}
                      value={surveyComment}
                      onChange={(e) => setSurveyComment(e.target.value)}
                      placeholder="Tuliskan masukan Anda untuk peningkatan layanan sekolah..."
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs text-slate-500 tabular-nums">
                      Total responden: {data.surveyResponses.length}
                    </span>
                    <button
                      type="submit"
                      className="rounded-lg bg-[#0F4C81] px-4 py-2 text-xs font-medium text-white hover:bg-[#0C3D68]"
                    >
                      Kirim Survei
                    </button>
                  </div>
                </form>
              )}
            </section>
          </div>
        </div>
      )}

      {/* TAB 2: PPDB ONLINE */}
      {tab === 'ppdb' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <section className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-5">
            <div className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-[#0F4C81]" aria-hidden="true" />
              <h2 className="text-base font-semibold text-slate-900">
                Formulir Pendaftaran PPDB Baru
              </h2>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const code = addPpdbRegistration({
                  applicantName: ppdbName.trim(),
                  nisn: ppdbNisn.trim(),
                  track: ppdbTrack,
                  previousSchool: ppdbPrevSchool.trim(),
                  parentPhone: ppdbPhone.trim(),
                  averageScore: Number(ppdbAvg),
                });
                setPpdbName('');
                setPpdbNisn('');
                setPpdbPrevSchool('');
                setPpdbPhone('');
                setFeedback({
                  type: 'ok',
                  text: `Pendaftaran berhasil dikirim dengan nomor registrasi ${code}.`,
                });
              }}
              className="mt-4 space-y-3"
            >
              <div>
                <label htmlFor="ppdb-name" className="block text-xs font-medium text-slate-700">
                  Nama Lengkap Calon Siswa
                </label>
                <input
                  id="ppdb-name"
                  type="text"
                  required
                  value={ppdbName}
                  onChange={(e) => setPpdbName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="ppdb-nisn" className="block text-xs font-medium text-slate-700">
                    NISN
                  </label>
                  <input
                    id="ppdb-nisn"
                    type="text"
                    required
                    value={ppdbNisn}
                    onChange={(e) => setPpdbNisn(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="ppdb-track" className="block text-xs font-medium text-slate-700">
                    Jalur Seleksi
                  </label>
                  <select
                    id="ppdb-track"
                    value={ppdbTrack}
                    onChange={(e) =>
                      setPpdbTrack(e.target.value as PpdbRegistration['track'])
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="Zonasi">Zonasi</option>
                    <option value="Prestasi">Prestasi</option>
                    <option value="Afirmasi">Afirmasi</option>
                    <option value="Perpindahan">Perpindahan</option>
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="ppdb-prev" className="block text-xs font-medium text-slate-700">
                  Sekolah Asal (SMP/MTs)
                </label>
                <input
                  id="ppdb-prev"
                  type="text"
                  required
                  value={ppdbPrevSchool}
                  onChange={(e) => setPpdbPrevSchool(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="ppdb-phone" className="block text-xs font-medium text-slate-700">
                    No. HP Orang Tua
                  </label>
                  <input
                    id="ppdb-phone"
                    type="tel"
                    required
                    value={ppdbPhone}
                    onChange={(e) => setPpdbPhone(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="ppdb-avg" className="block text-xs font-medium text-slate-700">
                    Rata-Rata Nilai
                  </label>
                  <input
                    id="ppdb-avg"
                    type="number"
                    step="0.1"
                    min={0}
                    max={100}
                    value={ppdbAvg}
                    onChange={(e) => setPpdbAvg(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full rounded-lg bg-[#0F4C81] px-4 py-2 text-sm font-medium text-white hover:bg-[#0C3D68]"
              >
                Kirim Pendaftaran PPDB
              </button>
            </form>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-7">
            <h2 className="text-base font-semibold text-slate-900">
              Daftar Calon Peserta Didik ({data.ppdbRegistrations.length})
            </h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                    <th className="py-2 pr-3">Kode</th>
                    <th className="py-2 pr-3">Nama & Asal</th>
                    <th className="py-2 pr-3">Jalur</th>
                    <th className="py-2 pr-3 text-right">Nilai</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.ppdbRegistrations.map((reg) => (
                    <tr key={reg.id}>
                      <td className="py-2.5 pr-3 font-mono text-xs text-slate-600">
                        {reg.registrationCode}
                      </td>
                      <td className="py-2.5 pr-3">
                        <p className="font-medium text-slate-900">{reg.applicantName}</p>
                        <p className="text-xs text-slate-500">
                          NISN {reg.nisn} · {reg.previousSchool}
                        </p>
                      </td>
                      <td className="py-2.5 pr-3 text-xs text-slate-700">{reg.track}</td>
                      <td className="py-2.5 pr-3 text-right font-mono tabular-nums">
                        {reg.averageScore.toFixed(1)}
                      </td>
                      <td className="py-2.5">
                        {canVerifyPpdb ? (
                          <select
                            value={reg.status}
                            aria-label={`Status PPDB ${reg.applicantName}`}
                            onChange={(e) =>
                              updatePpdbStatus(
                                reg.id,
                                e.target.value as PpdbRegistration['status']
                              )
                            }
                            className="rounded border border-slate-300 px-2 py-1 text-xs"
                          >
                            <option value="menunggu">Menunggu</option>
                            <option value="terverifikasi">Terverifikasi</option>
                            <option value="diterima">Diterima</option>
                            <option value="ditolak">Ditolak</option>
                          </select>
                        ) : (
                          <span className="text-xs font-semibold capitalize text-slate-700">
                            {reg.status}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* TAB 3: PEMILIHAN KETUA OSIS */}
      {tab === 'osis' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5 text-[#0F4C81]" aria-hidden="true" />
                <h2 className="text-base font-semibold text-slate-900">
                  Pemilihan Ketua & Wakil Ketua OSIS (1 Akun = 1 Suara)
                </h2>
              </div>
              <span className="text-xs font-mono text-slate-600 tabular-nums">
                Total Suara Masuk: {totalVotes}
              </span>
            </div>
            {hasVotedOsis && (
              <p className="mt-2 text-xs font-medium text-emerald-700">
                Hak suara untuk akun {currentUser.name} sudah digunakan dan terkunci.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {data.osisCandidates.map((cand) => {
              const votes = data.osisVotes.filter((v) => v.candidateId === cand.id).length;
              const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
              return (
                <div
                  key={cand.id}
                  className="overflow-hidden rounded-xl border border-slate-200 bg-white flex flex-col"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-3 items-stretch">
                    <div className="bg-slate-100 min-h-[200px]">
                      <img
                        src={cand.photoUrl}
                        alt={`Paslon ${cand.number} ${cand.chairName}`}
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="p-5 sm:col-span-2 flex flex-col justify-between">
                      <div>
                        <p className="text-xs font-medium text-slate-500">
                          Pasangan Calon No. {cand.number} · {cand.classLabel}
                        </p>
                        <h3 className="mt-1 text-lg font-bold text-slate-900">
                          {cand.chairName} & {cand.viceName}
                        </h3>
                        <p className="mt-2 text-xs text-slate-700 leading-relaxed">
                          <strong>Visi:</strong> {cand.vision}
                        </p>
                        <ul className="mt-2 list-disc pl-4 text-xs text-slate-600 space-y-1">
                          {cand.mission.map((m, idx) => (
                            <li key={idx}>{m}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                        <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                          <span className="text-slate-600">Perolehan Suara</span>
                          <span className="font-semibold text-slate-900">
                            {votes} suara ({pct}%)
                          </span>
                        </div>
                        <div className="h-2 w-full rounded bg-slate-100 overflow-hidden">
                          <div
                            className="h-full bg-[#0F4C81]"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <button
                          type="button"
                          disabled={hasVotedOsis}
                          onClick={() => {
                            const res = castOsisVote(cand.id);
                            setFeedback(
                              res.ok
                                ? {
                                    type: 'ok',
                                    text: `Suara untuk Paslon ${cand.number} berhasil dicatat.`,
                                  }
                                : { type: 'err', text: res.error || 'Gagal memilih.' }
                            );
                          }}
                          className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#0F4C81] px-4 py-2 text-xs font-medium text-white hover:bg-[#0C3D68] disabled:cursor-not-allowed disabled:bg-slate-300"
                        >
                          <Vote className="h-4 w-4" aria-hidden="true" />
                          {hasVotedOsis ? 'Suara Sudah Digunakan' : `Pilih Paslon ${cand.number}`}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: BUKU TAMU DIGITAL */}
      {tab === 'buku_tamu' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <section className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-5">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-[#0F4C81]" aria-hidden="true" />
              <h2 className="text-base font-semibold text-slate-900">
                Catat Kunjungan Buku Tamu Digital
              </h2>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                addGuestbookEntry({
                  visitorName: gbName.trim(),
                  institution: gbInst.trim(),
                  purpose: gbPurpose.trim(),
                  hostName: gbHost.trim(),
                });
                setGbName('');
                setGbInst('');
                setGbPurpose('');
                setGbHost('');
                setFeedback({
                  type: 'ok',
                  text: 'Kunjungan tamu berhasil dicatat pada Buku Tamu Digital.',
                });
              }}
              className="mt-4 space-y-3"
            >
              <div>
                <label htmlFor="gb-name" className="block text-xs font-medium text-slate-700">
                  Nama Lengkap Tamu
                </label>
                <input
                  id="gb-name"
                  type="text"
                  required
                  value={gbName}
                  onChange={(e) => setGbName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="gb-inst" className="block text-xs font-medium text-slate-700">
                  Instansi / Keterangan (Orang Tua / Dinas / Mitra)
                </label>
                <input
                  id="gb-inst"
                  type="text"
                  required
                  value={gbInst}
                  onChange={(e) => setGbInst(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="gb-host" className="block text-xs font-medium text-slate-700">
                  Menemui
                </label>
                <input
                  id="gb-host"
                  type="text"
                  required
                  value={gbHost}
                  onChange={(e) => setGbHost(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="gb-purpose" className="block text-xs font-medium text-slate-700">
                  Keperluan Kunjungan
                </label>
                <textarea
                  id="gb-purpose"
                  rows={2}
                  required
                  value={gbPurpose}
                  onChange={(e) => setGbPurpose(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-lg bg-[#0F4C81] px-4 py-2 text-sm font-medium text-white hover:bg-[#0C3D68]"
              >
                Catat Check-In Tamu
              </button>
            </form>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-7">
            <h2 className="text-base font-semibold text-slate-900">
              Daftar Kunjungan Tamu ({data.guestbookEntries.length})
            </h2>
            <div className="mt-4 divide-y divide-slate-100">
              {data.guestbookEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex flex-col gap-2 py-3.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {entry.visitorName}{' '}
                      <span className="font-normal text-xs text-slate-500">
                        · {entry.institution}
                      </span>
                    </p>
                    <p className="text-xs text-slate-600">
                      Keperluan: {entry.purpose} · Menemui: {entry.hostName}
                    </p>
                    <p className="mt-0.5 text-xs font-mono text-slate-500 tabular-nums">
                      Masuk: {entry.checkInAt.slice(0, 16).replace('T', ' ')}
                      {entry.checkOutAt
                        ? ` · Keluar: ${entry.checkOutAt.slice(0, 16).replace('T', ' ')}`
                        : ''}
                    </p>
                  </div>
                  <div className="shrink-0">
                    {entry.status === 'bertamu' ? (
                      <button
                        type="button"
                        onClick={() => checkoutGuestbookEntry(entry.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
                        Tandai Selesai
                      </button>
                    ) : (
                      <span className="text-xs font-semibold text-emerald-700">Selesai</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
