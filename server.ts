import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ATTRIBUTION_ID = 'gmp_mcp_codeassist_v1_aistudio';

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
    res.json({ ok: true, mapsConfigured: Boolean(getServerMapsApiKey()) });
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
