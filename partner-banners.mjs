// Bannières d'un partenaire publicitaire tiers (format « iframe » à tailles fixes).
//
// Le code du partenaire écrit dans la page et définit une variable globale : il n'est donc jamais
// placé dans les pages du site. Il s'exécute dans une page-cadre dédiée (/partner-frame), elle-même
// affichée dans un <iframe sandbox> sans accès au site (ni stockage, ni cookies, ni redirection de la page).
// Les clés restent côté serveur. Interrupteur d'urgence : variable d'environnement PARTNER_BANNERS=off.

export const PARTNER_SCRIPT_HOST = "https://bauval.org";

export const PARTNER_UNITS = Object.freeze({
  "300x250": Object.freeze({ key: "76c5052f2a801689d3600cf51177890c", width: 300, height: 250 }),
  "320x50": Object.freeze({ key: "c9246a4bed5b548e8ae94120a2dc9c8b", width: 320, height: 50 }),
  "468x60": Object.freeze({ key: "9370943f2b44ac30914a789ac7239821", width: 468, height: 60 }),
  "160x300": Object.freeze({ key: "a163328196b07694a5dc88fd213339fb", width: 160, height: 300 }),
  "160x600": Object.freeze({ key: "37119f0aa226874aa33d69a60b35da14", width: 160, height: 600 }),
  "728x90": Object.freeze({ key: "332ae698604f3bced85e4b478b415e2d", width: 728, height: 90 })
});

export const partnerEnabled = (env = process.env) => !/^(0|off|false|no|non)$/i.test(String(env.PARTNER_BANNERS ?? "").trim());

export const partnerUnit = (size) => (typeof size === "string" && Object.hasOwn(PARTNER_UNITS, size) ? PARTNER_UNITS[size] : null);

// Politique propre à la page-cadre : un script en ligne protégé par un nonce, puis le code du partenaire.
// La page est isolée par l'attribut sandbox de l'<iframe> qui l'affiche (aucune origine partagée avec le site).
export function partnerFramePolicy(nonce) {
  return [
    "default-src 'none'",
    `script-src 'nonce-${nonce}' https:`,
    "frame-src https:",
    "img-src https: data:",
    "style-src 'unsafe-inline'",
    "connect-src https:",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'self'"
  ].join("; ");
}

export function partnerFrameHtml(unit, nonce) {
  const options = JSON.stringify({ key: unit.key, format: "iframe", height: unit.height, width: unit.width, params: {} });
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><style>html,body{margin:0;padding:0;overflow:hidden;background:transparent}</style></head>
<body>
<script nonce="${nonce}">atOptions = ${options};</script>
<script src="${PARTNER_SCRIPT_HOST}/22/${unit.key}"></script>
</body></html>
`;
}
