const DEFAULT_LED_CROWN_BASE_URL = 'http://192.168.20.178';

let lastUrl = null;
let lastSentAt = 0;

function clampByte(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(255, Math.round(n)));
}

function buildColorUrl(baseUrl, r, g, b) {
  const qs = new URLSearchParams({
    r: String(clampByte(r)),
    g: String(clampByte(g)),
    b: String(clampByte(b)),
    _: String(Date.now())
  });
  return `${baseUrl.replace(/\/$/, '')}/color?${qs.toString()}`;
}

function fireAndForgetGet(url) {
  // Use an <img> request to avoid CORS restrictions (we don't need to read the response).
  try {
    const img = new Image();
    img.decoding = 'async';
    img.referrerPolicy = 'no-referrer';
    img.src = url;
  } catch {
    // ignore
  }
}

export function setLedCrownColor({ r, g, b }, opts = {}) {
  const enabled = (import.meta?.env?.VITE_LED_CROWN_ENABLED ?? 'true') !== 'false';
  if (!enabled) return;

  const baseUrl = opts.baseUrl ?? import.meta?.env?.VITE_LED_CROWN_BASE_URL ?? DEFAULT_LED_CROWN_BASE_URL;
  const url = buildColorUrl(baseUrl, r, g, b);

  // De-dupe + light throttling to avoid spamming the device.
  const now = Date.now();
  if (url === lastUrl && now - lastSentAt < 750) return;

  lastUrl = url;
  lastSentAt = now;
  fireAndForgetGet(url);
}

export function setLedCrownWhite(opts) {
  setLedCrownColor({ r: 255, g: 255, b: 255 }, opts);
}

export function setLedCrownRed(opts) {
  setLedCrownColor({ r: 255, g: 0, b: 0 }, opts);
}

export function setLedCrownGreen(opts) {
  setLedCrownColor({ r: 0, g: 255, b: 0 }, opts);
}

export function setLedCrownBlue(opts) {
  setLedCrownColor({ r: 0, g: 0, b: 255 }, opts);
}

export function setLedCrownOrange(opts) {
  setLedCrownColor({ r: 255, g: 140, b: 0 }, opts);
}

export function pickCrownColorForGuilt(guiltLevel, thresholds = { redAtOrAbove: 60 }) {
  const n = Number(guiltLevel);
  if (!Number.isFinite(n)) return { r: 255, g: 255, b: 255 };
  return n >= (thresholds?.redAtOrAbove ?? 60)
    ? { r: 255, g: 0, b: 0 }
    : { r: 0, g: 255, b: 0 };
}
