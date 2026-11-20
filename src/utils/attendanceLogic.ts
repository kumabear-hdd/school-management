import type { School, SchoolLocation } from '../types/sims';

export function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export function validateSchoolLocationInput(input: {
  locationName: string;
  address: string;
  latitude: number;
  longitude: number;
  radiusInMeters: number;
}): { valid: boolean; error?: string } {
  const name = input.locationName.trim();
  const address = input.address.trim();

  if (name.length < 2 || name.length > 120) {
    return { valid: false, error: 'Nama lokasi harus antara 2 hingga 120 karakter.' };
  }
  if (address.length < 3 || address.length > 300) {
    return {
      valid: false,
      error: 'Alamat lokasi harus antara 3 hingga 300 karakter. Pilih titik pada peta untuk mengisi alamat.',
    };
  }
  if (!Number.isFinite(input.latitude) || input.latitude < -90 || input.latitude > 90) {
    return { valid: false, error: 'Koordinat latitude tidak valid.' };
  }
  if (!Number.isFinite(input.longitude) || input.longitude < -180 || input.longitude > 180) {
    return { valid: false, error: 'Koordinat longitude tidak valid.' };
  }
  if (
    !Number.isFinite(input.radiusInMeters) ||
    input.radiusInMeters < 10 ||
    input.radiusInMeters > 5000
  ) {
    return { valid: false, error: 'Radius geofence harus antara 10 sampai 5000 meter.' };
  }
  return { valid: true };
}

export function assessGpsQuality(params: {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
}): {
  coordinatesValid: boolean;
  isAnomaly: boolean;
  qualityLabel: 'Akurat' | 'Kurang Akurat' | 'Anomali';
  reason?: string;
} {
  const { latitude, longitude, accuracyMeters } = params;
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return {
      coordinatesValid: false,
      isAnomaly: true,
      qualityLabel: 'Anomali',
      reason: 'Koordinat GPS berada di luar rentang geografis yang valid.',
    };
  }

  if (Math.abs(latitude) < 0.0001 && Math.abs(longitude) < 0.0001) {
    return {
      coordinatesValid: false,
      isAnomaly: true,
      qualityLabel: 'Anomali',
      reason: 'Koordinat terdeteksi pada titik nol (0,0) dan ditandai sebagai anomali GPS.',
    };
  }

  if (accuracyMeters !== undefined && (!Number.isFinite(accuracyMeters) || accuracyMeters < 0)) {
    return {
      coordinatesValid: true,
      isAnomaly: true,
      qualityLabel: 'Anomali',
      reason: 'Nilai akurasi GPS perangkat tidak valid.',
    };
  }

  if (accuracyMeters !== undefined && accuracyMeters > 100) {
    return {
      coordinatesValid: true,
      isAnomaly: true,
      qualityLabel: 'Kurang Akurat',
      reason: `Akurasi GPS rendah (±${Math.round(accuracyMeters)} m > 100 m); dicatat sebagai penanda verifikasi.`,
    };
  }

  return {
    coordinatesValid: true,
    isAnomaly: false,
    qualityLabel: 'Akurat',
  };
}

export function evaluateMultiLocationGeofence(params: {
  school: School;
  schoolLocations?: SchoolLocation[];
  userLat: number;
  userLon: number;
}): {
  gpsValid: boolean;
  distanceMeters: number;
  matchedLocationId?: string;
  matchedLocationName?: string;
  matchedLocationRadius: number;
  noActiveLocations: boolean;
} {
  const { school, schoolLocations, userLat, userLon } = params;

  const hasConfiguredList = Array.isArray(schoolLocations) && schoolLocations.length > 0;
  const activeLocations = hasConfiguredList
    ? schoolLocations.filter((loc) => loc.isActive)
    : [
        {
          locationId: 'primary-school',
          schoolId: school.schoolId,
          locationName: school.name,
          latitude: school.latitude,
          longitude: school.longitude,
          address: school.address,
          radiusInMeters: school.geofenceRadiusMeters,
          isActive: true,
          createdAt: '',
          updatedAt: '',
        },
      ];

  if (activeLocations.length === 0) {
    return {
      gpsValid: false,
      distanceMeters: 0,
      matchedLocationRadius: school.geofenceRadiusMeters,
      noActiveLocations: true,
    };
  }

  let bestMatch: { loc: SchoolLocation; dist: number } | null = null;
  let nearest: { loc: SchoolLocation; dist: number } | null = null;

  for (const loc of activeLocations) {
    const dist = haversineDistanceMeters(loc.latitude, loc.longitude, userLat, userLon);
    if (!nearest || dist < nearest.dist) {
      nearest = { loc, dist };
    }
    if (dist <= loc.radiusInMeters) {
      if (!bestMatch || dist < bestMatch.dist) {
        bestMatch = { loc, dist };
      }
    }
  }

  if (bestMatch) {
    return {
      gpsValid: true,
      distanceMeters: bestMatch.dist,
      matchedLocationId: bestMatch.loc.locationId,
      matchedLocationName: bestMatch.loc.locationName,
      matchedLocationRadius: bestMatch.loc.radiusInMeters,
      noActiveLocations: false,
    };
  }

  const fallbackNearest = nearest!;
  return {
    gpsValid: false,
    distanceMeters: fallbackNearest.dist,
    matchedLocationId: fallbackNearest.loc.locationId,
    matchedLocationName: fallbackNearest.loc.locationName,
    matchedLocationRadius: fallbackNearest.loc.radiusInMeters,
    noActiveLocations: false,
  };
}

export function validateAttendanceCheckIn(params: {
  school: School;
  schoolLocations?: SchoolLocation[];
  userLat: number;
  userLon: number;
  gpsAccuracyMeters?: number;
  networkLabel: string;
  faceCaptured: boolean;
}): {
  distanceMeters: number;
  matchedLocationId?: string;
  matchedLocationName?: string;
  matchedLocationRadius: number;
  gpsValid: boolean;
  networkValid: boolean;
  faceVerified: boolean;
  gpsAnomalyFlag: boolean;
  gpsAnomalyReason?: string;
  gpsQualityLabel: 'Akurat' | 'Kurang Akurat' | 'Anomali';
  canSubmit: boolean;
  reasons: string[];
} {
  const { school, schoolLocations, userLat, userLon, gpsAccuracyMeters, networkLabel, faceCaptured } =
    params;

  const gpsQuality = assessGpsQuality({
    latitude: userLat,
    longitude: userLon,
    accuracyMeters: gpsAccuracyMeters,
  });

  const geo = evaluateMultiLocationGeofence({
    school,
    schoolLocations,
    userLat,
    userLon,
  });

  const gpsValid = gpsQuality.coordinatesValid && geo.gpsValid;
  const networkValid =
    networkLabel.trim().toLowerCase() === school.allowedWifiLabel.trim().toLowerCase();
  const faceVerified = faceCaptured;

  const reasons: string[] = [];
  if (!gpsQuality.coordinatesValid && gpsQuality.reason) {
    reasons.push(gpsQuality.reason);
  } else if (geo.noActiveLocations) {
    reasons.push('Belum ada titik lokasi absensi aktif yang dikonfigurasi operator.');
  } else if (!geo.gpsValid) {
    reasons.push(
      `Jarak GPS (${geo.distanceMeters} m dari ${geo.matchedLocationName || school.name}) di luar radius yang diizinkan (${geo.matchedLocationRadius} m).`
    );
  }
  if (!networkValid) {
    reasons.push(
      `Jaringan "${networkLabel || '-'}" tidak cocok dengan jaringan resmi "${school.allowedWifiLabel}".`
    );
  }
  if (!faceVerified) {
    reasons.push('Verifikasi wajah melalui kamera belum diambil.');
  }

  return {
    distanceMeters: geo.distanceMeters,
    matchedLocationId: geo.matchedLocationId,
    matchedLocationName: geo.matchedLocationName,
    matchedLocationRadius: geo.matchedLocationRadius,
    gpsValid,
    networkValid,
    faceVerified,
    gpsAnomalyFlag: gpsQuality.isAnomaly,
    gpsAnomalyReason: gpsQuality.reason,
    gpsQualityLabel: gpsQuality.qualityLabel,
    canSubmit: gpsValid && networkValid && faceVerified,
    reasons,
  };
}
