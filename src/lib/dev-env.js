// =====================================================================
// DEV ENVIRONMENT INDICATOR — which Supabase project is this app talking to?
// =====================================================================
// `npm run dev` / `npm run dev:admin` load .env.development (local-only, see
// .env.development.example), which points VITE_SUPABASE_* at the free-tier
// nurseholic-dev project and sets VITE_ENV_LABEL=dev. Production builds never
// load that file, so the label is absent there and this module is inert.
//
// Two states matter:
//   'DEV DATA'  — dev serve against the dev project (the safe, normal case).
//   'LIVE DATA' — a dev serve WITHOUT the label: .env.development is missing,
//                 so Vite silently fell back to .env = the PRODUCTION project.
//                 That silent fallback is the dangerous failure mode this
//                 badge exists to make loud.
// Pure logic here; initDevBadge does the one-time console + DOM chip.
// =====================================================================

// env = an import.meta.env-shaped object. Returns 'DEV DATA' | 'LIVE DATA' | null.
export function devDataLabel(env) {
  if (!env) return null;
  if (env.VITE_ENV_LABEL === 'dev') return 'DEV DATA';
  if (env.DEV === true) return 'LIVE DATA';
  return null;
}

// One-time badge: console banner + a small fixed, pointer-events-none chip.
// Plain DOM (no React) so both entry points can call it before render.
export function initDevBadge(env) {
  const label = devDataLabel(env);
  if (!label) return null;
  const dev = label === 'DEV DATA';
  try {
    // eslint-disable-next-line no-console
    console.info(
      `%c ${label} %c ${dev
        ? 'This serve is using the nurseholic-dev Supabase project.'
        : 'WARNING: .env.development is missing, this dev serve is touching the PRODUCTION Supabase project.'}`,
      `background:${dev ? '#0F766E' : '#B91C1C'};color:#fff;font-weight:bold;border-radius:3px;padding:2px 6px;`,
      'color:inherit;'
    );
  } catch (e) { /* console unavailable */ }
  try {
    if (typeof document === 'undefined' || !document.body) return label;
    const chip = document.createElement('div');
    chip.textContent = label;
    chip.setAttribute('aria-hidden', 'true');
    chip.style.cssText = [
      'position:fixed', 'left:8px', 'bottom:8px', 'z-index:2147483647',
      'pointer-events:none', 'font:700 10px/1 system-ui,sans-serif',
      'letter-spacing:0.08em', 'padding:4px 7px', 'border-radius:6px',
      'color:#fff', 'opacity:0.85',
      `background:${dev ? '#0F766E' : '#B91C1C'}`,
    ].join(';');
    document.body.appendChild(chip);
  } catch (e) { /* non-DOM environment */ }
  return label;
}
