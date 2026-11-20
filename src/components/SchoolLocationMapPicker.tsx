/// <reference types="google.maps" />
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  APIProvider,
  APILoadingStatus,
  AdvancedMarker,
  Map as GoogleMap,
  Pin,
  useApiLoadingStatus,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import {
  AlertTriangle,
  CheckCircle2,
  Crosshair,
  Edit3,
  Loader2,
  MapPin,
  Minus,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import type { School, SchoolLocation } from '../types/sims';
import { validateSchoolLocationInput } from '../utils/attendanceLogic';

const ATTRIBUTION_IDS = ['gmp_mcp_codeassist_v1_aistudio'];
const DEFAULT_BANDUNG_CENTER = { lat: -6.917464, lng: 107.619123 };

interface SchoolLocationMapPickerProps {
  school: School;
  locations: SchoolLocation[];
  onSaveLocation: (payload: {
    locationId?: string;
    locationName: string;
    latitude: number;
    longitude: number;
    address: string;
    radiusInMeters: number;
    isActive: boolean;
  }) => { ok: boolean; error?: string; location?: SchoolLocation };
  onToggleActive: (locationId: string) => { ok: boolean; error?: string };
  onDeleteLocation: (locationId: string) => { ok: boolean; error?: string };
}

interface DraftLocationState {
  locationId?: string;
  locationName: string;
  latitude: number;
  longitude: number;
  address: string;
  radiusInMeters: number;
  isActive: boolean;
}

interface GeofenceCircleProps {
  center: google.maps.LatLngLiteral;
  radiusMeters: number;
  isPrimary?: boolean;
  isActive?: boolean;
}

const GeofenceCircleOverlay: React.FC<GeofenceCircleProps> = ({
  center,
  radiusMeters,
  isPrimary = true,
  isActive = true,
}) => {
  const map = useMap();
  const mapsLib = useMapsLibrary('maps');
  const circleRef = useRef<google.maps.Circle | null>(null);

  useEffect(() => {
    if (!map || !mapsLib) return;
    const circle = new mapsLib.Circle({
      map,
      center,
      radius: radiusMeters,
      clickable: false,
      strokeColor: isPrimary ? '#0F4C81' : isActive ? '#059669' : '#64748B',
      strokeOpacity: isPrimary ? 0.9 : 0.45,
      strokeWeight: isPrimary ? 2.5 : 1.5,
      fillColor: isPrimary ? '#0F4C81' : isActive ? '#10B981' : '#94A3B8',
      fillOpacity: isPrimary ? 0.16 : 0.06,
      zIndex: isPrimary ? 2 : 1,
    });
    circleRef.current = circle;
    return () => {
      circle.setMap(null);
      circleRef.current = null;
    };
  }, [map, mapsLib, isPrimary, isActive]);

  useEffect(() => {
    if (!circleRef.current) return;
    circleRef.current.setCenter(center);
  }, [center.lat, center.lng]);

  useEffect(() => {
    if (!circleRef.current) return;
    circleRef.current.setRadius(radiusMeters);
  }, [radiusMeters]);

  return null;
};

const MapCameraBridge: React.FC<{
  targetCenter: google.maps.LatLngLiteral;
  cameraSyncTick: number;
  zoomCommand: { delta: number; tick: number } | null;
}> = ({ targetCenter, cameraSyncTick, zoomCommand }) => {
  const map = useMap();

  useEffect(() => {
    if (!map || cameraSyncTick === 0) return;
    map.panTo(targetCenter);
  }, [map, targetCenter.lat, targetCenter.lng, cameraSyncTick]);

  useEffect(() => {
    if (!map || !zoomCommand) return;
    const currentZoom = map.getZoom() ?? 16;
    map.setZoom(Math.max(4, Math.min(20, currentZoom + zoomCommand.delta)));
  }, [map, zoomCommand]);

  return null;
};

function notifyQuotaIfDetected(status: number, body?: { error?: { status?: string } }) {
  if (status === 429 || body?.error?.status === 'RESOURCE_EXHAUSTED') {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
    return true;
  }
  return false;
}

function formatGeofenceArea(radiusMeters: number): string {
  const areaSqM = Math.PI * radiusMeters * radiusMeters;
  if (areaSqM >= 10000) {
    return `${(areaSqM / 10000).toFixed(2)} hektare`;
  }
  return `${Math.round(areaSqM).toLocaleString('id-ID')} m²`;
}

// Fallback interactive map canvas rendered ONLY if Maps JS API key is absent or fails to load
const InteractiveFallbackCanvas: React.FC<{
  center: { lat: number; lng: number };
  radiusMeters: number;
  savedLocations: SchoolLocation[];
  editingLocationId?: string;
  onPickCoordinate: (lat: number, lng: number) => void;
}> = ({ center, radiusMeters, savedLocations, editingLocationId, onPickCoordinate }) => {
  const [zoomScale, setZoomScale] = useState<number>(1);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const metersPerPixel = 2.2 / zoomScale;
  const circleRadiusPx = Math.max(18, Math.min(180, radiusMeters / metersPerPixel));

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    const deltaMetersX = dx * metersPerPixel;
    const deltaMetersY = -dy * metersPerPixel;
    const dLat = deltaMetersY / 111320;
    const dLng =
      deltaMetersX / (111320 * Math.max(0.2, Math.cos((center.lat * Math.PI) / 180)));
    onPickCoordinate(
      Number((center.lat + dLat).toFixed(6)),
      Number((center.lng + dLng).toFixed(6))
    );
  };

  return (
    <div className="relative h-full w-full select-none overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
      <div
        ref={containerRef}
        onClick={handleCanvasClick}
        role="application"
        aria-label="Kanvas peta interaktif pemilihan titik sekolah"
        className="relative h-full w-full cursor-crosshair"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(148,163,184,0.22) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.22) 1px, transparent 1px)',
          backgroundSize: '36px 36px',
        }}
      >
        {/* Other active locations */}
        {savedLocations
          .filter((loc) => loc.locationId !== editingLocationId && loc.isActive)
          .map((loc) => {
            const dyMeters = (loc.latitude - center.lat) * 111320;
            const dxMeters =
              (loc.longitude - center.lng) *
              111320 *
              Math.cos((center.lat * Math.PI) / 180);
            const offsetX = dxMeters / metersPerPixel;
            const offsetY = -dyMeters / metersPerPixel;
            if (Math.abs(offsetX) > 260 || Math.abs(offsetY) > 220) return null;
            return (
              <div
                key={loc.locationId}
                className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                style={{ transform: `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))` }}
              >
                <div className="h-3 w-3 rounded-full border-2 border-white bg-emerald-600 shadow" />
              </div>
            );
          })}

        {/* Active geofence circle */}
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#0F4C81] bg-[#0F4C81]/15 transition-all duration-150"
          style={{
            width: `${circleRadiusPx * 2}px`,
            height: `${circleRadiusPx * 2}px`,
          }}
        />

        {/* Selected marker pin */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full">
          <div className="flex flex-col items-center">
            <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-[#0F4C81] text-white shadow-md">
              <MapPin className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="h-2 w-0.5 bg-[#0F4C81]" />
          </div>
        </div>

        <div className="pointer-events-none absolute bottom-3 left-3 rounded-md border border-slate-200 bg-white/95 px-2.5 py-1.5 text-[11px] text-slate-700 shadow-sm">
          Klik titik pada kanvas peta untuk memindahkan pin · Radius{' '}
          <span className="font-mono font-semibold">{radiusMeters} m</span>
        </div>
      </div>

      <div className="absolute right-3 top-3 flex flex-col gap-1">
        <button
          type="button"
          onClick={() => setZoomScale((s) => Math.min(4, Number((s * 1.3).toFixed(2))))}
          aria-label="Perbesar peta"
          className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => setZoomScale((s) => Math.max(0.35, Number((s / 1.3).toFixed(2))))}
          aria-label="Perkecil peta"
          className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
        >
          <Minus className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};

interface InnerPickerProps extends SchoolLocationMapPickerProps {
  hasMapsApiKey: boolean;
}

const SchoolLocationMapPickerInner: React.FC<InnerPickerProps> = ({
  school,
  locations,
  hasMapsApiKey,
  onSaveLocation,
  onToggleActive,
  onDeleteLocation,
}) => {
  const apiStatus = useApiLoadingStatus();
  const map = useMap();
  const placesLib = useMapsLibrary('places');

  const initialTarget = locations[0];
  const [draft, setDraft] = useState<DraftLocationState>(() => ({
    locationId: initialTarget?.locationId,
    locationName: initialTarget?.locationName || 'Gedung Utama Kampus',
    latitude: initialTarget?.latitude ?? school.latitude ?? DEFAULT_BANDUNG_CENTER.lat,
    longitude: initialTarget?.longitude ?? school.longitude ?? DEFAULT_BANDUNG_CENTER.lng,
    address: initialTarget?.address || school.address || '',
    radiusInMeters: initialTarget?.radiusInMeters ?? school.geofenceRadiusMeters ?? 150,
    isActive: initialTarget?.isActive ?? true,
  }));

  const [cameraCenter, setCameraCenter] = useState<google.maps.LatLngLiteral>({
    lat: draft.latitude,
    lng: draft.longitude,
  });
  const [cameraSyncTick, setCameraSyncTick] = useState<number>(0);
  const [zoomCommand, setZoomCommand] = useState<{ delta: number; tick: number } | null>(null);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompleteSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState<boolean>(false);
  const [isLocatingUser, setIsLocatingUser] = useState<boolean>(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [showMobileConfig, setShowMobileConfig] = useState<boolean>(true);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err' | 'info'; text: string } | null>(
    null
  );

  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  const mapsReady = hasMapsApiKey && apiStatus === APILoadingStatus.LOADED;
  const mapsUnavailable =
    !hasMapsApiKey ||
    apiStatus === APILoadingStatus.FAILED ||
    apiStatus === APILoadingStatus.AUTH_FAILURE;

  // Debounced Places API (New) AutocompleteSuggestion search
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed || trimmed.length < 2 || !placesLib || !mapsReady) {
      setSuggestions([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        setIsSearching(true);
        if (!sessionTokenRef.current) {
          sessionTokenRef.current = new placesLib.AutocompleteSessionToken();
        }
        const res = await placesLib.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: trimmed,
          sessionToken: sessionTokenRef.current,
          language: 'id',
          region: 'id',
        });
        setSuggestions(res.suggestions || []);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (
          msg.includes('429') ||
          msg.includes('RESOURCE_EXHAUSTED') ||
          msg.includes('OVER_QUERY_LIMIT')
        ) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    }, 280);

    return () => window.clearTimeout(timer);
  }, [searchQuery, placesLib, mapsReady]);

  const performReverseGeocode = useCallback(
    async (lat: number, lng: number) => {
      setIsReverseGeocoding(true);
      try {
        const response = await fetch(
          `/api/geocode/reverse?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`
        );
        const body = (await response.json().catch(() => ({}))) as {
          formattedAddress?: string;
          error?: { status?: string; message?: string };
        };

        if (notifyQuotaIfDetected(response.status, body)) {
          setFeedback({
            type: 'err',
            text: 'Kuota Google Maps Geocoding tercapai. Koordinat tetap diperbarui; silakan lengkapi alamat secara manual.',
          });
          return;
        }

        if (response.ok && body.formattedAddress) {
          setDraft((prev) => ({ ...prev, address: body.formattedAddress! }));
          return;
        }

        // Secondary fallback via Places API (New) searchNearby if proxy key absent
        if (placesLib && mapsReady) {
          try {
            const nearby = await placesLib.Place.searchNearby({
              fields: ['displayName', 'formattedAddress'],
              locationRestriction: {
                center: { lat, lng },
                radius: 75,
              },
              maxResultCount: 1,
            });
            const place = nearby.places?.[0];
            if (place?.formattedAddress || place?.displayName) {
              const label = [place.displayName, place.formattedAddress]
                .filter(Boolean)
                .join(' — ');
              setDraft((prev) => ({ ...prev, address: label }));
              return;
            }
          } catch {
            // Ignore secondary fallback errors
          }
        }

        // Graceful coordinate label when reverse geocoder cannot resolve street name
        setDraft((prev) => ({
          ...prev,
          address: `Titik Kampus (${lat.toFixed(5)}, ${lng.toFixed(5)})`,
        }));
      } catch {
        setDraft((prev) => ({
          ...prev,
          address: `Titik Kampus (${lat.toFixed(5)}, ${lng.toFixed(5)})`,
        }));
      } finally {
        setIsReverseGeocoding(false);
      }
    },
    [placesLib, mapsReady]
  );

  const selectCoordinate = useCallback(
    (lat: number, lng: number, panCamera = false, skipReverse = false) => {
      const roundedLat = Number(lat.toFixed(6));
      const roundedLng = Number(lng.toFixed(6));
      setDraft((prev) => ({
        ...prev,
        latitude: roundedLat,
        longitude: roundedLng,
      }));
      if (panCamera) {
        setCameraCenter({ lat: roundedLat, lng: roundedLng });
        setCameraSyncTick((t) => t + 1);
      }
      if (!skipReverse) {
        void performReverseGeocode(roundedLat, roundedLng);
      }
    },
    [performReverseGeocode]
  );

  const handleSelectSuggestion = async (
    suggestion: google.maps.places.AutocompleteSuggestion
  ) => {
    if (!suggestion.placePrediction) return;
    try {
      setIsSearching(true);
      const place = suggestion.placePrediction.toPlace();
      await place.fetchFields({
        fields: ['displayName', 'formattedAddress', 'location', 'viewport'],
      });
      sessionTokenRef.current = null;
      setSuggestions([]);

      if (place.location) {
        const lat = place.location.lat();
        const lng = place.location.lng();
        const resolvedAddress =
          place.formattedAddress ||
          suggestion.placePrediction.text?.text ||
          `Lokasi (${lat.toFixed(5)}, ${lng.toFixed(5)})`;

        setDraft((prev) => ({
          ...prev,
          latitude: Number(lat.toFixed(6)),
          longitude: Number(lng.toFixed(6)),
          address: resolvedAddress,
          locationName:
            prev.locationId || prev.locationName.trim().length >= 2
              ? prev.locationName
              : place.displayName || prev.locationName,
        }));

        setSearchQuery(suggestion.placePrediction.text?.text || resolvedAddress);
        setCameraCenter({ lat, lng });
        setCameraSyncTick((t) => t + 1);

        if (map && place.viewport) {
          map.fitBounds(place.viewport);
        } else if (map) {
          map.setZoom(17);
        }
        setFeedback({
          type: 'info',
          text: 'Lokasi ditemukan. Klik atau geser pin di peta untuk presisi titik bangunan sekolah.',
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (
        msg.includes('429') ||
        msg.includes('RESOURCE_EXHAUSTED') ||
        msg.includes('OVER_QUERY_LIMIT')
      ) {
        window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
      }
      setFeedback({
        type: 'err',
        text: 'Gagal mengambil detail tempat yang dipilih. Silakan coba lagi atau klik peta langsung.',
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleManualAddressSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q.length < 2) {
      setFeedback({ type: 'err', text: 'Masukkan minimal 2 karakter nama sekolah atau alamat.' });
      return;
    }

    if (suggestions.length > 0) {
      await handleSelectSuggestion(suggestions[0]);
      return;
    }

    setIsSearching(true);
    setFeedback(null);
    try {
      const response = await fetch(`/api/geocode/search?q=${encodeURIComponent(q)}`);
      const body = (await response.json().catch(() => ({}))) as {
        results?: Array<{
          formattedAddress?: string;
          location?: { latitude?: number; longitude?: number };
        }>;
        error?: { status?: string; message?: string };
      };

      if (notifyQuotaIfDetected(response.status, body)) {
        setFeedback({
          type: 'err',
          text: 'Kuota pencarian alamat Google Maps telah tercapai.',
        });
        return;
      }

      const first = body.results?.[0];
      if (
        response.ok &&
        first?.location?.latitude !== undefined &&
        first?.location?.longitude !== undefined
      ) {
        const lat = Number(first.location.latitude.toFixed(6));
        const lng = Number(first.location.longitude.toFixed(6));
        setDraft((prev) => ({
          ...prev,
          latitude: lat,
          longitude: lng,
          address: first.formattedAddress || q,
        }));
        setCameraCenter({ lat, lng });
        setCameraSyncTick((t) => t + 1);
        if (map) map.setZoom(17);
        setFeedback({
          type: 'info',
          text: 'Peta digeser ke hasil pencarian. Klik atau geser marker untuk menyesuaikan titik.',
        });
      } else {
        setFeedback({
          type: 'err',
          text:
            body.error?.message ||
            'Alamat tidak ditemukan. Gunakan saran pencarian atau klik langsung pada peta.',
        });
      }
    } catch {
      setFeedback({
        type: 'err',
        text: 'Tidak dapat terhubung ke layanan pencarian alamat.',
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setFeedback({
        type: 'err',
        text: 'Browser tidak mendukung Geolocation. Silakan pilih titik langsung di peta.',
      });
      return;
    }

    setIsLocatingUser(true);
    setFeedback(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocatingUser(false);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        selectCoordinate(lat, lng, true, false);
        if (map) map.setZoom(17);
        setFeedback({
          type: 'ok',
          text: `Lokasi perangkat terdeteksi (akurasi ±${Math.round(pos.coords.accuracy)} m).`,
        });
      },
      (err) => {
        setIsLocatingUser(false);
        setFeedback({
          type: 'err',
          text:
            err.code === 1
              ? 'Izin lokasi browser ditolak. Aktifkan izin lokasi atau klik langsung di peta.'
              : 'Gagal memperoleh koordinat GPS perangkat. Klik titik lokasi di peta.',
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleStartNewLocation = () => {
    const centerLat = map?.getCenter()?.lat() ?? draft.latitude;
    const centerLng = map?.getCenter()?.lng() ?? draft.longitude;
    setDraft({
      locationId: undefined,
      locationName: '',
      latitude: Number(centerLat.toFixed(6)),
      longitude: Number(centerLng.toFixed(6)),
      address: '',
      radiusInMeters: 100,
      isActive: true,
    });
    setFeedback({
      type: 'info',
      text: 'Mode tambah titik lokasi baru. Cari alamat atau klik peta untuk menentukan pin.',
    });
    void performReverseGeocode(centerLat, centerLng);
  };

  const handleEditExistingLocation = (loc: SchoolLocation) => {
    setDraft({
      locationId: loc.locationId,
      locationName: loc.locationName,
      latitude: loc.latitude,
      longitude: loc.longitude,
      address: loc.address,
      radiusInMeters: loc.radiusInMeters,
      isActive: loc.isActive,
    });
    setCameraCenter({ lat: loc.latitude, lng: loc.longitude });
    setCameraSyncTick((t) => t + 1);
    if (map) map.setZoom(17);
    setPendingDeleteId(null);
    setFeedback(null);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const clientValidation = validateSchoolLocationInput({
      locationName: draft.locationName,
      address: draft.address,
      latitude: draft.latitude,
      longitude: draft.longitude,
      radiusInMeters: draft.radiusInMeters,
    });
    if (!clientValidation.valid) {
      setFeedback({ type: 'err', text: clientValidation.error || 'Data lokasi tidak valid.' });
      return;
    }

    const res = onSaveLocation({
      locationId: draft.locationId,
      locationName: draft.locationName,
      latitude: draft.latitude,
      longitude: draft.longitude,
      address: draft.address,
      radiusInMeters: draft.radiusInMeters,
      isActive: draft.isActive,
    });

    if (res.ok && res.location) {
      setDraft((prev) => ({ ...prev, locationId: res.location!.locationId }));
      setFeedback({
        type: 'ok',
        text: `Lokasi "${res.location.locationName}" dengan radius ${res.location.radiusInMeters} m berhasil disimpan ke sistem & Cloud Firestore.`,
      });
    } else {
      setFeedback({
        type: 'err',
        text: res.error || 'Gagal menyimpan titik lokasi.',
      });
    }
  };

  const activeCount = useMemo(
    () => locations.filter((l) => l.isActive).length,
    [locations]
  );

  return (
    <div className="space-y-4">
      {feedback && (
        <div
          role="alert"
          className={`flex items-start gap-2.5 rounded-lg border px-4 py-3 text-sm ${
            feedback.type === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : feedback.type === 'err'
              ? 'border-red-200 bg-red-50 text-red-900'
              : 'border-sky-200 bg-sky-50 text-sky-950'
          }`}
        >
          {feedback.type === 'ok' ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
          ) : feedback.type === 'err' ? (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />
          ) : (
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#0F4C81]" aria-hidden="true" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Desktop split layout (7 cols interactive map + 5 cols configuration & multi-location list) */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Left: Interactive Map Viewport + Floating Search & Location Action */}
        <div className="space-y-3 lg:col-span-7">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <form onSubmit={handleManualAddressSearch} className="relative flex-1">
              <div className="relative flex items-center">
                <Search
                  className="pointer-events-none absolute left-3 h-4 w-4 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama sekolah, gedung, atau alamat..."
                  aria-label="Pencarian alamat atau nama tempat"
                  className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-20 text-sm text-slate-900 focus:border-[#0F4C81] focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={isSearching}
                  className="absolute right-1.5 rounded-md bg-[#0F4C81] px-2.5 py-1 text-xs font-medium text-white hover:bg-[#0C3D68] disabled:opacity-60"
                >
                  {isSearching ? 'Mencari...' : 'Cari'}
                </button>
              </div>

              {suggestions.length > 0 && (
                <ul
                  role="listbox"
                  aria-label="Saran lokasi"
                  className="absolute left-0 right-0 z-30 mt-1 max-h-60 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg divide-y divide-slate-100"
                >
                  {suggestions.map((sug, idx) => (
                    <li key={sug.placePrediction?.placeId || idx}>
                      <button
                        type="button"
                        onClick={() => void handleSelectSuggestion(sug)}
                        className="flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left text-xs hover:bg-sky-50"
                      >
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0F4C81]" aria-hidden="true" />
                        <span className="text-slate-800">
                          {sug.placePrediction?.text?.text || 'Lokasi ditemukan'}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </form>

            <button
              type="button"
              onClick={handleUseCurrentLocation}
              disabled={isLocatingUser}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 whitespace-nowrap"
            >
              {isLocatingUser ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Crosshair className="h-3.5 w-3.5 text-[#0F4C81]" aria-hidden="true" />
              )}
              Gunakan Lokasi Saya
            </button>
          </div>

          {/* Explicit non-zero height container (CF2) */}
          <div className="relative h-[380px] sm:h-[440px] lg:h-[520px] w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
            {hasMapsApiKey && apiStatus === APILoadingStatus.LOADING && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-100/90 text-xs text-slate-600 gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-[#0F4C81]" aria-hidden="true" />
                <span>Memuat peta interaktif Google Maps...</span>
              </div>
            )}

            {mapsUnavailable ? (
              <div className="flex h-full flex-col">
                <div className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  Mode pratinjau peta lokal aktif (konfigurasi kunci Maps JS belum aktif di sesi ini). Anda tetap dapat mengeklik kanvas untuk memilih titik & melihat radius geofence.
                </div>
                <div className="flex-1 min-h-0">
                  <InteractiveFallbackCanvas
                    center={{ lat: draft.latitude, lng: draft.longitude }}
                    radiusMeters={draft.radiusInMeters}
                    savedLocations={locations}
                    editingLocationId={draft.locationId}
                    onPickCoordinate={(lat, lng) => selectCoordinate(lat, lng, true, false)}
                  />
                </div>
              </div>
            ) : (
              <>
                <GoogleMap
                  mapId="DEMO_MAP_ID"
                  defaultCenter={cameraCenter}
                  defaultZoom={16}
                  gestureHandling="greedy"
                  disableDefaultUI={false}
                  mapTypeControl={true}
                  streetViewControl={false}
                  fullscreenControl={false}
                  zoomControl={false}
                  internalUsageAttributionIds={ATTRIBUTION_IDS}
                  onClick={(e) => {
                    const latLng = e.detail.latLng;
                    if (!latLng) return;
                    selectCoordinate(latLng.lat, latLng.lng, false, false);
                  }}
                  style={{ width: '100%', height: '100%' }}
                >
                  <MapCameraBridge
                    targetCenter={cameraCenter}
                    cameraSyncTick={cameraSyncTick}
                    zoomCommand={zoomCommand}
                  />

                  {/* Other saved campus/branch locations */}
                  {locations
                    .filter((loc) => loc.locationId !== draft.locationId)
                    .map((loc) => (
                      <React.Fragment key={loc.locationId}>
                        <AdvancedMarker
                          position={{ lat: loc.latitude, lng: loc.longitude }}
                          title={loc.locationName}
                          onClick={() => handleEditExistingLocation(loc)}
                        >
                          <Pin
                            background={loc.isActive ? '#059669' : '#64748B'}
                            glyphColor="#FFFFFF"
                            borderColor={loc.isActive ? '#047857' : '#475569'}
                            scale={0.85}
                          />
                        </AdvancedMarker>
                        {loc.isActive && (
                          <GeofenceCircleOverlay
                            center={{ lat: loc.latitude, lng: loc.longitude }}
                            radiusMeters={loc.radiusInMeters}
                            isPrimary={false}
                            isActive={loc.isActive}
                          />
                        )}
                      </React.Fragment>
                    ))}

                  {/* Selected / Editing draggable school pin + real-time geofence circle */}
                  <AdvancedMarker
                    position={{ lat: draft.latitude, lng: draft.longitude }}
                    draggable={true}
                    title={draft.locationName || 'Titik Lokasi Sekolah'}
                    onDragEnd={(e) => {
                      const pos = e.latLng;
                      if (!pos) return;
                      selectCoordinate(pos.lat(), pos.lng(), false, false);
                    }}
                  >
                    <Pin background="#0F4C81" glyphColor="#FFFFFF" borderColor="#0A355C" />
                  </AdvancedMarker>

                  <GeofenceCircleOverlay
                    center={{ lat: draft.latitude, lng: draft.longitude }}
                    radiusMeters={draft.radiusInMeters}
                    isPrimary={true}
                    isActive={draft.isActive}
                  />
                </GoogleMap>

                {/* Custom accessible zoom & recenter controls */}
                <div className="absolute bottom-4 right-3 z-10 flex flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setZoomCommand((prev) => ({ delta: 1, tick: (prev?.tick || 0) + 1 }))
                    }
                    aria-label="Zoom in peta"
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setZoomCommand((prev) => ({ delta: -1, tick: (prev?.tick || 0) + 1 }))
                    }
                    aria-label="Zoom out peta"
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
                  >
                    <Minus className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCameraCenter({ lat: draft.latitude, lng: draft.longitude });
                      setCameraSyncTick((t) => t + 1);
                    }}
                    aria-label="Pusatkan peta ke pin"
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-[#0F4C81] shadow-sm hover:bg-slate-50"
                  >
                    <MapPin className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </>
            )}
          </div>

          <p className="text-xs text-slate-500">
            Klik titik mana saja pada peta atau seret pin biru untuk mengoreksi posisi bangunan sekolah secara presisi.
          </p>
        </div>

        {/* Right: Bottom-sheet-like collapsible panel on mobile / side config panel on desktop */}
        <div className="space-y-4 lg:col-span-5">
          <div className="flex items-center justify-between lg:hidden">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Detail Titik & Daftar Lokasi ({locations.length})
            </span>
            <button
              type="button"
              onClick={() => setShowMobileConfig((s) => !s)}
              className="text-xs font-medium text-[#0F4C81] hover:underline"
            >
              {showMobileConfig ? 'Sembunyikan Panel' : 'Buka Panel Lokasi'}
            </button>
          </div>

          <div className={`${showMobileConfig ? 'block' : 'hidden lg:block'} space-y-4`}>
            {/* Location Config Form (No manual Lat/Lng inputs) */}
            <form
              onSubmit={handleSave}
              className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3.5"
            >
              <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    {draft.locationId ? 'Edit Titik Lokasi Sekolah' : 'Tambah Titik Lokasi Baru'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Koordinat otomatis diperbarui dari pin peta.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleStartNewLocation}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  Lokasi Baru
                </button>
              </div>

              <div>
                <label
                  htmlFor="location-name-input"
                  className="block text-xs font-medium text-slate-700"
                >
                  Nama Lokasi / Gedung
                </label>
                <input
                  id="location-name-input"
                  type="text"
                  required
                  value={draft.locationName}
                  onChange={(e) => setDraft((p) => ({ ...p, locationName: e.target.value }))}
                  placeholder="Contoh: Gedung Utama, Gedung Praktik, Gedung Cabang"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="location-address-input"
                    className="block text-xs font-medium text-slate-700"
                  >
                    Alamat Hasil Reverse Geocoding
                  </label>
                  {isReverseGeocoding && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-[#0F4C81]">
                      <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                      Mengambil alamat...
                    </span>
                  )}
                </div>
                <textarea
                  id="location-address-input"
                  rows={2}
                  required
                  value={draft.address}
                  onChange={(e) => setDraft((p) => ({ ...p, address: e.target.value }))}
                  placeholder="Alamat otomatis terisi saat Anda memilih titik pada peta"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800"
                />
              </div>

              {/* Automatic read-only coordinate readout (not manual input) */}
              <div className="grid grid-cols-2 gap-2.5 rounded-lg border border-slate-200 bg-white p-3">
                <div>
                  <p className="text-[11px] font-medium text-slate-500">Latitude (Otomatis)</p>
                  <p
                    data-testid="selected-latitude-readout"
                    className="mt-0.5 text-xs font-semibold font-mono text-slate-900 tabular-nums"
                  >
                    {draft.latitude.toFixed(6)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-slate-500">Longitude (Otomatis)</p>
                  <p
                    data-testid="selected-longitude-readout"
                    className="mt-0.5 text-xs font-semibold font-mono text-slate-900 tabular-nums"
                  >
                    {draft.longitude.toFixed(6)}
                  </p>
                </div>
              </div>

              {/* Real-time Geofence Radius Slider + Numeric Input */}
              <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="geofence-radius-number"
                    className="text-xs font-medium text-slate-700"
                  >
                    Radius Absensi (meter)
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      id="geofence-radius-number"
                      type="number"
                      min={10}
                      max={5000}
                      value={draft.radiusInMeters}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setDraft((p) => ({
                          ...p,
                          radiusInMeters: Number.isFinite(val)
                            ? Math.max(10, Math.min(5000, val))
                            : 100,
                        }));
                      }}
                      className="w-20 rounded-md border border-slate-300 px-2 py-1 text-right text-xs font-mono font-semibold tabular-nums"
                    />
                    <span className="text-xs text-slate-500">m</span>
                  </div>
                </div>

                <input
                  type="range"
                  min={10}
                  max={2000}
                  step={10}
                  aria-label="Slider radius geofence dalam meter"
                  value={Math.min(2000, draft.radiusInMeters)}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, radiusInMeters: Number(e.target.value) }))
                  }
                  className="w-full accent-[#0F4C81] cursor-pointer"
                />

                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <div className="flex flex-wrap gap-1.5">
                    {[50, 100, 250, 500].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setDraft((p) => ({ ...p, radiusInMeters: preset }))}
                        className={`rounded-md border px-2 py-0.5 text-[11px] font-mono tabular-nums ${
                          draft.radiusInMeters === preset
                            ? 'border-[#0F4C81] bg-sky-50 font-semibold text-[#0F4C81]'
                            : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {preset} m
                      </button>
                    ))}
                  </div>
                  <span className="text-[11px] text-slate-500 tabular-nums">
                    Zona ±{formatGeofenceArea(draft.radiusInMeters)}
                  </span>
                </div>
              </div>

              {/* Geofence Zone Preview Summary */}
              <div className="rounded-lg border border-sky-200 bg-sky-50/60 p-3 text-xs text-slate-700 space-y-1">
                <p className="font-semibold text-[#0F4C81]">Pratinjau Zona Geofence</p>
                <p>
                  Titik pusat: <strong className="text-slate-900">{draft.locationName || 'Lokasi Sekolah'}</strong>
                </p>
                <p>
                  Area absensi: Lingkaran radius{' '}
                  <strong className="font-mono text-slate-900">{draft.radiusInMeters} meter</strong>{' '}
                  dari titik pusat.
                </p>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draft.isActive}
                    onChange={(e) => setDraft((p) => ({ ...p, isActive: e.target.checked }))}
                    className="h-4 w-4 rounded border-slate-300 accent-[#0F4C81]"
                  />
                  Lokasi Aktif untuk Absensi
                </label>

                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F4C81] px-4 py-2 text-xs font-medium text-white hover:bg-[#0C3D68] whitespace-nowrap"
                >
                  <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                  Simpan Lokasi
                </button>
              </div>
            </form>

            {/* Multi-Location List */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Daftar Titik Lokasi Absensi
                  </h3>
                  <p className="text-xs text-slate-500">
                    {activeCount} aktif dari {locations.length} titik lokasi terdaftar
                  </p>
                </div>
              </div>

              {locations.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 p-5 text-center text-xs text-slate-500">
                  Belum ada titik lokasi absensi. Gunakan pencarian atau klik peta di sebelah kiri lalu tekan &ldquo;Simpan Lokasi&rdquo;.
                </div>
              ) : (
                <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                  {locations.map((loc) => {
                    const isSelected = draft.locationId === loc.locationId;
                    const confirmingDelete = pendingDeleteId === loc.locationId;
                    return (
                      <div
                        key={loc.locationId}
                        className={`py-3 space-y-2 ${
                          isSelected ? 'bg-sky-50/50 -mx-2 px-2 rounded-lg' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => handleEditExistingLocation(loc)}
                            className="min-w-0 text-left flex-1"
                          >
                            <div className="flex items-center gap-2">
                              <span className="truncate text-sm font-semibold text-slate-900">
                                {loc.locationName}
                              </span>
                              <span
                                className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium ${
                                  loc.isActive
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                                }`}
                              >
                                {loc.isActive ? 'Aktif' : 'Nonaktif'}
                              </span>
                            </div>
                            <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">
                              {loc.address}
                            </p>
                            <p className="mt-1 text-[11px] font-mono text-slate-500 tabular-nums">
                              {loc.latitude.toFixed(5)}, {loc.longitude.toFixed(5)} · Radius{' '}
                              {loc.radiusInMeters} m
                            </p>
                          </button>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleEditExistingLocation(loc)}
                              aria-label={`Edit ${loc.locationName}`}
                              className="rounded-md border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100"
                            >
                              <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onToggleActive(loc.locationId)}
                              className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                            >
                              {loc.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setPendingDeleteId(loc.locationId)}
                              aria-label={`Hapus ${loc.locationName}`}
                              className="rounded-md border border-red-200 p-1.5 text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        </div>

                        {confirmingDelete && (
                          <div className="flex items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">
                            <span>Hapus titik &ldquo;{loc.locationName}&rdquo;?</span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setPendingDeleteId(null)}
                                className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700"
                              >
                                Batal
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  onDeleteLocation(loc.locationId);
                                  setPendingDeleteId(null);
                                  if (draft.locationId === loc.locationId) {
                                    handleStartNewLocation();
                                  }
                                }}
                                className="rounded bg-red-700 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-red-800"
                              >
                                Ya, Hapus
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const SchoolLocationMapPicker: React.FC<SchoolLocationMapPickerProps> = (props) => {
  const mapsApiKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();

  if (!mapsApiKey) {
    return <SchoolLocationMapPickerInner {...props} hasMapsApiKey={false} />;
  }

  return (
    <APIProvider
      apiKey={mapsApiKey}
      language="id"
      region="ID"
      libraries={['places', 'marker', 'maps']}
    >
      <SchoolLocationMapPickerInner {...props} hasMapsApiKey={true} />
    </APIProvider>
  );
};
