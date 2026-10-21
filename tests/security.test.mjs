import test from "node:test";
import assert from "node:assert/strict";
import { createGameServer } from "../server.mjs";
import { createRemoteStore } from "../remote-store.mjs";
import { cleanName, clientIp, createRateLimiter, safeOrigin } from "../security.mjs";
import { personalQuestions, situations } from "../quiz-banks.mjs";

async function startServer(t, options = {}) {
  const server = createGameServer({ dataFile: null, ...options });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  t.after(() => new Promise((resolve) => { server.closeAllConnections?.(); server.close(resolve); }));
  return "http://127.0.0.1:" + server.address().port;
}
async function call(base, path, { method = "GET", token, body, raw, headers = {} } = {}) {
  const response = await fetch(base + path, {
    method,
    headers: { ...(token ? { authorization: "Bearer " + token } : {}), ...(body !== undefined || raw !== undefined ? { "content-type": "application/json" } : {}), ...headers },
    body: raw !== undefined ? raw : body !== undefined ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  let data = null;
  try { data = JSON.parse(text); } catch { /* page HTML */ }
  return { status: response.status, data, headers: response.headers, text };
}
const setupBody = {
  personal: personalQuestions.slice(0, 3).map((item) => ({ id: item.id, answerIndex: 0 })),
  situations: situations.slice(0, 4).map((item) => ({ id: item.id, idealIndex: 0, alternativeIndex: 1 }))
};
async function preparedHost(base) {
  const created = await call(base, "/api/games", { method: "POST", body: { name: "Alex" } });
  const { id, token } = created.data;
  for (let turn = 0; turn < 3; turn += 1) {
    await call(base, "/api/games/" + id + "/roll", { method: "POST", token, body: {} });
    await call(base, "/api/games/" + id + "/choice", { method: "POST", token, body: { choice: "VOLER" } });
  }
  await call(base, "/api/games/" + id + "/setup", { method: "POST", token, body: setupBody });
  const invite = new URL((await call(base, "/api/games/" + id + "/invite", { token })).data.url).searchParams.get("invite");
  return { id, token, invite };
}

test("chaque réponse porte les en-têtes de sécurité et une politique CSP sans script en ligne", async (t) => {
  const base = await startServer(t);
  for (const path of ["/", "/api/health", "/dilemmes"]) {
    const { headers } = await call(base, path);
    assert.equal(headers.get("x-frame-options"), "DENY", path);
    assert.equal(headers.get("x-content-type-options"), "nosniff", path);
    const csp = headers.get("content-security-policy");
    assert.ok(csp, path);
    assert.match(csp, /object-src 'none'/);
    assert.match(csp, /frame-ancestors 'none'/);
    assert.ok(!/script-src[^;]*'unsafe-inline'/.test(csp), "aucun script en ligne autorisé");
    assert.ok(!/script-src[^;]*'unsafe-eval'/.test(csp));
  }
});

test("les pages servies ne contiennent aucun script en ligne exécutable ni gestionnaire d'événement", async (t) => {
  const base = await startServer(t);
  for (const path of ["/", "/guide.html", "/dilemmes", "/dilemmes/" + (await call(base, "/dilemmes")).text.match(/\/dilemmes\/([\w-]+)/)[1]]) {
    const { text } = await call(base, path);
    const inline = [...text.matchAll(/<script\b([^>]*)>/g)].filter((m) => !/\bsrc=/.test(m[1]) && !/application\/ld\+json/.test(m[1]));
    assert.equal(inline.length, 0, path + " contient un script en ligne");
    assert.ok(!/\son(click|load|error|mouseover)\s*=/i.test(text), path + " contient un gestionnaire en ligne");
  }
});

test("le jeton n'est plus accepté dans l'adresse (il fuiterait dans les journaux)", async (t) => {
  const base = await startServer(t);
  const { id, token } = await preparedHost(base);
  assert.equal((await call(base, "/api/games/" + id + "?token=" + token)).status, 401);
  assert.equal((await call(base, "/api/games/" + id, { token })).status, 200);
});

test("les corps JSON invalides renvoient 400 et jamais 500", async (t) => {
  const base = await startServer(t);
  for (const raw of ["null", "[]", "42", "\"texte\"", "{"]) {
    const response = await call(base, "/api/games", { method: "POST", raw });
    assert.equal(response.status, 400, raw);
  }
  const { id, token } = await preparedHost(base);
  const created = await call(base, "/api/games", { method: "POST", body: { name: "Bob" } });
  const other = created.data;
  await call(base, "/api/games/" + other.id + "/roll", { method: "POST", token: other.token, body: {} });
  for (const bad of [{ personal: [null, null, null], situations: [null, null, null, null] }, { personal: "x", situations: 3 }]) {
    const response = await call(base, "/api/games/" + id + "/setup", { method: "POST", token, body: bad });
    assert.ok([400, 409].includes(response.status), "setup " + JSON.stringify(bad) + " -> " + response.status);
  }
});

test("un chemin mal encodé ou traversant ne plante pas le serveur et ne sort pas du dossier public", async (t) => {
  const base = await startServer(t);
  assert.equal((await call(base, "/%E0%A4%A")).status, 404);
  assert.equal((await call(base, "/%00")).status, 404);
  const traversal = await fetch(base + "/..%2f..%2fserver.mjs");
  assert.equal(traversal.status, 404);
  assert.ok(!(await traversal.text()).includes("createGameServer"));
});

test("une injection (SQL, script, caractères de contrôle) dans un pseudo est traitée comme du texte inerte", async (t) => {
  const base = await startServer(t);
  const { id, invite } = await preparedHost(base);
  const payload = "x'; DROP TABLE games;--<script>alert(1)</script>";
  const joined = await call(base, "/api/games/" + id + "/join", { method: "POST", body: { invite, name: payload } });
  assert.equal(joined.status, 201);
  assert.equal(joined.data.data.myName, payload.slice(0, 32), "le pseudo est conservé comme du texte, jamais interprété");
  const spoof = await call(base, "/api/games/" + id + "/join", { method: "POST", body: { invite, name: "​Al‮ex" } });
  assert.equal(spoof.status, 201);
  assert.equal(spoof.data.data.myName, "Alex", "les caractères invisibles sont retirés");
});

test("cleanName retire les caractères de contrôle et de sens de lecture", () => {
  assert.equal(cleanName("  A​l‮e\u0000x  "), "Alex");
  assert.equal(cleanName("a   b"), "a b");
  assert.equal(cleanName(42), "");
  assert.equal(cleanName("é".repeat(40)).length, 32);
});

test("rouvrir le lien avec un autre pseudo reprend la même session au lieu d'en créer une neuve", async (t) => {
  const base = await startServer(t);
  const { id, invite } = await preparedHost(base);
  const first = await call(base, "/api/games/" + id + "/join", { method: "POST", body: { invite, name: "Sam" } });
  assert.equal(first.status, 201);
  const cookie = first.headers.get("set-cookie");
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  const again = await call(base, "/api/games/" + id + "/join", { method: "POST", body: { invite, name: "Autre" }, headers: { cookie: cookie.split(";")[0] } });
  assert.equal(again.status, 200);
  assert.equal(again.data.token, first.data.token);
  assert.equal(again.data.guestId, first.data.guestId);
});

test("un double envoi de la même étape ne peut pas valider la suivante", async (t) => {
  const base = await startServer(t);
  const { id, invite } = await preparedHost(base);
  const guest = (await call(base, "/api/games/" + id + "/join", { method: "POST", body: { invite, name: "Sam" } })).data;
  const first = await call(base, "/api/games/" + id + "/answer", { method: "POST", token: guest.token, body: { type: "personal", choiceIndex: 0, step: 0 } });
  assert.equal(first.status, 200);
  assert.equal(first.data.progress, 1);
  const duplicate = await call(base, "/api/games/" + id + "/answer", { method: "POST", token: guest.token, body: { type: "situation", choiceIndex: 3, step: 0 } });
  assert.equal(duplicate.status, 409);
  const view = await call(base, "/api/games/" + id, { token: guest.token });
  assert.equal(view.data.progress, 1, "la 2e requête n'a rien modifié");
});

test("une réponse validée ne peut jamais être modifiée, même par requêtes simultanées", async (t) => {
  const base = await startServer(t);
  const { id, invite } = await preparedHost(base);
  const guest = (await call(base, "/api/games/" + id + "/join", { method: "POST", body: { invite, name: "Sam" } })).data;
  const results = await Promise.all([0, 1, 2, 3, 4].map((choiceIndex) =>
    call(base, "/api/games/" + id + "/answer", { method: "POST", token: guest.token, body: { type: "personal", choiceIndex, step: 0 } })));
  assert.equal(results.filter((item) => item.status === 200).length, 1, "une seule réponse est acceptée");
  assert.equal(results.filter((item) => item.status === 409).length, 4);
  const view = await call(base, "/api/games/" + id, { token: guest.token });
  assert.equal(view.data.progress, 1);
});

test("avant la fin de la partie, l'invité ne reçoit aucune réponse de référence de l'hôte", async (t) => {
  const base = await startServer(t);
  const { id, invite } = await preparedHost(base);
  const guest = (await call(base, "/api/games/" + id + "/join", { method: "POST", body: { invite, name: "Sam" } })).data;
  const view = await call(base, "/api/games/" + id, { token: guest.token });
  const text = JSON.stringify(view.data);
  assert.ok(!/answerIndex|idealIndex|alternativeIndex|hostChoice|hostAnswerIndex/.test(text));
  assert.equal(view.data.ownResult, null);
  assert.equal(view.data.results, null);
  // Il ne peut pas non plus lire la vue de l'hôte avec son propre jeton.
  const hostRoute = await call(base, "/api/games/" + id + "/setup", { method: "POST", token: guest.token, body: setupBody });
  assert.equal(hostRoute.status, 403);
  assert.equal((await call(base, "/api/games/" + id + "/invite", { token: guest.token })).status, 403);
});

test("la limitation de débit bloque les créations de parties en rafale", async (t) => {
  const base = await startServer(t);
  const statuses = [];
  for (let index = 0; index < 40; index += 1) {
    statuses.push((await call(base, "/api/games", { method: "POST", body: { name: "P" + index } })).status);
  }
  assert.ok(statuses.includes(429), "au moins une création est refusée");
  const blocked = await call(base, "/api/games", { method: "POST", body: { name: "Z" } });
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get("retry-after")) >= 1);
});

test("le limiteur se réarme à la fin de la fenêtre", () => {
  let current = 0;
  const limiter = createRateLimiter({ windowMs: 1000, max: 2, now: () => current });
  assert.equal(limiter.hit("a").allowed, true);
  assert.equal(limiter.hit("a").allowed, true);
  assert.equal(limiter.hit("a").allowed, false);
  assert.equal(limiter.hit("b").allowed, true);
  current = 1001;
  assert.equal(limiter.hit("a").allowed, true);
});

test("l'adresse du client ignore les entrées X-Forwarded-For forgées par le client", () => {
  const request = { headers: { "x-forwarded-for": "6.6.6.6, 203.0.113.9" }, socket: { remoteAddress: "10.0.0.1" } };
  assert.equal(clientIp(request, 1), "203.0.113.9");
  assert.equal(clientIp({ headers: {}, socket: { remoteAddress: "10.0.0.1" } }, 1), "10.0.0.1");
  assert.equal(clientIp(request, 0), "10.0.0.1");
});

test("l'adresse publique n'est jamais fabriquée à partir d'un en-tête Host arbitraire", () => {
  const origin = (headers) => safeOrigin({ headers }, { publicUrl: "", port: 4173 });
  assert.equal(origin({ host: "monsite.fr", "x-forwarded-proto": "https" }), "https://monsite.fr");
  assert.equal(origin({ host: "evil.com/<script>" }), "http://localhost:4173");
  assert.equal(origin({ host: "monsite.fr", "x-forwarded-proto": "javascript" }), "http://monsite.fr");
  assert.equal(safeOrigin({ headers: { host: "evil.com" } }, { publicUrl: "https://vrai.fr/x", port: 1 }), "https://vrai.fr");
});

test("la réponse n'est envoyée qu'après l'écriture durable dans la base distante", async (t) => {
  const writes = [];
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const fetchImpl = async (url, init) => {
    const commands = JSON.parse(init.body);
    if (url.endsWith("/pipeline")) {
      if (commands.some((command) => command[0] === "HSET")) {
        await gate;
        writes.push(...commands.filter((command) => command[0] === "HSET").map((command) => command[2]));
      }
      return new Response(JSON.stringify(commands.map(() => ({ result: 1 }))), { status: 200 });
    }
    return new Response(JSON.stringify({ result: 1 }), { status: 200 });
  };
  const store = createRemoteStore({ url: "https://db.test", token: "t", fetchImpl, log: { error() {}, log() {} }, persistWaitMs: 5000, env: {} });
  const base = await startServer(t, { store });
  let finished = false;
  const pending = call(base, "/api/games", { method: "POST", body: { name: "Alex" } }).then((result) => { finished = true; return result; });
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert.equal(finished, false, "le serveur attend la confirmation de la base avant de répondre");
  release();
  const created = await pending;
  assert.equal(created.status, 201);
  assert.deepEqual(writes, [created.data.id], "la partie était déjà enregistrée quand la réponse est partie");
});

test("si la base distante est en panne, la réponse est quand même envoyée après le délai et l'état reste verrouillé", async (t) => {
  const fetchImpl = async () => new Response(JSON.stringify({ error: "down" }), { status: 500 });
  const store = createRemoteStore({ url: "https://db.test", token: "t", fetchImpl, log: { error() {}, log() {} }, persistWaitMs: 100, retryDelayMs: 60_000, env: {} });
  const base = await startServer(t, { store });
  const created = await call(base, "/api/games", { method: "POST", body: { name: "Alex" } });
  assert.equal(created.status, 201);
});
