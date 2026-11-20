import 'dotenv/config';
import express from 'express';
import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import {
  checkResendRateLimit,
  recordResendAttempt,
  RESEND_COOLDOWN_SECONDS,
  type ResendRateLimitState,
  validateBackendDecodedTokenClaims,
} from './src/utils/emailVerificationLogic.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ATTRIBUTION_ID = 'gmp_mcp_codeassist_v1_aistudio';

function loadFirebaseProjectId(): string {
  try {
    const raw = fs.readFileSync(
      path.resolve(__dirname, 'firebase-applet-config.json'),
      'utf-8'
    );
    const parsed = JSON.parse(raw) as { projectId?: string };
    return (parsed.projectId || '').trim();
  } catch {
    return '';
  }
}

const firebaseProjectId = loadFirebaseProjectId();
const adminApp = getApps().length
  ? getApp()
  : initializeApp(firebaseProjectId ? { projectId: firebaseProjectId } : {});
const adminAuth = getAdminAuth(adminApp);
const serverResendRateLimitStore = new Map<string, ResendRateLimitState>();

function extractBearerToken(req: express.Request): string {
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  const bodyToken =
    typeof req.body?.idToken === 'string' ? req.body.idToken.trim() : '';
  return bodyToken;
}

function getServerMapsApiKey(): string {
  return (
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.VITE_GOOGLE_MAPS_API_KEY ||
    ''
  ).trim();
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      mapsConfigured: Boolean(getServerMapsApiKey()),
      firebaseProjectConfigured: Boolean(firebaseProjectId),
    });
  });

  // Backend Firebase ID token verification for email_verified claim
  app.post('/api/auth/verify-email-token', async (req, res) => {
    const idToken = extractBearerToken(req);
    if (!idToken) {
      res.status(401).json({
        ok: false,
        emailVerified: false,
        code: 'MISSING_TOKEN',
        message: 'Token Firebase ID wajib disertakan pada permintaan verifikasi.',
      });
      return;
    }

    try {
      const decoded = await adminAuth.verifyIdToken(idToken);
      const claimCheck = validateBackendDecodedTokenClaims({
        uid: decoded.uid,
        email: decoded.email,
        email_verified: decoded.email_verified,
      });

      if (!claimCheck.valid || !claimCheck.emailVerified) {
        res.status(403).json({
          ok: false,
          emailVerified: false,
          uid: claimCheck.uid || null,
          email: claimCheck.email || null,
          code: 'EMAIL_NOT_VERIFIED',
          message:
            claimCheck.error ||
            'Email belum terverifikasi pada token Firebase. Selesaikan verifikasi email terlebih dahulu.',
        });
        return;
      }

      res.json({
        ok: true,
        emailVerified: true,
        email_verified: true,
        uid: claimCheck.uid,
        email: claimCheck.email || null,
        verifiedAt: new Date().toISOString(),
      });
    } catch (err) {
      res.status(401).json({
        ok: false,
        emailVerified: false,
        code: 'INVALID_TOKEN',
        message:
          err instanceof Error
            ? `Token Firebase tidak valid atau kedaluwarsa: ${err.message}`
            : 'Token Firebase tidak valid.',
      });
    }
  });

  // Server-side rate limit guard for verification email resends
  app.post('/api/auth/verification-resend-check', async (req, res) => {
    const idToken = extractBearerToken(req);
    if (!idToken) {
      res.status(401).json({
        ok: false,
        code: 'MISSING_TOKEN',
        message: 'Token Firebase ID diperlukan untuk mengirim ulang verifikasi.',
      });
      return;
    }

    try {
      const decoded = await adminAuth.verifyIdToken(idToken);
      if (decoded.email_verified === true) {
        res.json({
          ok: false,
          alreadyVerified: true,
          emailVerified: true,
          message: 'Email akun Anda sudah terverifikasi.',
        });
        return;
      }

      const uid = decoded.uid;
      const nowMs = Date.now();
      const currentState = serverResendRateLimitStore.get(uid);
      const check = checkResendRateLimit(currentState, nowMs);
      if (!check.allowed) {
        res.status(429).json({
          ok: false,
          rateLimited: true,
          retryAfterSeconds: check.retryAfterSeconds,
          remainingAttemptsInWindow: check.remainingAttemptsInWindow,
          message: check.message,
        });
        return;
      }

      const nextState = recordResendAttempt(currentState, nowMs);
      serverResendRateLimitStore.set(uid, nextState);
      const afterCheck = checkResendRateLimit(nextState, nowMs);

      res.json({
        ok: true,
        allowed: true,
        cooldownSeconds: RESEND_COOLDOWN_SECONDS,
        remainingAttemptsInWindow: afterCheck.remainingAttemptsInWindow,
      });
    } catch (err) {
      res.status(401).json({
        ok: false,
        code: 'INVALID_TOKEN',
        message:
          err instanceof Error
            ? `Token Firebase tidak valid: ${err.message}`
            : 'Token Firebase tidak valid.',
      });
    }
  });

  // Server-side proxy for Reverse Geocoding (avoids CF1 CORS trap on geocode.googleapis.com)
  app.get('/api/geocode/reverse', async (req, res) => {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      res.status(400).json({ error: { status: 'INVALID_ARGUMENT', message: 'Koordinat tidak valid.' } });
      return;
    }

    const apiKey = getServerMapsApiKey();
    if (!apiKey) {
      res.status(503).json({
        error: {
          status: 'MISSING_API_KEY',
          message: 'Google Maps API key belum tersedia di environment server.',
        },
      });
      return;
    }

    try {
      const url = new URL('https://geocode.googleapis.com/v4/geocode/location');
      url.searchParams.set('location.latitude', String(lat));
      url.searchParams.set('location.longitude', String(lng));
      url.searchParams.set('languageCode', 'id');

      const upstream = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'results.placeId,results.formattedAddress,results.addressComponents,results.types',
          'X-Goog-Maps-Solution-ID': ATTRIBUTION_ID,
        },
      });

      const payload = (await upstream.json().catch(() => ({}))) as {
        results?: Array<{
          placeId?: string;
          formattedAddress?: string;
          addressComponents?: unknown[];
          types?: string[];
        }>;
        error?: { status?: string; message?: string };
      };

      if (upstream.status === 429 || payload?.error?.status === 'RESOURCE_EXHAUSTED') {
        res.status(429).json({
          error: {
            status: 'RESOURCE_EXHAUSTED',
            message: payload?.error?.message || 'Google Maps Platform quota exceeded.',
          },
        });
        return;
      }

      if (!upstream.ok) {
        res.status(upstream.status).json({
          error: payload.error || { status: 'UPSTREAM_ERROR', message: 'Reverse geocoding gagal.' },
        });
        return;
      }

      const first = payload.results?.[0];
      res.json({
        formattedAddress: first?.formattedAddress || '',
        placeId: first?.placeId || '',
        results: payload.results || [],
        source: 'google_geocoding_v4',
      });
    } catch (err) {
      res.status(502).json({
        error: {
          status: 'UPSTREAM_FETCH_FAILED',
          message: err instanceof Error ? err.message : 'Gagal menghubungi layanan Geocoding.',
        },
      });
    }
  });

  // Server-side proxy for forward address search fallback
  app.get('/api/geocode/search', async (req, res) => {
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (query.length < 2) {
      res.status(400).json({ error: { status: 'INVALID_ARGUMENT', message: 'Kata kunci pencarian terlalu pendek.' } });
      return;
    }

    const apiKey = getServerMapsApiKey();
    if (!apiKey) {
      res.status(503).json({
        error: {
          status: 'MISSING_API_KEY',
          message: 'Google Maps API key belum tersedia di environment server.',
        },
      });
      return;
    }

    try {
      const url = new URL('https://geocode.googleapis.com/v4/geocode/address');
      url.searchParams.set('addressQuery', query);
      url.searchParams.set('languageCode', 'id');

      const upstream = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'results.placeId,results.formattedAddress,results.location,results.viewport',
          'X-Goog-Maps-Solution-ID': ATTRIBUTION_ID,
        },
      });

      const payload = (await upstream.json().catch(() => ({}))) as {
        results?: Array<{
          placeId?: string;
          formattedAddress?: string;
          location?: { latitude?: number; longitude?: number };
        }>;
        error?: { status?: string; message?: string };
      };

      if (upstream.status === 429 || payload?.error?.status === 'RESOURCE_EXHAUSTED') {
        res.status(429).json({
          error: {
            status: 'RESOURCE_EXHAUSTED',
            message: payload?.error?.message || 'Google Maps Platform quota exceeded.',
          },
        });
        return;
      }

      if (!upstream.ok) {
        res.status(upstream.status).json({
          error: payload.error || { status: 'UPSTREAM_ERROR', message: 'Pencarian alamat gagal.' },
        });
        return;
      }

      res.json({
        results: payload.results || [],
        source: 'google_geocoding_v4',
      });
    } catch (err) {
      res.status(502).json({
        error: {
          status: 'UPSTREAM_FETCH_FAILED',
          message: err instanceof Error ? err.message : 'Gagal menghubungi layanan pencarian alamat.',
        },
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SIMS Terpadu server listening on http://localhost:${PORT}`);
  });
}

void startServer();
