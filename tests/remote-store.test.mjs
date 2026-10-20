import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRemoteStore } from "../remote-store.mjs";
import { createGameServer } from "../server.mjs";

// Faux serveur Upstash : accepte POST avec une commande Redis sous forme de tableau JSON.
async function startFakeUpstash(t, { failures = 0 } = {}) {
  const data = new Map();
  let remainingFailures = failures;
  const server = createServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += chunk;
    const send = (status, payload) => {
      response.writeHead(status, { "content-type": "application/json" });
      response.end(JSON.stringify(payload));
    };
    if (request.headers.authorization !== "Bearer secret") return send(401, { error: "Unauthorized" });
    if (remainingFailures > 0) { remainingFailures -= 1; return send(500, { error: "boom" }); }
    const [command, key, value] = JSON.parse(body);
    if (command === "GET") return send(200, { result: data.has(key) ? data.get(key) : null });
    if (command === "SET") { data.set(key, value); return send(200, { result: "OK" }); }
    return send(400, { error: "ERR unknown command" });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return { data, url: "http://127.0.0.1:" + server.address().port };
}

const quiet = { error() {} };

test("le stockage distant est désactivé sans configuration", () => {
  assert.equal(createRemoteStore({ url: "", token: "" }), null);
});

test("première utilisation : aucune partie, puis les parties sauvegardées sont relues", async (t) => {
  const fake = await startFakeUpstash(t);
  const store = createRemoteStore({ url: fake.url, token: "secret", key: "k", log: quiet });
  assert.deepEqual(await store.load(), []);
  store.save(() => JSON.stringify([{ id: "a" }]));
  store.save(() => JSON.stringify([{ id: "a" }, { id: "b" }]));
  await store.flush();
  assert.deepEqual(JSON.parse(fake.data.get("k")), [{ id: "a" }, { id: "b" }]);
  assert.deepEqual(await store.load(), [{ id: "a" }, { id: "b" }]);
});

test("une lecture impossible fait échouer le chargement au lieu de renvoyer une liste vide", async (t) => {
  const fake = await startFakeUpstash(t);
  const store = createRemoteStore({ url: fake.url, token: "mauvais", key: "k", log: quiet });
  await assert.rejects(store.load({ attempts: 2, delayMs: 1 }));
});

test("une sauvegarde qui échoue est retentée", async (t) => {
  const fake = await startFakeUpstash(t, { failures: 2 });
  const store = createRemoteStore({ url: fake.url, token: "secret", key: "k", log: quiet, retryDelayMs: 10 });
  store.save(() => JSON.stringify([{ id: "retry" }]));
  await store.flush(2000);
  assert.deepEqual(JSON.parse(fake.data.get("k")), [{ id: "retry" }]);
});

test("une partie créée survit au redémarrage du serveur", async (t) => {
  const fake = await startFakeUpstash(t);
  const options = { url: fake.url, token: "secret", key: "parties", log: quiet };

  const store1 = createRemoteStore(options);
  const server1 = createGameServer({ dataFile: null, store: store1, initialGames: await store1.load() });
  await new Promise((resolve) => server1.listen(0, "127.0.0.1", resolve));
  const base1 = "http://127.0.0.1:" + server1.address().port;
  const created = await (await fetch(base1 + "/api/games", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "Awa" })
  })).json();
  await store1.flush();
  await new Promise((resolve) => server1.close(resolve));

  // « Redémarrage » : nouveau serveur, mémoire vide, rechargé depuis le stockage distant.
  const store2 = createRemoteStore(options);
  const server2 = createGameServer({ dataFile: null, store: store2, initialGames: await store2.load() });
  t.after(() => new Promise((resolve) => server2.close(resolve)));
  await new Promise((resolve) => server2.listen(0, "127.0.0.1", resolve));
  const base2 = "http://127.0.0.1:" + server2.address().port;
  const again = await fetch(base2 + "/api/games/" + created.id, { headers: { authorization: "Bearer " + created.token } });
  assert.equal(again.status, 200);
  const view = await again.json();
  assert.equal(view.role, "A");
});
