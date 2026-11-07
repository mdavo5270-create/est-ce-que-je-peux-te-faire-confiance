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
  assert.match(config, /consentConfigured:\s*true/);
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

test("la page-cadre des bannières partenaires est isolée et strictement validée", async (t) => {
  const base = await startServer(t);
  const response = await fetch(base + "/partner-frame?size=728x90");
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /^text\/html/);
  assert.equal(response.headers.get("x-frame-options"), "SAMEORIGIN");
  const csp = response.headers.get("content-security-policy");
  assert.match(csp, /frame-ancestors 'self'/);
  assert.match(csp, /default-src 'none'/);
  assert.ok(!/'unsafe-inline'/.test(csp.match(/script-src[^;]*/)[0]), "aucun script en ligne sans nonce");
  const nonce = csp.match(/'nonce-([^']+)'/)[1];
  assert.ok(html.includes('<script nonce="' + nonce + '">'));
  assert.match(html, /atOptions = \{"key":"332ae698604f3bced85e4b478b415e2d","format":"iframe","height":90,"width":728/);
  assert.ok(html.includes('src="https://bauval.org/22/332ae698604f3bced85e4b478b415e2d"'));
  assert.ok(!html.includes("googlesyndication"), "pas de vérificateur AdSense dans la page-cadre");
  const second = await fetch(base + "/partner-frame?size=728x90");
  assert.notEqual(second.headers.get("content-security-policy"), csp, "un nonce neuf à chaque réponse");
  for (const size of ["", "1x1", "728x90 ", "__proto__", "constructor", "300x250;x", "<script>"]) {
    const bad = await fetch(base + "/partner-frame?size=" + encodeURIComponent(size));
    assert.equal(bad.status, 404, JSON.stringify(size));
  }
  assert.equal((await fetch(base + "/partner-frame")).status, 404);
});

test("les six tailles de bannière existent et les pages du jeu peuvent afficher la page-cadre", async (t) => {
  const base = await startServer(t);
  for (const size of ["300x250", "320x50", "468x60", "160x300", "160x600", "728x90", "native"]) {
    assert.equal((await fetch(base + "/partner-frame?size=" + size)).status, 200, size);
  }
  const home = await fetch(base + "/");
  assert.match(home.headers.get("content-security-policy"), /frame-src 'self' /);
  assert.match(home.headers.get("content-security-policy"), /frame-ancestors 'none'/);
});

test("l'interrupteur PARTNER_BANNERS=off coupe les bannières partenaires", async (t) => {
  const previous = process.env.PARTNER_BANNERS;
  process.env.PARTNER_BANNERS = "off";
  t.after(() => { if (previous === undefined) delete process.env.PARTNER_BANNERS; else process.env.PARTNER_BANNERS = previous; });
  const base = await startServer(t);
  assert.equal((await fetch(base + "/partner-frame?size=300x250")).status, 404);
});

test("les emplacements partenaires n'existent que sur les pages de dilemmes et d'articles", async (t) => {
  const base = await startServer(t);
  const roles = (html) => [...html.matchAll(/data-partner-slot="([^"]+)"/g)].map((m) => m[1]).sort().join(",");
  assert.equal(roles((await get(base, "/dilemmes/" + scenarios[0].id)).body), "rail-left,rail-right,rectangle");
  assert.equal(roles((await get(base, "/articles/" + articles[0].slug)).body), "native,rail-left,rail-right,rectangle");
  assert.equal(roles((await get(base, "/dilemmes")).body), "banner,native,rail-left,rail-right");
  for (const path of ["/", "/guide.html", "/articles", "/a-propos", "/confidentialite", "/contact", "/mentions-legales", "/introuvable"]) {
    assert.equal(roles((await get(base, path)).body), "", path);
  }
  const robots = await get(base, "/robots.txt");
  assert.match(robots.body, /Disallow: \/partner-frame/);
  const config = readFileSync(new URL("../public/ad-config.js", import.meta.url), "utf8");
  assert.match(config, /partnerBanners:\s*\{\s*enabled:\s*(true|false)\s*\}/);
  assert.match(config, /consentConfigured:\s*true/);
});

test("la bannière native et le rapport de remplissage sont servis dans la page-cadre", async (t) => {
  const base = await startServer(t);
  const response = await fetch(base + "/partner-frame?size=native");
  const html = await response.text();
  const nonce = response.headers.get("content-security-policy").match(/'nonce-([^']+)'/)[1];
  assert.equal(response.status, 200);
  assert.ok(html.includes('src="https://bauval.org/21/aec1867e4062f0b829d39caff819793f"'));
  assert.ok(html.includes('<div id="container-aec1867e4062f0b829d39caff819793f"></div>'));
  assert.ok(html.includes('<script nonce="' + nonce + '">(function(){'), "rapport de remplissage protégé par le nonce");
  const fixed = await (await fetch(base + "/partner-frame?size=300x250")).text();
  assert.ok(fixed.includes("partnerFrame:true"), "les formats fixes envoient aussi un rapport");
  assert.ok(!html.includes("abscloud.org") && !html.includes("/14/") && !html.includes("araplhn.org"), "aucun pop-under, social bar ni lien direct");
});
