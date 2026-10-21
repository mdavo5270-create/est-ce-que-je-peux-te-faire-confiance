import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRemoteStore } from "../remote-store.mjs";
import { createGameServer } from "../server.mjs";

const KEY = "k";
const quiet = { error() {} };
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
async function waitFor(check, ms = 2000) {
  for (let waited = 0; !check() && waited < ms; waited += 20) await wait(20);
  return check();
}

// Faux serveur Upstash : commandes Redis simples (GET, SET, DEL, HSET, HGETALL, HDEL), seules ou en pipeline.
async function startFakeUpstash(t, { failures = 0 } = {}) {
  const strings = new Map();
  const hashes = new Map();
  const stats = { commands: 0 };
  let remainingFailures = failures;
  function execute([command, ...args]) {
    stats.commands += 1;
    switch (command) {
      case "GET": return { result: strings.has(args[0]) ? strings.get(args[0]) : null };
      case "SET": strings.set(args[0], args[1]); return { result: "OK" };
      case "DEL": return { result: strings.delete(args[0]) || hashes.delete(args[0]) ? 1 : 0 };
      case "HGETALL": return { result: hashes.has(args[0]) ? [...hashes.get(args[0])].flat() : [] };
      case "HSET":
        if (!hashes.has(args[0])) hashes.set(args[0], new Map());
        hashes.get(args[0]).set(args[1], args[2]);
        return { result: 1 };
      case "HDEL": return { result: hashes.has(args[0]) && hashes.get(args[0]).delete(args[1]) ? 1 : 0 };
      default: return { error: "ERR unknown command" };
    }
  }
  const server = createServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += chunk;
    const send = (status, payload) => {
      response.writeHead(status, { "content-type": "application/json" });
      response.end(JSON.stringify(payload));
    };
    if (request.headers.authorization !== "Bearer secret") return send(401, { error: "Unauthorized" });
    if (remainingFailures > 0) { remainingFailures -= 1; return send(500, { error: "boom" }); }
    const parsed = JSON.parse(body);
    if (request.url === "/pipeline") return send(200, parsed.map(execute));
    const outcome = execute(parsed);
    return send(outcome.error ? 400 : 200, outcome);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return {
    url: "http://127.0.0.1:" + server.address().port,
    token: "secret",
    strings,
    stats,
    games: () => Object.fromEntries(hashes.get(KEY) || []),
    put: (id, game) => {
      if (!hashes.has(KEY)) hashes.set(KEY, new Map());
      hashes.get(KEY).set(id, JSON.stringify(game));
    }
  };
}

const target = (fake) => ({ url: fake.url, token: fake.token });
const DEAD = { url: "http://127.0.0.1:1", token: "secret" };
const makeStore = (options) => createRemoteStore({ key: KEY, log: quiet, retryDelayMs: 10, collectIntervalMs: 60000, ...options });

test("le stockage distant est désactivé sans configuration", () => {
  assert.equal(createRemoteStore({ env: {} }), null);
  assert.equal(createRemoteStore({ url: "", token: "" }), null);
});

test("les bases sont lues depuis l'environnement : 5 de répartition au maximum + une collectrice", () => {
  const env = { UPSTASH_REDIS_REST_URL_COLLECTOR: "http://c", UPSTASH_REDIS_REST_TOKEN_COLLECTOR: "t" };
  for (let slot = 1; slot <= 7; slot += 1) {
    const suffix = slot === 1 ? "" : "_" + slot;
    env["UPSTASH_REDIS_REST_URL" + suffix] = "http://x" + slot;
    env["UPSTASH_REDIS_REST_TOKEN" + suffix] = "t" + slot;
  }
  const store = createRemoteStore({ env });
  assert.equal(store.size, 5);
  assert.equal(store.hasCollector, true);
  assert.equal(createRemoteStore({ env: { UPSTASH_REDIS_REST_URL: "http://x", UPSTASH_REDIS_REST_TOKEN: "t" } }).hasCollector, false);
  assert.equal(createRemoteStore({ env: { UPSTASH_REDIS_REST_URL_2: "http://x" } }), null);
});

test("chaque partie est écrite dans une seule base, et les parties se répartissent entre les bases", async (t) => {
  const fakes = [];
  for (let index = 0; index < 5; index += 1) fakes.push(await startFakeUpstash(t));
  const store = makeStore({ shards: fakes.map(target) });
  for (let index = 0; index < 40; index += 1) store.saveGame({ id: "g" + index, n: index });
  await store.flush();
  const stored = fakes.map((fake) => Object.keys(fake.games()));
  assert.equal(stored.flat().length, 40);
  assert.equal(new Set(stored.flat()).size, 40);
  stored.forEach((ids, index) => ids.forEach((id) => assert.equal(store.ownerOf(id), index)));
  assert.ok(stored.filter((ids) => ids.length > 0).length >= 4, "les parties doivent être réparties");
});

test("une action n'écrit que la partie concernée, jamais l'ensemble", async (t) => {
  const fake = await startFakeUpstash(t);
  const store = makeStore({ shards: [target(fake)] });
  for (let index = 0; index < 20; index += 1) store.saveGame({ id: "g" + index });
  await store.flush();
  const before = fake.stats.commands;
  store.saveGame({ id: "g3", changed: true });
  await store.flush();
  assert.equal(fake.stats.commands - before, 1);
  assert.equal(JSON.parse(fake.games().g3).changed, true);
});

test("au démarrage, les parties de toutes les bases sont rassemblées", async (t) => {
  const fakes = [await startFakeUpstash(t), await startFakeUpstash(t), await startFakeUpstash(t)];
  const store = makeStore({ shards: fakes.map(target) });
  for (let index = 0; index < 12; index += 1) fakes[store.ownerOf("g" + index)].put("g" + index, { id: "g" + index });
  const games = await store.load();
  assert.deepEqual(games.map((game) => game.id).sort(), Array.from({ length: 12 }, (_, index) => "g" + index).sort());
});

test("une partie rangée dans la mauvaise base est replacée dans sa base d'origine", async (t) => {
  const fakes = [await startFakeUpstash(t), await startFakeUpstash(t)];
  const store = makeStore({ shards: fakes.map(target) });
  const owner = store.ownerOf("égarée");
  const wrong = 1 - owner;
  fakes[wrong].put("égarée", { id: "égarée" });
  const games = await store.load();
  assert.equal(games.length, 1);
  assert.ok("égarée" in fakes[owner].games());
  assert.ok(!("égarée" in fakes[wrong].games()));
});

test("l'ancien format (une seule valeur) est repris puis nettoyé", async (t) => {
  const fakes = [await startFakeUpstash(t), await startFakeUpstash(t)];
  fakes[0].strings.set("confiance:games", JSON.stringify({ v: 2, savedAt: 5, games: [{ id: "ancienne" }] }));
  fakes[1].strings.set("confiance:games", JSON.stringify({ v: 2, savedAt: 9, games: [{ id: "ancienne" }, { id: "plus-recente" }] }));
  const store = makeStore({ shards: fakes.map(target) });
  const games = await store.load();
  assert.deepEqual(games.map((game) => game.id).sort(), ["ancienne", "plus-recente"]);
  assert.ok("ancienne" in fakes[store.ownerOf("ancienne")].games());
  assert.ok("plus-recente" in fakes[store.ownerOf("plus-recente")].games());
  assert.equal(fakes[0].strings.has("confiance:games"), false);
  assert.equal(fakes[1].strings.has("confiance:games"), false);
});

test("la base collectrice reçoit toutes les parties, en lot, et rattrape celles qui existaient déjà", async (t) => {
  const fakes = [await startFakeUpstash(t), await startFakeUpstash(t)];
  const collector = await startFakeUpstash(t);
  const store = makeStore({ shards: fakes.map(target), collector: target(collector) });
  fakes[store.ownerOf("existante")].put("existante", { id: "existante" });
  await store.load();
  await store.flush();
  assert.ok("existante" in collector.games(), "la partie déjà présente est copiée au démarrage");
  for (const id of ["a", "b", "c"]) store.saveGame({ id });
  await store.flush();
  assert.deepEqual(Object.keys(collector.games()).sort(), ["a", "b", "c", "existante"]);
});

test("une base en panne remplacée par la collectrice : démarrage possible, sinon refusé", async (t) => {
  const healthy = await startFakeUpstash(t);
  const collector = await startFakeUpstash(t);
  const store = makeStore({ shards: [DEAD, target(healthy)], collector: target(collector) });
  let ownedByDead = 0;
  while (store.ownerOf("sur-base-morte-" + ownedByDead) !== 0) ownedByDead += 1;
  const id = "sur-base-morte-" + ownedByDead;
  collector.put(id, { id });
  assert.deepEqual((await store.load({ attempts: 1, delayMs: 1 })).map((game) => game.id), [id]);

  const withoutCollector = makeStore({ shards: [DEAD, target(healthy)] });
  await assert.rejects(withoutCollector.load({ attempts: 1, delayMs: 1 }), /démarrage refusé/);
});

test("une base en panne ne bloque pas l'écriture dans les autres", async (t) => {
  const healthy = await startFakeUpstash(t);
  const store = makeStore({ shards: [DEAD, target(healthy)] });
  const ids = [];
  for (let index = 0; ids.length < 6; index += 1) if (store.ownerOf("p" + index) === 1) ids.push("p" + index);
  for (const id of ids) store.saveGame({ id });
  store.saveGame({ id: "q0" });
  await store.flush(500);
  assert.deepEqual(Object.keys(healthy.games()).sort(), ids.sort());
});

test("une sauvegarde qui échoue est retentée automatiquement", async (t) => {
  const fake = await startFakeUpstash(t, { failures: 2 });
  const store = makeStore({ shards: [target(fake)] });
  store.saveGame({ id: "retry" });
  assert.ok(await waitFor(() => "retry" in fake.games()));
});

test("une lecture impossible fait échouer le démarrage au lieu de repartir à vide", async (t) => {
  const fake = await startFakeUpstash(t);
  const store = makeStore({ shards: [{ url: fake.url, token: "mauvais" }] });
  await assert.rejects(store.load({ attempts: 2, delayMs: 1 }));
});

test("un petit signe de vie est écrit dans chaque base", async (t) => {
  const fakes = [await startFakeUpstash(t), await startFakeUpstash(t)];
  const collector = await startFakeUpstash(t);
  makeStore({ shards: fakes.map(target), collector: target(collector) }).touch();
  assert.ok(await waitFor(() => [...fakes, collector].every((fake) => fake.strings.has("confiance:heartbeat"))));
});

test("une partie créée survit au redémarrage du serveur, avec plusieurs bases", async (t) => {
  const fakes = [];
  for (let index = 0; index < 3; index += 1) fakes.push(await startFakeUpstash(t));
  const collector = await startFakeUpstash(t);
  const options = { shards: fakes.map(target), collector: target(collector) };

  const store1 = makeStore(options);
  const server1 = createGameServer({ dataFile: null, store: store1, initialGames: await store1.load() });
  await new Promise((resolve) => server1.listen(0, "127.0.0.1", resolve));
  const created = await (await fetch("http://127.0.0.1:" + server1.address().port + "/api/games", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "Awa" })
  })).json();
  await store1.flush();
  await new Promise((resolve) => server1.close(resolve));
  assert.equal(fakes.map((fake) => Object.keys(fake.games()).length).reduce((a, b) => a + b, 0), 1);
  assert.ok(created.id in collector.games());

  // « Redémarrage » : nouveau serveur, mémoire vide, rechargé depuis les bases.
  const store2 = makeStore(options);
  const server2 = createGameServer({ dataFile: null, store: store2, initialGames: await store2.load() });
  t.after(() => new Promise((resolve) => server2.close(resolve)));
  await new Promise((resolve) => server2.listen(0, "127.0.0.1", resolve));
  const again = await fetch("http://127.0.0.1:" + server2.address().port + "/api/games/" + created.id, {
    headers: { authorization: "Bearer " + created.token }
  });
  assert.equal(again.status, 200);
});
