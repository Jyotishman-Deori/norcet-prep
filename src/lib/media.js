// =====================================================================
// src/lib/media.js — question media helpers (images + video links).
//
// The app never hosts media itself: question `image` / `video` fields hold
// https URLs. Static images live in the owner's Cloudflare R2 bucket (zero
// egress, the "heavy lifter" of the stack); videos are LINKS (YouTube
// preferred; any https URL renders as an external "watch" card). Admin-side
// uploads never touch this app's servers: the media-sign Edge Function
// (coadmin+, R2 credentials as Supabase secrets) mints a presigned PUT URL
// and the browser PUTs the bytes straight to R2. Students only ever read
// public URLs.
//
// Pure helpers below are Node-testable; uploadViaSigner needs fetch/File and
// is only called from ADMIN surfaces (never in the student flow).
// =====================================================================
// NOTE: no top-level env/storage imports — the pure helpers below run under
// plain Node in media.test.js. uploadViaSigner resolves its browser-only
// dependencies lazily (admin runtime only).

// Only https URLs (or inline data URIs for images) are accepted as media.
// Anything else returns '' so malformed values never reach the renderer.
export function normalizeMediaUrl(raw, { allowDataUri = false } = {}) {
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (!s) return '';
  if (allowDataUri && /^data:image\//i.test(s)) return s;
  if (/^https:\/\/\S+$/i.test(s)) return s;
  return '';
}

// ---- YouTube link handling -------------------------------------------
// Supported shapes: watch?v=ID, youtu.be/ID, shorts/ID, embed/ID, live/ID.
// IDs are 11 chars of [A-Za-z0-9_-].
export function youTubeId(url) {
  const s = typeof url === 'string' ? url.trim() : '';
  if (!s) return null;
  const m = s.match(
    /(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
  );
  return m ? m[1] : null;
}

export function youTubeThumb(id) {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

// Privacy-enhanced embed URL (no cookies until play).
export function youTubeEmbed(id) {
  return `https://www.youtube-nocookie.com/embed/${id}?rel=0`;
}

export function isVideoUrl(url) {
  const s = typeof url === 'string' ? url.trim() : '';
  if (!s) return false;
  if (youTubeId(s)) return true;
  return /^https:\/\/\S+\.(mp4|webm|mov)(\?\S*)?$/i.test(s) || /cloudinary\.com\/.+\/video\//i.test(s);
}

// ---- Admin upload (browser only; never in the student flow) -----------
// Two steps: (1) ask the media-sign broker for a presigned R2 PUT URL
// (admin session token required), (2) PUT the file bytes straight to R2.
// Resolves the permanent public URL. Throws readable messages throughout.
export async function uploadViaSigner(file, { folder = 'q' } = {}) {
  if (!file) throw new Error('Pick a file first.');
  const env = (typeof import.meta !== 'undefined' && import.meta.env) || {};
  const SUPABASE_URL = env.VITE_SUPABASE_URL;
  const SUPABASE_KEY = env.VITE_SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Supabase env vars are missing in this build.');
  const { getAuthToken } = await import('../storage');
  const token = getAuthToken();
  if (!token) throw new Error('Sign in again: no session token.');
  const r = await fetch(`${SUPABASE_URL}/functions/v1/media-sign`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'sign', token, folder,
      filename: String(file.name || 'file'),
      contentType: String(file.type || 'application/octet-stream'),
      size: Number(file.size || 0),
    }),
  });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j || !j.uploadUrl || !j.publicUrl) {
    throw new Error((j && j.error) || `media-sign failed (${r.status}). Is the function deployed and are the R2 secrets set? See docs/media-r2.md.`);
  }
  const put = await fetch(j.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': String(file.type || 'application/octet-stream') },
    body: file,
  });
  if (!put.ok) throw new Error(`R2 upload failed (${put.status}). Check the bucket CORS rule allows PUT from this origin.`);
  return String(j.publicUrl);
}
