// Stockage distant optionnel : une ou plusieurs bases Redis compatibles Upstash (API REST).
// Sert à garder les parties quand l'hébergeur redémarre ou redéploie le serveur.
// Aucune dépendance : on utilise le fetch natif de Node.
//
// Configuration par variables d'environnement (jusqu'à 5 bases, écrites en parallèle) :
//   base 1 : UPSTASH_REDIS_REST_URL    + UPSTASH_REDIS_REST_TOKEN
//   base 2 : UPSTASH_REDIS_REST_URL_2  + UPSTASH_REDIS_REST_TOKEN_2   (… jusqu'à _5)
//
// Chaque sauvegarde est envoyée à toutes les bases. Au démarrage, on lit toutes les bases
// et on garde la version la plus récente ; les autres sont remises à jour ensuite.

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const MAX_TARGETS = 5;

function targetsFromEnv(env) {
  const targets = [];
  for (let slot = 1; slot <= MAX_TARGETS; slot += 1) {
    const suffix = slot === 1 ? "" : "_" + slot;
    const url = env["UPSTASH_REDIS_REST_URL" + suffix];
    const token = env["UPSTASH_REDIS_REST_TOKEN" + suffix];
    if (url && token) targets.push({ url, token, label: "base " + slot });
  }
  return targets;
}

// Format stocké : {"v":2,"savedAt":<ms>,"games":[…]}. L'ancien format (simple liste) reste lisible.
function parseStored(raw) {
  if (raw === null || raw === undefined) return { ok: true, empty: true, savedAt: 0, games: [] };
  const parsed = JSON.parse(raw);
  if (Array.isArray(parsed)) return { ok: true, empty: false, savedAt: 0, games: parsed };
  if (parsed && Array.isArray(parsed.games)) {
    return { ok: true, empty: false, savedAt: Number(parsed.savedAt) || 0, games: parsed.games };
  }
  throw new Error("format inattendu");
}

const wrap = (gamesJson) => '{"v":2,"savedAt":' + Date.now() + ',"games":' + gamesJson + "}";

function createBackend({ url, token, label }, { key, fetchImpl, log, retryDelayMs }) {
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

  async function read({ attempts, delayMs }) {
    let lastError;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        return { ...parseStored(await command(["GET", key])), label };
      } catch (error) {
        lastError = error;
        if (attempt < attempts) await sleep(delayMs * attempt);
      }
    }
    return { ok: false, label, error: lastError };
  }

  // Écriture « au plus récent » : si plusieurs sauvegardes s'enchaînent, seule la dernière
  // version est envoyée. Chaque base a sa propre file : une base en panne ne bloque pas les autres.
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
          log.error("Sauvegarde distante échouée (" + label + ") :", error.message);
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

  // Un seul essai, borné dans le temps (utilisé à l'arrêt du serveur). Si la base est en panne,
  // on n'insiste pas : la nouvelle tentative automatique reprend dès qu'elle revient.
  async function flush(timeoutMs) {
    if (dirty && !busy) currentRun = run();
    let timer;
    const timeout = new Promise((done) => {
      timer = setTimeout(done, timeoutMs);
      if (typeof timer.unref === "function") timer.unref();
    });
    await Promise.race([currentRun, timeout]);
    clearTimeout(timer);
  }

  return { label, read, save, flush };
}

export function createRemoteStore({
  targets,
  url,
  token,
  key = process.env.GAMES_KEY || "confiance:games",
  fetchImpl = globalThis.fetch,
  log = console,
  retryDelayMs = 5000,
  env = process.env
} = {}) {
  let list = targets;
  if (list === undefined) {
    list = url === undefined && token === undefined ? targetsFromEnv(env) : [{ url, token, label: "base 1" }];
  }
  list = list.filter((target) => target && target.url && target.token).slice(0, MAX_TARGETS);
  if (!list.length) return null;

  const backends = list.map((target, index) =>
    createBackend({ ...target, label: target.label || "base " + (index + 1) }, { key, fetchImpl, log, retryDelayMs })
  );

  // Lit toutes les bases et renvoie les parties de la version la plus récente.
  // On refuse de démarrer « à vide » quand une base est illisible et qu'aucune autre n'a de données :
  // sinon on écraserait ensuite les vraies parties avec une liste vide.
  async function load({ attempts = 4, delayMs = 1500 } = {}) {
    const results = await Promise.all(backends.map((backend) => backend.read({ attempts, delayMs })));
    const failed = results.filter((result) => !result.ok);
    for (const result of failed) log.error("Lecture impossible (" + result.label + ") :", result.error.message);
    const readable = results.filter((result) => result.ok);
    if (!readable.length) throw failed[0].error;
    const withData = readable.filter((result) => !result.empty);
    if (!withData.length) {
      if (failed.length) {
        throw new Error("une base est illisible et les autres sont vides : démarrage refusé pour ne pas écraser des parties");
      }
      return [];
    }
    const best = withData.reduce((latest, candidate) => (candidate.savedAt > latest.savedAt ? candidate : latest));
    return best.games;
  }

  function save(jsonGetter) {
    for (const backend of backends) backend.save(() => wrap(jsonGetter()));
  }

  // À appeler à l'arrêt du serveur pour terminer les envois en cours (5 s maximum).
  async function flush(timeoutMs = 5000) {
    await Promise.all(backends.map((backend) => backend.flush(timeoutMs)));
  }

  return { load, save, flush, size: backends.length };
}
