// Outils de sécurité du serveur : limitation de débit, adresse du client, nettoyage des pseudos,
// en-têtes HTTP de sécurité et cookie de session d'invité. Aucune dépendance externe.

// ---------- Limitation de débit ----------

// Fenêtre glissante simplifiée : au plus `max` appels par `windowMs` et par clé.
export function createRateLimiter({ windowMs, max, now = () => Date.now() }) {
  const buckets = new Map();
  let lastSweep = now();
  function sweep(current) {
    lastSweep = current;
    for (const [key, bucket] of buckets) if (bucket.resetAt <= current) buckets.delete(key);
  }
  return {
    hit(key) {
      const current = now();
      if (buckets.size > 5000 || current - lastSweep > windowMs) sweep(current);
      let bucket = buckets.get(key);
      if (!bucket || bucket.resetAt <= current) {
        bucket = { count: 0, resetAt: current + windowMs };
        buckets.set(key, bucket);
      }
      bucket.count += 1;
      if (bucket.count > max) return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - current) / 1000)) };
      return { allowed: true, retryAfterSeconds: 0 };
    },
    get size() { return buckets.size; }
  };
}

// Adresse du client. Derrière un proxy (Render, Cloudflare...), seule l'entrée ajoutée par NOTRE proxy
// est fiable : `hops` indique combien de proxys de confiance se trouvent devant le serveur.
// Les entrées plus à gauche peuvent être écrites par le client et ne sont jamais utilisées.
export function clientIp(request, hops = 1) {
  const forwarded = String(request.headers["x-forwarded-for"] || "")
    .split(",").map((part) => part.trim()).filter(Boolean);
  if (hops > 0 && forwarded.length) {
    const entry = forwarded[Math.max(0, forwarded.length - hops)];
    if (entry) return entry.slice(0, 64);
  }
  return String(request.socket?.remoteAddress || "unknown");
}

// ---------- Pseudos ----------

// Retire les caractères de contrôle et de mise en forme invisibles (inversion de sens de lecture,
// espaces de largeur nulle...) qui permettent de se faire passer pour un autre joueur.
export function cleanName(value) {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFC")
    .replace(/[\p{C}\p{Zl}\p{Zp}]/gu, "")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 32)
    .trim();
}

// ---------- Adresse publique ----------

// L'adresse publique ne doit jamais être fabriquée à partir d'en-têtes arbitraires.
export function safeOrigin(request, { publicUrl, port }) {
  if (publicUrl) return new URL(publicUrl).origin;
  const forwardedProto = String(request.headers["x-forwarded-proto"] || "").split(",")[0].trim().toLowerCase();
  const protocol = forwardedProto === "https" ? "https" : "http";
  const host = String(request.headers.host || "");
  const validHost = /^[a-z0-9.-]{1,253}(:\d{1,5})?$|^\[[0-9a-f:]{2,45}\](:\d{1,5})?$/i.test(host);
  return new URL(protocol + "://" + (validHost ? host : "localhost:" + port)).origin;
}

export function isHttps(request, publicUrl) {
  if (publicUrl) return new URL(publicUrl).protocol === "https:";
  return String(request.headers["x-forwarded-proto"] || "").split(",")[0].trim().toLowerCase() === "https";
}

// ---------- En-têtes de sécurité ----------

// Aucun script en ligne n'existe dans le site : seuls les fichiers du site et les services Google
// nécessaires à AdSense et au message de consentement peuvent s'exécuter. Les gestionnaires
// « onclick » et les scripts injectés dans une page sont donc bloqués par le navigateur.
const GOOGLE_ADS = [
  "https://pagead2.googlesyndication.com",
  "https://*.googlesyndication.com",
  "https://*.doubleclick.net",
  "https://*.adtrafficquality.google",
  "https://*.google.com",
  "https://*.gstatic.com",
  "https://fundingchoicesmessages.google.com",
  "https://partner.googleadservices.com",
  "https://www.googletagservices.com"
];

export const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' " + GOOGLE_ADS.join(" "),
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "connect-src 'self' " + GOOGLE_ADS.join(" "),
  "frame-src " + GOOGLE_ADS.join(" "),
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'"
].join("; ");

export function securityHeaders({ https = false, csp = true } = {}) {
  const headers = {
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "strict-origin-when-cross-origin",
    "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    "cross-origin-resource-policy": "same-origin"
  };
  if (csp) headers["content-security-policy"] = contentSecurityPolicy;
  if (https) headers["strict-transport-security"] = "max-age=15552000; includeSubDomains";
  return headers;
}

// ---------- Cookie de session d'invité ----------

// Un navigateur ne peut avoir qu'une seule session d'invité par partie : rouvrir le lien (même avec un
// autre pseudo, ou après avoir vidé le stockage de la page) reprend la session existante au lieu d'en
// ouvrir une neuve. C'est ce qui empêche de terminer une partie pour lire les réponses de l'hôte puis
// de la rejouer. Le cookie n'authentifie aucune autre action : l'API continue d'exiger l'en-tête Bearer.
export const guestCookieName = (gameId) => "kcg_" + gameId;

export function parseCookies(header) {
  const cookies = new Map();
  for (const part of String(header || "").split(";")) {
    const index = part.indexOf("=");
    if (index < 1) continue;
    const name = part.slice(0, index).trim();
    if (!cookies.has(name)) cookies.set(name, part.slice(index + 1).trim());
  }
  return cookies;
}

export function guestCookie(gameId, token, { https }) {
  return `${guestCookieName(gameId)}=${token}; Path=/; Max-Age=${90 * 24 * 3600}; HttpOnly; SameSite=Lax${https ? "; Secure" : ""}`;
}
