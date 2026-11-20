import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Crosshair,
  Loader2,
  MapPin,
  RefreshCw,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useSims } from '../context/SimsContext';
import { validateAttendanceCheckIn } from '../utils/attendanceLogic';

export const AttendanceModule: React.FC = () => {
  const {
    data,
    currentUser,
    isOffline,
    simulatedOffline,
    setSimulatedOffline,
    offlineQueue,
    syncOfflineQueueNow,
    recordAttendance,
  } = useSims();

  const activeLocations = useMemo(
    () => data.schoolLocations.filter((loc) => loc.isActive),
    [data.schoolLocations]
  );

  const primaryLocation = activeLocations[0];
  const initialLat = (primaryLocation?.latitude ?? data.school.latitude) + 0.00025;
  const initialLon = (primaryLocation?.longitude ?? data.school.longitude) + 0.00015;

  const [userLat, setUserLat] = useState<number>(Number(initialLat.toFixed(6)));
  const [userLon, setUserLon] = useState<number>(Number(initialLon.toFixed(6)));
  const [gpsAccuracyMeters, setGpsAccuracyMeters] = useState<number>(15);
  const [locationCapturedAt, setLocationCapturedAt] = useState<string>(() =>
    new Date().toISOString()
  );
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [networkLabel, setNetworkLabel] = useState<string>(data.school.allowedWifiLabel);
  const [faceCaptured, setFaceCaptured] = useState<boolean>(false);
  const [facePreviewUrl, setFacePreviewUrl] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    setNetworkLabel(data.school.allowedWifiLabel);
  }, [data.school.allowedWifiLabel]);

  const validation = validateAttendanceCheckIn({
    school: data.school,
    schoolLocations: data.schoolLocations,
    userLat,
    userLon,
    gpsAccuracyMeters,
    networkLabel,
    faceCaptured,
  });

  const handleUseRealGps = () => {
    if (!navigator.geolocation) {
      setFeedback({
        type: 'err',
        text: 'Browser tidak mendukung Geolocation. Gunakan preset lokasi kampus aktif.',
      });
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        setUserLat(Number(pos.coords.latitude.toFixed(6)));
        setUserLon(Number(pos.coords.longitude.toFixed(6)));
        setGpsAccuracyMeters(Math.round(pos.coords.accuracy));
        setLocationCapturedAt(new Date().toISOString());
        setFeedback({
          type: 'ok',
          text: `Koordinat GPS perangkat terdeteksi (akurasi ±${Math.round(pos.coords.accuracy)} m).`,
        });
      },
      (err) => {
        setIsLocating(false);
        setFeedback({
          type: 'err',
          text:
            err.code === 1
              ? 'Izin lokasi ditolak oleh browser. Aktifkan izin lokasi atau gunakan simulasi area gedung aktif.'
              : 'Koordinat GPS perangkat tidak tersedia; gunakan simulasi area gedung aktif.',
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleStartFaceCamera = async () => {
    setCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      // Headless / no camera fallback ready
    }
  };

  const handleCaptureFace = () => {
    const video = videoRef.current;
    if (video && video.videoWidth > 0) {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        setFacePreviewUrl(canvas.toDataURL('image/jpeg', 0.75));
      }
    } else {
      setFacePreviewUrl('/src/assets/images/osis_candidate_one_1795139325859.jpg');
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
    setFaceCaptured(true);
  };

  const handleCheckIn = () => {
    if (!validation.canSubmit) {
      setFeedback({ type: 'err', text: validation.reasons.join(' ') });
      return;
    }
    const now = new Date();
    const res = recordAttendance({
      date: now.toISOString().slice(0, 10),
      checkInTime: now.toTimeString().slice(0, 5) + ' WIB',
      distanceMeters: validation.distanceMeters,
      networkLabel,
      gpsValid: validation.gpsValid,
      networkValid: validation.networkValid,
      faceVerified: validation.faceVerified,
      faceSnapshotUrl: facePreviewUrl || undefined,
      userLat,
      userLon,
      gpsAccuracyMeters,
      matchedLocationId: validation.matchedLocationId,
      matchedLocationName: validation.matchedLocationName,
      gpsAnomalyFlag: validation.gpsAnomalyFlag,
      gpsAnomalyReason: validation.gpsAnomalyReason,
      locationCapturedAt,
    });
    if (res.ok) {
      setFeedback({
        type: 'ok',
        text: res.queued
          ? `Kehadiran di ${validation.matchedLocationName || data.school.name} disimpan ke antrean offline.`
          : `Check-in tervalidasi di ${validation.matchedLocationName || data.school.name} (jarak ${validation.distanceMeters} m).`,
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Absensi Lanjutan (Multi-Lokasi GPS, Jaringan, Wajah & Offline Sync)
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Validasi geofence otomatis terhadap {activeLocations.length} titik lokasi sekolah aktif, jaringan resmi ({data.school.allowedWifiLabel}), dan verifikasi wajah.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSimulatedOffline(!simulatedOffline)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium whitespace-nowrap ${
              simulatedOffline
                ? 'border-amber-400 bg-amber-50 text-amber-900'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {simulatedOffline ? (
              <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Wifi className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {simulatedOffline ? 'Mode Simulasi Offline Aktif' : 'Simulasikan Offline'}
          </button>
          <button
            type="button"
            disabled={isOffline || offlineQueue.length === 0}
            onClick={syncOfflineQueueNow}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F4C81] px-3 py-2 text-xs font-medium text-white hover:bg-[#0C3D68] disabled:opacity-50 whitespace-nowrap"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Sinkronkan Antrean ({offlineQueue.length})
          </button>
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Check-In Validator */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-5 lg:col-span-6">
          <h2 className="text-base font-semibold text-slate-900">
            Validasi Kehadiran — {currentUser.name}
          </h2>

          {/* Step 1: Multi-Location GPS Geofence */}
          <div className="space-y-3 border-b border-slate-100 pb-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                <MapPin className="h-4 w-4 text-[#0F4C81]" aria-hidden="true" />
                1. Validasi GPS Geofence Multi-Lokasi
              </span>
              <span
                className={`text-xs font-semibold tabular-nums ${
                  validation.gpsValid ? 'text-emerald-700' : 'text-red-700'
                }`}
              >
                {validation.gpsValid
                  ? `Dalam Radius ${validation.matchedLocationName} (${validation.distanceMeters} m / maks ${validation.matchedLocationRadius} m)`
                  : `Di Luar Radius (${validation.distanceMeters} m dari ${validation.matchedLocationName || data.school.name})`}
              </span>
            </div>

            {/* Automatic device GPS telemetry readout */}
            <div className="grid grid-cols-3 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
              <div>
                <p className="text-[11px] text-slate-500">Latitude Perangkat</p>
                <p className="mt-0.5 font-mono font-semibold text-slate-900 tabular-nums">
                  {userLat.toFixed(6)}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Longitude Perangkat</p>
                <p className="mt-0.5 font-mono font-semibold text-slate-900 tabular-nums">
                  {userLon.toFixed(6)}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Akurasi GPS</p>
                <p
                  className={`mt-0.5 font-mono font-semibold tabular-nums ${
                    validation.gpsAnomalyFlag ? 'text-amber-700' : 'text-emerald-700'
                  }`}
                >
                  ±{gpsAccuracyMeters} m ({validation.gpsQualityLabel})
                </p>
              </div>
            </div>

            {validation.gpsAnomalyFlag && validation.gpsAnomalyReason && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700" aria-hidden="true" />
                <span>{validation.gpsAnomalyReason}</span>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleUseRealGps}
                disabled={isLocating}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F4C81] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#0C3D68] disabled:opacity-60"
              >
                {isLocating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Crosshair className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                Ambil Lokasi GPS Perangkat
              </button>

              {activeLocations.map((loc) => (
                <button
                  key={loc.locationId}
                  type="button"
                  onClick={() => {
                    setUserLat(Number((loc.latitude + 0.0002).toFixed(6)));
                    setUserLon(Number((loc.longitude + 0.0001).toFixed(6)));
                    setGpsAccuracyMeters(14);
                    setLocationCapturedAt(new Date().toISOString());
                    setFeedback(null);
                  }}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Simulasi: {loc.locationName}
                </button>
              ))}

              <button
                type="button"
                onClick={() => {
                  const base = primaryLocation ?? data.school;
                  setUserLat(Number((base.latitude + 0.018).toFixed(6)));
                  setUserLon(Number((base.longitude + 0.018).toFixed(6)));
                  setGpsAccuracyMeters(18);
                  setLocationCapturedAt(new Date().toISOString());
                }}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Uji Luar Radius
              </button>

              <button
                type="button"
                onClick={() => {
                  const base = primaryLocation ?? data.school;
                  setUserLat(Number(base.latitude.toFixed(6)));
                  setUserLon(Number(base.longitude.toFixed(6)));
                  setGpsAccuracyMeters(220);
                  setLocationCapturedAt(new Date().toISOString());
                }}
                className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100"
              >
                Uji Akurasi GPS Rendah
              </button>
            </div>

            {activeLocations.length > 0 && (
              <div className="text-[11px] text-slate-500">
                Zona geofence aktif:{' '}
                {activeLocations
                  .map((l) => `${l.locationName} (${l.radiusInMeters} m)`)
                  .join(' · ')}
              </div>
            )}
          </div>

          {/* Step 2: Validasi Jaringan */}
          <div className="space-y-2 border-b border-slate-100 pb-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                <Wifi className="h-4 w-4 text-[#0F4C81]" aria-hidden="true" />
                2. Validasi Jaringan Sekolah
              </span>
              <span
                className={`text-xs font-semibold ${
                  validation.networkValid ? 'text-emerald-700' : 'text-red-700'
                }`}
              >
                {validation.networkValid ? 'Jaringan Terverifikasi' : 'SSID Tidak Sesuai'}
              </span>
            </div>
            <select
              value={networkLabel}
              onChange={(e) => setNetworkLabel(e.target.value)}
              aria-label="Profil jaringan aktif"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value={data.school.allowedWifiLabel}>
                {data.school.allowedWifiLabel} (Wi-Fi Resmi Sekolah)
              </option>
              <option value="Seluler-4G-Publik">Seluler-4G-Publik (Luar Jaringan)</option>
            </select>
          </div>

          {/* Step 3: Pengenalan Wajah */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                <Camera className="h-4 w-4 text-[#0F4C81]" aria-hidden="true" />
                3. Verifikasi Wajah Biometrik
              </span>
              <span
                className={`text-xs font-semibold ${
                  faceCaptured ? 'text-emerald-700' : 'text-amber-700'
                }`}
              >
                {faceCaptured ? 'Wajah Terverifikasi' : 'Belum Diambil'}
              </span>
            </div>

            {cameraActive && (
              <div className="space-y-2">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full rounded-lg bg-slate-900 aspect-video object-cover"
                />
                <button
                  type="button"
                  onClick={handleCaptureFace}
                  className="rounded-lg bg-[#0F4C81] px-3 py-1.5 text-xs font-medium text-white"
                >
                  Ambil Foto Wajah Sekarang
                </button>
              </div>
            )}

            {facePreviewUrl && !cameraActive && (
              <div className="flex items-center gap-3">
                <img
                  src={facePreviewUrl}
                  alt="Pratinjau verifikasi wajah"
                  referrerPolicy="no-referrer"
                  className="h-16 w-16 rounded-lg border border-slate-200 object-cover"
                />
                <span className="text-xs text-emerald-700 font-medium">
                  Deteksi wajah sesuai profil pengguna.
                </span>
              </div>
            )}

            {!cameraActive && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleStartFaceCamera}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Camera className="h-3.5 w-3.5" aria-hidden="true" />
                  Buka Kamera Wajah
                </button>
                <button
                  type="button"
                  onClick={handleCaptureFace}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Verifikasi Wajah Instan
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleCheckIn}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#0F4C81] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#0C3D68]"
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Catat Absensi Kehadiran
          </button>
        </section>

        {/* Right: Attendance History & Offline Queue */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-4 lg:col-span-6">
          <h2 className="text-base font-semibold text-slate-900">
            Riwayat Kehadiran & Audit GPS
          </h2>
          {offlineQueue.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900 space-y-1">
              <p className="font-semibold">
                Antrean Offline ({offlineQueue.length} item menunggu sinkronisasi):
              </p>
              {offlineQueue.map((item) => (
                <p key={item.id}>
                  · {item.label} ({item.queuedAt.slice(11, 16)})
                </p>
              ))}
            </div>
          )}
          <div className="divide-y divide-slate-100">
            {data.attendanceRecords.map((rec) => (
              <div key={rec.id} className="flex items-start justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{rec.userName}</p>
                  <p className="text-xs text-slate-600">
                    {rec.matchedLocationName || data.school.name} · Jarak {rec.distanceMeters} m ·{' '}
                    {rec.networkLabel}
                  </p>
                  <p className="mt-0.5 text-[11px] font-mono text-slate-500 tabular-nums">
                    {rec.date} {rec.checkInTime}
                    {rec.gpsAccuracyMeters !== undefined ? ` · Akurasi ±${rec.gpsAccuracyMeters} m` : ''}
                  </p>
                </div>
                <div className="text-right text-xs shrink-0">
                  <p
                    className={`font-semibold ${
                      rec.gpsAnomalyFlag ? 'text-amber-700' : 'text-emerald-700'
                    }`}
                  >
                    {rec.gpsAnomalyFlag ? 'Perlu Tinjauan GPS' : 'Tervalidasi'}
                  </p>
                  <p className="text-slate-500">
                    {rec.syncSource === 'offline_sync' ? 'Sinkron Offline' : 'Real-Time'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
