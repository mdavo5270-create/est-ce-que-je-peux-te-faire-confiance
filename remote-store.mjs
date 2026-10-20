// Stockage distant optionnel (Upstash Redis via son API REST).
// Sert à garder les parties quand l'hébergeur redémarre ou redéploie le serveur.
// Aucune dépendance : on utilise le fetch natif de Node.
// Actif seulement si UPSTASH_REDIS_REST_URL et UPSTASH_REDIS_REST_TOKEN sont définis.

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

export function createRemoteStore({
  url = process.env.UPSTASH_REDIS_REST_URL,
  token = process.env.UPSTASH_REDIS_REST_TOKEN,
  key = process.env.GAMES_KEY || "confiance:games",
  fetchImpl = globalThis.fetch,
  log = console,
  retryDelayMs = 5000
} = {}) {
  if (!url || !token) return null;
  const endpoint = url.replace(/\/+$/, "");

  async function command(args) {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: { authorization: "Bearer " + token, "content-type": "application/json" },
      body: JSON.stringify(args)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.error) throw new Error("Upstash : " + (payload.error || "HTTP " + response.status));
    return payload.result;
  }

  // Lit les parties. Une clé absente = première utilisation (liste vide).
  // En cas d'erreur on lève une exception : il vaut mieux ne pas démarrer que de
  // démarrer avec une liste vide et écraser les vraies parties à la prochaine sauvegarde.
  async function load({ attempts = 4, delayMs = 1500 } = {}) {
    let lastError;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        const raw = await command(["GET", key]);
        if (raw === null || raw === undefined) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) throw new Error("format inattendu");
        return parsed;
      } catch (error) {
        lastError = error;
        if (attempt < attempts) await sleep(delayMs * attempt);
      }
    }
    throw lastError;
  }

  // Écriture « au plus récent » : si plusieurs sauvegardes s'enchaînent,
  // seule la dernière version est envoyée.
  let getJson = null;
  let dirty = false;
  let busy = false;
  let retryScheduled = false;
  let currentRun = Promise.resolve();

  async function run() {
    busy = true;
    try {
      while (dirty) {
        dirty = false;
        try {
          await command(["SET", key, getJson()]);
        } catch (error) {
          dirty = true;
          log.error("Sauvegarde distante échouée :", error.message);
          scheduleRetry();
          break;
        }
      }
    } finally {
      busy = false;
    }
  }

  function scheduleRetry() {
    if (retryScheduled) return;
    retryScheduled = true;
    const timer = setTimeout(() => {
      retryScheduled = false;
      if (dirty && !busy) currentRun = run();
    }, retryDelayMs);
    if (typeof timer.unref === "function") timer.unref();
  }

  function save(jsonGetter) {
    getJson = jsonGetter;
    dirty = true;
    if (!busy) currentRun = run();
  }

  // À appeler à l'arrêt du serveur pour terminer l'envoi en cours (5 s maximum).
  async function flush(timeoutMs = 5000) {
    const deadline = Date.now() + timeoutMs;
    while ((dirty || busy) && Date.now() < deadline) {
      if (!busy) currentRun = run();
      await Promise.race([currentRun, sleep(Math.max(0, deadline - Date.now()))]);
    }
  }

  return { load, save, flush };
}
