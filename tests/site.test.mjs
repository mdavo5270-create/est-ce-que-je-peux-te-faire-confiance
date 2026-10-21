import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createGameServer } from "../server.mjs";
import { scenarios } from "../scenarios.mjs";
import { articles } from "../site-content.mjs";
import { sitePaths } from "../site-pages.mjs";

async function startServer(t) {
  const server = createGameServer({ dataFile: null });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return "http://127.0.0.1:" + server.address().port;
}
const get = async (base, path) => {
  const response = await fetch(base + path);
  return { status: response.status, type: response.headers.get("content-type") || "", body: await response.text() };
};
const adSlots = (html) => (html.match(/class="ad-unit"/g) || []).length;

test("la configuration publicitaire livrée est inerte", () => {
  const config = readFileSync(new URL("../public/ad-config.js", import.meta.url), "utf8");
  assert.match(config, /clientId:\s*"ca-pub-1658775159189335"/);
  assert.match(config, /slotId:\s*""/);
  assert.match(config, /consentConfigured:\s*false/);
});

test("robots.txt, ads.txt et sitemap.xml sont servis avec le bon type", async (t) => {
  const base = await startServer(t);
  const robots = await get(base, "/robots.txt");
  assert.equal(robots.status, 200);
  assert.match(robots.type, /^text\/plain/);
  assert.match(robots.body, /Disallow: \/api\//);
  assert.match(robots.body, new RegExp("Sitemap: " + base.replace(/\./g, "\\.") + "/sitemap.xml"));
  const ads = await get(base, "/ads.txt");
  assert.equal(ads.status, 200);
  assert.match(ads.type, /^text\/plain/);
  const sitemap = await get(base, "/sitemap.xml");
  assert.equal(sitemap.status, 200);
  assert.match(sitemap.type, /^application\/xml/);
  const locations = [...sitemap.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  assert.equal(locations.length, sitePaths().length);
  assert.ok(locations.includes(base + "/dilemmes/" + scenarios[0].id));
  assert.ok(!sitemap.body.includes("/api/"));
});

test("chaque dilemme a sa page indexable, avec deux annonces maximum", async (t) => {
  const base = await startServer(t);
  for (const item of scenarios) {
    const page = await get(base, "/dilemmes/" + item.id);
    assert.equal(page.status, 200, item.id);
    assert.match(page.body, /<h1 class="display-title">/);
    assert.ok(page.body.includes('rel="canonical" href="' + base + "/dilemmes/" + item.id + '"'), item.id);
    assert.equal((page.body.match(/class="outcome"/g) || []).length, 4, item.id);
    assert.equal(adSlots(page.body), 2, item.id);
  }
});

test("le hub, les articles et le guide portent des annonces, jamais les pages légales ni les erreurs", async (t) => {
  const base = await startServer(t);
  assert.equal(adSlots((await get(base, "/dilemmes")).body), 2);
  assert.equal(adSlots((await get(base, "/guide.html")).body), 2);
  for (const article of articles) {
    const page = await get(base, "/articles/" + article.slug);
    assert.equal(page.status, 200);
    assert.equal(adSlots(page.body), 3, article.slug);
    assert.ok(page.body.split(/\s+/).length > 600, "article assez long : " + article.slug);
  }
  for (const path of ["/articles", "/a-propos", "/contact", "/mentions-legales", "/confidentialite", "/dilemmes/inconnu", "/introuvable"]) {
    const page = await get(base, path);
    assert.equal(adSlots(page.body), 0, path);
  }
});

test("les erreurs 404 sont des pages HTML non indexées", async (t) => {
  const base = await startServer(t);
  for (const path of ["/introuvable", "/dilemmes/inconnu", "/articles/inconnu"]) {
    const page = await get(base, path);
    assert.equal(page.status, 404, path);
    assert.match(page.type, /^text\/html/);
    assert.match(page.body, /noindex/);
  }
  const api = await fetch(base + "/api/inconnu");
  assert.equal(api.status, 404);
  assert.match(api.headers.get("content-type"), /json/);
});

test("l'accueil n'a aucun jeton résiduel et aucune annonce display dans l'interface de jeu", async (t) => {
  const base = await startServer(t);
  const home = await get(base, "/");
  assert.equal(home.status, 200);
  assert.ok(!home.body.includes("{{"));
  assert.match(home.body, /<main id="app" class="main-content" aria-live="polite"><\/main>/);
  assert.match(home.body, /FAQPage/);
  assert.match(home.body, /rel="canonical"/);
  assert.ok(!home.body.includes('data-ad-scope="game"'));
  const css = readFileSync(new URL("../public/ad.css", import.meta.url), "utf8");
  assert.ok(!/position:\s*(fixed|sticky)/.test(css));
  const guide = await get(base, "/guide.html");
  assert.ok(!guide.body.includes("{{"));
});

test("les pages légales utilisent l'éditeur et le contact configurés", async (t) => {
  const previous = { owner: process.env.OWNER_NAME, email: process.env.CONTACT_EMAIL };
  process.env.OWNER_NAME = "Jeanne <Test>";
  process.env.CONTACT_EMAIL = "bonjour@exemple.fr";
  t.after(() => {
    for (const [key, value] of [["OWNER_NAME", previous.owner], ["CONTACT_EMAIL", previous.email]]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
  const base = await startServer(t);
  const contact = await get(base, "/contact");
  assert.match(contact.body, /mailto:bonjour@exemple\.fr/);
  const legal = await get(base, "/mentions-legales");
  assert.match(legal.body, /Jeanne &lt;Test&gt;/);
  assert.ok(!legal.body.includes("Jeanne <Test>"));
  const privacy = await get(base, "/confidentialite");
  assert.match(privacy.body, /Google AdSense/);
  assert.match(privacy.body, /bonjour@exemple\.fr/);
});
