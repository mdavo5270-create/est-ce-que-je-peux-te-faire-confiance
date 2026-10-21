// Stockage distant optionnel : les parties sont réparties entre plusieurs bases Redis
// compatibles Upstash (API REST), pour qu'aucune base ne sature, plus une base « collectrice »
// facultative qui rassemble toutes les parties à intervalle régulier.
// Aucune dépendance : on utilise le fetch natif de Node.
//
// Variables d'environnement :
//   bases de répartition (jusqu'à 5) :
//     UPSTASH_REDIS_REST_URL    + UPSTASH_REDIS_REST_TOKEN        (base 1)
//     UPSTASH_REDIS_REST_URL_2  + UPSTASH_REDIS_REST_TOKEN_2      (… jusqu'à _5)
//   base collectrice (facultative) :
//     UPSTASH_REDIS_REST_URL_COLLECTOR + UPSTASH_REDIS_REST_TOKEN_COLLECTOR
//   COLLECT_INTERVAL_SECONDS : fréquence d'envoi vers la collectrice (60 par défaut)
//
// Organisation : chaque partie vit dans UNE seule base, choisie d'après son identifiant.
// Dans chaque base, toutes les parties sont les champs d'une table de hachage Redis (HASH) :
// une action de joueur n'écrit donc que sa partie, jamais l'ensemble.

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const MAX_SHARDS = 5;
const PIPELINE_CHUNK = 100;
const LEGACY_KEY = "confiance:games"; // anciens formats (une seule valeur contenant toutes les parties)
const HEARTBEAT_KEY = "confiance:heartbeat";

function fnv1a(text) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function configFromEnv(env) {
  const shards = [];
  for (let slot = 1; slot <= MAX_SHARDS; slot += 1) {
    const suffix = slot === 1 ? "" : "_" + slot;
    const url = env["UPSTASH_REDIS_REST_URL" + suffix];
    const token = env["UPSTASH_REDIS_REST_TOKEN" + suffix];
    if (url && token) shards.push({ url, token, label: "base " + slot });
  }
  const url = env.UPSTASH_REDIS_REST_URL_COLLECTOR;
  const token = env.UPSTASH_REDIS_REST_TOKEN_COLLECTOR;
  return { shards, collector: url && token ? { url, token, label: "base collectrice" } : null };
}

function toEntries(result) {
  const entries = new Map();
  if (Array.isArray(result)) {
    for (let index = 0; index + 1 < result.length; index += 2) entries.set(String(result[index]), String(result[index + 1]));
  } else if (result && typeof result === "object") {
    for (const [field, value] of Object.entries(result)) entries.set(field, String(value));
  }
  return entries;
}

function parseLegacy(raw) {
  if (raw === null || raw === undefined) return null;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return { savedAt: 0, games: parsed };
    if (parsed && Array.isArray(parsed.games)) return { savedAt: Number(parsed.savedAt) || 0, games: parsed.games };
  } catch {
    // ancien format illisible : ignoré
  }
  return null;
}

function createBackend({ url, token, label }, { key, fetchImpl, log, retryDelayMs, deferred = false }) {
  const endpoint = url.replace(/\/+$/, "");

  async function request(path, body) {
    const response = await fetchImpl(endpoint + path, {
      method: "POST",
      headers: { authorization: "Bearer " + token, "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error("Upstash : " + ((payload && payload.error) || "HTTP " + response.status));
    return payload;
  }

  async function command(args) {
    const payload = await request("", args);
    if (payload && payload.error) throw new Error("Upstash : " + payload.error);
    return payload ? payload.result : undefined;
  }

  async function pipeline(commands) {
    if (!commands.length) return [];
    const payload = await request("/pipeline", commands);
    if (!Array.isArray(payload) || payload.length !== commands.length) throw new Error("Upstash : réponse de pipeline inattendue");
    return payload;
  }

  async function readAll({ attempts, delayMs }) {
    let lastError;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        const [hash, legacy] = await pipeline([["HGETALL", key], ["GET", LEGACY_KEY]]);
        if (hash.error || legacy.error) throw new Error("Upstash : " + (hash.error || legacy.error));
        return { ok: true, label, entries: toEntries(hash.result), legacy: parseLegacy(legacy.result) };
      } catch (error) {
        lastError = error;
        if (attempt < attempts) await sleep(delayMs * attempt);
      }
    }
    return { ok: false, label, error: lastError };
  }

  // Écriture directe d'un lot de parties (réparations au démarrage). Renvoie true si tout est passé.
  async function writeBatch(items) {
    try {
      for (let start = 0; start < items.length; start += PIPELINE_CHUNK) {
        const chunk = items.slice(start, start + PIPELINE_CHUNK);
        const results = await pipeline(chunk.map(([id, json]) => ["HSET", key, id, json]));
        if (results.some((item) => item.error)) return false;
      }
      return true;
    } catch (error) {
      log.error("Écriture impossible (" + label + ") :", error.message);
      return false;
    }
  }

  async function removeFields(ids) {
    try {
      for (let start = 0; start < ids.length; start += PIPELINE_CHUNK) {
        await pipeline(ids.slice(start, start + PIPELINE_CHUNK).map((id) => ["HDEL", key, id]));
      }
      return true;
    } catch (error) {
      log.error("Nettoyage impossible (" + label + ") :", error.message);
      return false;
    }
  }

  async function removeLegacy() {
    try {
      await command(["DEL", LEGACY_KEY]);
    } catch (error) {
      log.error("Nettoyage impossible (" + label + ") :", error.message);
    }
  }

  async function touch() {
    try {
      await command(["SET", HEARTBEAT_KEY, String(Date.now())]);
    } catch (error) {
      log.error("Écriture de maintien impossible (" + label + ") :", error.message);
    }
  }

  // File d'écriture : une entrée par partie (la plus récente gagne), envoyée par lots.
  // Chaque base a sa propre file : une base en panne ne bloque pas les autres.
  // Une base « différée » (la collectrice) n'envoie que lorsqu'on appelle kick().
  const pending = new Map();
  let busy = false;
  let retryScheduled = false;
  let currentRun = Promise.resolve();

  function requeue(items) {
    for (const [id, json] of items) if (!pending.has(id)) pending.set(id, json);
  }

  async function run() {
    busy = true;
    try {
      while (pending.size) {
        const batch = [...pending.entries()].slice(0, PIPELINE_CHUNK);
        for (const [id] of batch) pending.delete(id);
        let results;
        try {
          results = await pipeline(batch.map(([id, json]) => ["HSET", key, id, json]));
        } catch (error) {
          requeue(batch);
          log.error("Sauvegarde distante échouée (" + label + ") :", error.message);
          scheduleRetry();
          break;
        }
        const failed = batch.filter((_, index) => results[index].error);
        if (failed.length) {
          requeue(failed);
          log.error("Sauvegarde distante échouée (" + label + ") :", results.find((item) => item.error).error);
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
      if (pending.size && !busy) currentRun = run();
    }, retryDelayMs);
    if (typeof timer.unref === "function") timer.unref();
  }

  function enqueue(id, json) {
    pending.set(id, json);
    if (!deferred && !busy) currentRun = run();
  }

  function kick() {
    if (pending.size && !busy) currentRun = run();
    return currentRun;
  }

  // Un seul essai, borné dans le temps (arrêt du serveur) : si la base est en panne on n'insiste pas.
  async function flush(timeoutMs) {
    kick();
    let timer;
    const timeout = new Promise((done) => {
      timer = setTimeout(done, timeoutMs);
      if (typeof timer.unref === "function") timer.unref();
    });
    await Promise.race([currentRun, timeout]);
    clearTimeout(timer);
  }

  return { label, readAll, writeBatch, removeFields, removeLegacy, touch, enqueue, kick, flush };
}

export function createRemoteStore({
  shards,
  collector,
  url,
  token,
  key = process.env.GAMES_KEY || "confiance:games:h",
  fetchImpl = globalThis.fetch,
  log = console,
  retryDelayMs = 5000,
  collectIntervalMs,
  env = process.env
} = {}) {
  let shardConfigs = shards;
  let collectorConfig = collector;
  if (shardConfigs === undefined) {
    if (url === undefined && token === undefined) {
      const fromEnv = configFromEnv(env);
      shardConfigs = fromEnv.shards;
      if (collectorConfig === undefined) collectorConfig = fromEnv.collector;
    } else {
      shardConfigs = [{ url, token, label: "base 1" }];
    }
  }
  shardConfigs = shardConfigs.filter((item) => item && item.url && item.token).slice(0, MAX_SHARDS);
  if (!shardConfigs.length) return null;
  const validCollector = collectorConfig && collectorConfig.url && collectorConfig.token ? collectorConfig : null;

  const shared = { key, fetchImpl, log, retryDelayMs };
  const shardBackends = shardConfigs.map((item, index) =>
    createBackend({ ...item, label: item.label || "base " + (index + 1) }, shared)
  );
  const collectorBackend = validCollector
    ? createBackend({ ...validCollector, label: validCollector.label || "base collectrice" }, { ...shared, deferred: true })
    : null;
  const intervalMs = collectIntervalMs ?? Number(env.COLLECT_INTERVAL_SECONDS || 60) * 1000;

  const ownerOf = (id) => fnv1a(String(id)) % shardBackends.length;
  let collectTimer = null;

  // Lit toutes les bases, rassemble les parties et remet chaque partie dans sa base d'origine
  // si elle se trouve ailleurs (changement du nombre de bases, ancien format, base remplacée).
  async function load({ attempts = 4, delayMs = 1500 } = {}) {
    const [shardResults, collectorResult] = await Promise.all([
      Promise.all(shardBackends.map((backend) => backend.readAll({ attempts, delayMs }))),
      collectorBackend ? collectorBackend.readAll({ attempts, delayMs }) : null
    ]);
    const failedShards = shardResults.filter((result) => !result.ok);
    for (const result of failedShards) log.error("Lecture impossible (" + result.label + ") :", result.error.message);
    if (collectorResult && !collectorResult.ok) log.error("Lecture impossible (" + collectorResult.label + ") :", collectorResult.error.message);
    const collectorReadable = Boolean(collectorResult && collectorResult.ok);
    // Démarrer avec une base illisible sans pouvoir la remplacer fausserait tout : on s'arrête
    // plutôt que de risquer de perdre ou d'écraser des parties.
    if (failedShards.length && !collectorReadable) {
      throw new Error("une base est illisible et aucune base collectrice ne peut la remplacer : démarrage refusé pour ne pas perdre de parties");
    }

    // 1. Parties trouvées dans les bases (la copie de la base d'origine est prioritaire).
    const found = new Map();
    shardResults.forEach((result, index) => {
      if (!result.ok) return;
      for (const [id, json] of result.entries) {
        if (!found.has(id) || index === ownerOf(id)) found.set(id, { json, shard: index });
      }
    });
    // 2. Ancien format : on reprend la version la plus récente.
    const legacies = shardResults.filter((result) => result.ok && result.legacy).map((result) => result.legacy);
    const legacy = legacies.reduce((latest, item) => (!latest || item.savedAt > latest.savedAt ? item : latest), null);
    for (const game of legacy ? legacy.games : []) {
      if (game && game.id && !found.has(game.id)) found.set(game.id, { json: JSON.stringify(game), shard: -1 });
    }
    // 3. Base collectrice : complète ce qui manque (base remplacée, base en panne).
    if (collectorReadable) {
      for (const [id, json] of collectorResult.entries) if (!found.has(id)) found.set(id, { json, shard: -1 });
    }

    // Réparations : chaque partie mal placée est recopiée dans sa base d'origine, puis retirée de l'autre.
    const repairs = shardBackends.map(() => new Map());
    const cleanups = shardBackends.map(() => []);
    for (const [id, entry] of found) {
      const owner = ownerOf(id);
      if (shardResults[owner].ok && entry.shard !== owner) repairs[owner].set(id, entry.json);
    }
    shardResults.forEach((result, index) => {
      if (!result.ok) return;
      for (const id of result.entries.keys()) {
        if (ownerOf(id) !== index && shardResults[ownerOf(id)].ok) cleanups[index].push(id);
      }
    });
    const repairOk = await Promise.all(repairs.map((items, owner) => (items.size ? shardBackends[owner].writeBatch([...items]) : true)));
    await Promise.all(cleanups.map((ids, index) => {
      const safe = ids.filter((id) => {
        const owner = ownerOf(id);
        return found.get(id).shard === owner || repairOk[owner];
      });
      return safe.length ? shardBackends[index].removeFields(safe) : null;
    }));
    if (legacy && repairOk.every(Boolean)) {
      await Promise.all(shardResults.map((result, index) => (result.ok && result.legacy ? shardBackends[index].removeLegacy() : null)));
    }

    // Base collectrice : on lui envoie ce qui diffère, puis un lot à chaque intervalle.
    if (collectorBackend) {
      for (const [id, entry] of found) {
        if (!collectorReadable || collectorResult.entries.get(id) !== entry.json) collectorBackend.enqueue(id, entry.json);
      }
      collectorBackend.kick();
      collectTimer = setInterval(() => collectorBackend.kick(), intervalMs);
      if (typeof collectTimer.unref === "function") collectTimer.unref();
    }

    const games = [];
    for (const [id, entry] of found) {
      try {
        games.push(JSON.parse(entry.json));
      } catch {
        log.error("Partie illisible ignorée :", id);
      }
    }
    return games;
  }

  // Une action de joueur : seule sa partie est écrite, dans sa base d'origine.
  function saveGame(game) {
    const json = JSON.stringify(game);
    shardBackends[ownerOf(game.id)].enqueue(game.id, json);
    if (collectorBackend) collectorBackend.enqueue(game.id, json);
  }

  // Une écriture minuscule dans chaque base : une base inactive finirait archivée.
  function touch() {
    for (const backend of [...shardBackends, ...(collectorBackend ? [collectorBackend] : [])]) backend.touch();
  }

  // À l'arrêt du serveur : termine les envois en cours (5 s maximum).
  async function flush(timeoutMs = 5000) {
    await Promise.all([...shardBackends, ...(collectorBackend ? [collectorBackend] : [])].map((backend) => backend.flush(timeoutMs)));
  }

  return { load, saveGame, touch, flush, size: shardBackends.length, hasCollector: Boolean(collectorBackend), ownerOf };
}
