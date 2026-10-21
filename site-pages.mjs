import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { scenarios, severityLabel } from "./scenarios.mjs";
import { articles, articleBySlug, homeFaq } from "./site-content.mjs";

const projectDir = dirname(fileURLToPath(import.meta.url));
const SITE = "à deux";
const SITE_FULL = "Est-ce que je peux te faire confiance ?";
export const LAST_UPDATE = "2026-10-20";
const LAST_UPDATE_FR = "20 octobre 2026";
const MISSING_EMAIL = "[adresse e-mail à renseigner]";

export const esc = (value = "") => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const jsonLd = (data) => `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;
const paragraphs = (text) => String(text).split(/\n{2,}/).map((p) => `<p>${esc(p)}</p>`).join("");

export function siteContext(baseUrl, env = process.env) {
  return {
    baseUrl: String(baseUrl || "").replace(/\/+$/, ""),
    ownerName: (env.OWNER_NAME || "").trim() || "l'éditeur du site",
    contactEmail: (env.CONTACT_EMAIL || "").trim()
  };
}

// ---------- Fragments partagés ----------

export function footerLinks() {
  return `<nav class="footer-links" aria-label="Informations du site"><a href="/guide.html">Règles</a><a href="/dilemmes">Dilemmes</a><a href="/articles">Articles</a><a href="/a-propos">À propos</a><a href="/confidentialite">Confidentialité</a><a href="/mentions-legales">Mentions légales</a><a href="/contact">Contact</a><button type="button" class="link-button" data-privacy-choices hidden>Gérer mes choix publicitaires</button></nav>`;
}

// Emplacement publicitaire : invisible tant que la publicité n'est pas configurée (voir public/ads.js).
export const adWrap = (slot, scope = "content") => `<aside class="ad-wrap" data-ad-scope="${scope}" aria-label="Publicité"><p class="ad-label">Annonce</p><div class="ad-unit" data-ad-slot="${slot}"></div></aside>`;

export function homeFaqHtml() {
  return homeFaq.map((item) => `<details class="faq-item"><summary>${esc(item.q)}</summary><p>${esc(item.a)}</p></details>`).join("");
}

export function homeJsonLd(ctx) {
  return [
    jsonLd({ "@context": "https://schema.org", "@type": "WebApplication", name: SITE_FULL, url: ctx.baseUrl + "/", applicationCategory: "GameApplication", operatingSystem: "Web", inLanguage: "fr", offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" } }),
    jsonLd({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: homeFaq.map((item) => ({ "@type": "Question", name: item.q, acceptedAnswer: { "@type": "Answer", text: item.a } })) })
  ].join("\n    ");
}

// Remplace les jetons {{...}} des pages statiques (index.html, guide.html).
export function fillStaticHtml(html, ctx) {
  return html
    .replaceAll("{{SITE_URL}}", esc(ctx.baseUrl))
    .replaceAll("{{FOOTER_LINKS}}", footerLinks())
    .replaceAll("{{HOME_FAQ}}", homeFaqHtml())
    .replaceAll("{{HOME_JSONLD}}", homeJsonLd(ctx));
}

function layout(ctx, { path, title, description, body, ld = [], robots = "index,follow,max-image-preview:large", ogType = "website", script = "" }) {
  const url = ctx.baseUrl + path;
  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#f5f4ef" />
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}" />
    <meta name="robots" content="${robots}" />
    <link rel="canonical" href="${esc(url)}" />
    <meta property="og:site_name" content="${esc(SITE)}" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:type" content="${ogType}" />
    <meta property="og:url" content="${esc(url)}" />
    <meta property="og:locale" content="fr_FR" />
    <meta name="twitter:card" content="summary" />
    <link rel="icon" href="/icon.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="/styles.css?v=3" />
    <link rel="stylesheet" href="/ad.css?v=4" />
    <link rel="stylesheet" href="/content.css?v=1" />
    ${ld.map(jsonLd).join("\n    ")}
  </head>
  <body class="content-page">
    <div class="app-shell">
      <header class="topbar">
        <a class="brand" href="/" aria-label="Retour au jeu ${esc(SITE)}"><span class="brand-mark" aria-hidden="true"><i></i><i></i></span><span class="brand-name">${esc(SITE)}</span></a>
        <nav class="site-nav" aria-label="Navigation principale"><a href="/dilemmes">Dilemmes</a><a href="/articles">Articles</a><a class="guide-home-link" href="/">Jouer <span aria-hidden="true">↗</span></a></nav>
      </header>
      <main class="main-content content-main">
${body}
      </main>
      <footer class="site-footer content-footer">
        <span>Un jeu de choix, pas un test de personnalité.</span>
        ${footerLinks()}
      </footer>
    </div>
    <script src="/ad-config.js?v=4"></script>
    <script src="/ads.js?v=4" defer></script>${script}
  </body>
</html>
`;
}

const breadcrumb = (ctx, trail) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: trail.map((item, i) => ({ "@type": "ListItem", position: i + 1, name: item.name, item: ctx.baseUrl + item.path }))
});
const crumbsHtml = (trail) => `<nav class="breadcrumb" aria-label="Fil d'Ariane">${trail.map((item, i) => (i === trail.length - 1 ? `<span aria-current="page">${esc(item.name)}</span>` : `<a href="${item.path}">${esc(item.name)}</a>`)).join(" › ")}</nav>`;

const firstSentence = (text, max = 150) => {
  const first = String(text).split(/\n{2,}/)[0].replace(/\s+/g, " ").trim();
  return first.length <= max ? first : first.slice(0, max - 1).replace(/\s+\S*$/, "") + "…";
};

const playCta = (text = "Lance une partie avec tes amis : chacun répond de son côté, l'organisateur découvre le classement.") =>
  `<aside class="cta-card"><div><strong>Envie d'y jouer vraiment ?</strong><p>${esc(text)}</p></div><a class="primary-button" href="/">Créer une partie <span aria-hidden="true">↗</span></a></aside>`;

// ---------- Dilemmes ----------

const dilemmaNumber = (index) => String(index + 1).padStart(3, "0");

function relatedDilemmas(current) {
  const sameLevel = scenarios.filter((item) => item.severity === current.severity);
  const at = sameLevel.findIndex((item) => item.id === current.id);
  const picks = [];
  for (let step = 1; picks.length < 3 && step < sameLevel.length; step += 1) picks.push(sameLevel[(at + step) % sameLevel.length]);
  return picks;
}

function dilemmaPage(ctx, current, index) {
  const path = "/dilemmes/" + current.id;
  const number = dilemmaNumber(index);
  const level = severityLabel(current.severity);
  const previous = scenarios[index - 1];
  const next = scenarios[index + 1];
  const trail = [{ name: "Jeu", path: "/" }, { name: "Dilemmes", path: "/dilemmes" }, { name: current.title, path }];
  const outcomes = [
    ["share-share", "Vous partagez tous les deux", current.outcomes.bothShare],
    ["steal-share", "Tu prends tout, l'autre partage", current.outcomes.youSteal],
    ["share-steal", "Tu partages, l'autre prend tout", current.outcomes.otherSteals],
    ["steal-steal", "Vous prenez tous les deux", current.outcomes.bothSteal]
  ];
  const body = `
        ${crumbsHtml(trail)}
        <article class="prose dilemma-page">
          <p class="eyebrow">Dilemme n°${number} · Intensité ${current.severity}/5 (${esc(level)})</p>
          <h1 class="display-title">${esc(current.title)}</h1>
          <p class="dilemma-intro">Un dilemme à deux joueurs : partager ou tout prendre ? Lis la situation, puis choisis avant de découvrir ce qui peut arriver.</p>
          <h2>La situation</h2>
          ${paragraphs(current.problem)}
          ${adWrap("dilemma-top")}
          <h2>Ce qui est en jeu</h2>
          ${paragraphs(current.resource)}
          <h2>Le doute</h2>
          ${paragraphs(current.doubt)}
          <section class="dilemma-choice" aria-labelledby="choice-title">
            <h2 id="choice-title">Que ferais-tu ?</h2>
            <p>Ton choix n'est pas enregistré. Il sert seulement à mettre en avant les deux issues qui te concernent.</p>
            <div class="choice-buttons" data-choice-root hidden>
              <button type="button" class="primary-button" data-pick="share">PARTAGER</button>
              <button type="button" class="secondary-button" data-pick="steal">VOLER</button>
            </div>
          </section>
          <h2>Les quatre issues possibles</h2>
          <div class="outcomes">
            ${outcomes.map(([key, label, text]) => `<section class="outcome" data-outcome="${key}"><h3>${esc(label)}</h3><p>${esc(text)}</p></section>`).join("\n            ")}
          </div>
          ${adWrap("dilemma-bottom")}
          <p class="dilemma-note">Ce dilemme fait partie d'un jeu : il décrit un choix fictif dans une situation volontairement tendue. Le résultat ne dit rien de ta fiabilité réelle.</p>
        </article>
        ${playCta("Retrouve ce dilemme dans une vraie partie : les dés choisissent la situation, tes amis répondent de leur côté.")}
        <section class="related" aria-labelledby="related-title">
          <h2 id="related-title">D'autres dilemmes du même niveau</h2>
          <ul class="link-list">${relatedDilemmas(current).map((item) => `<li><a href="/dilemmes/${item.id}">${esc(item.title)}</a><span>${esc(firstSentence(item.problem, 110))}</span></li>`).join("")}</ul>
          <p class="pager">${previous ? `<a href="/dilemmes/${previous.id}">← ${esc(previous.title)}</a>` : "<span></span>"}${next ? `<a href="/dilemmes/${next.id}">${esc(next.title)} →</a>` : ""}</p>
        </section>`;
  return layout(ctx, {
    path,
    title: `${current.title} · dilemme n°${number} | ${SITE}`,
    description: firstSentence(current.problem, 155),
    body,
    ld: [breadcrumb(ctx, trail)],
    ogType: "article",
    script: `\n    <script src="/dilemme.js?v=1" defer></script>`
  });
}

function dilemmaHub(ctx) {
  const trail = [{ name: "Jeu", path: "/" }, { name: "Dilemmes", path: "/dilemmes" }];
  const levels = [1, 2, 3, 4, 5].map((severity) => ({ severity, items: scenarios.map((item, index) => ({ item, index })).filter(({ item }) => item.severity === severity) })).filter((level) => level.items.length);
  const list = (level) => `<section class="level-block" id="niveau-${level.severity}"><h2>Niveau ${level.severity} · ${esc(severityLabel(level.severity))} <small>${level.items.length} dilemmes</small></h2><ul class="link-list">${level.items.map(({ item, index }) => `<li><a href="/dilemmes/${item.id}">${dilemmaNumber(index)} · ${esc(item.title)}</a><span>${esc(firstSentence(item.problem, 120))}</span></li>`).join("")}</ul></section>`;
  const middle = Math.ceil(levels.length / 2);
  const body = `
        ${crumbsHtml(trail)}
        <article class="prose">
          <p class="eyebrow">La bibliothèque</p>
          <h1 class="display-title">${scenarios.length} dilemmes à deux : partager ou tout prendre ?</h1>
          <p class="lead">Chaque dilemme met deux personnes face à une ressource qu'elles ne peuvent pas se partager sans renoncer à quelque chose. Tu lis la situation, tu choisis de partager ou de tout prendre, puis tu découvres les quatre issues possibles selon la décision de l'autre.</p>
          <p>Les situations sont classées en cinq niveaux d'intensité, de « sensible » à « critique ». Pour une soirée, commence par les premiers niveaux et monte progressivement : notre <a href="/articles/animer-une-soiree-dilemmes">guide pour animer une soirée dilemmes</a> explique comment. Pour comprendre la logique derrière ces choix, lis aussi <a href="/articles/dilemme-du-prisonnier-explique">notre article sur le dilemme du prisonnier</a>.</p>
          <p class="level-nav">${levels.map((level) => `<a href="#niveau-${level.severity}">Niveau ${level.severity}</a>`).join("")}</p>
        </article>
        ${adWrap("hub-top")}
        ${levels.slice(0, middle).map(list).join("")}
        ${adWrap("hub-middle")}
        ${levels.slice(middle).map(list).join("")}
        ${playCta()}`;
  return layout(ctx, {
    path: "/dilemmes",
    title: `${scenarios.length} dilemmes à deux : partager ou tout prendre ? | ${SITE}`,
    description: `${scenarios.length} dilemmes à deux joueurs classés en cinq niveaux d'intensité. Lis la situation, choisis de partager ou de tout prendre et découvre les quatre issues possibles.`,
    body,
    ld: [breadcrumb(ctx, trail), { "@context": "https://schema.org", "@type": "ItemList", name: "Dilemmes à deux", numberOfItems: scenarios.length, itemListElement: scenarios.map((item, i) => ({ "@type": "ListItem", position: i + 1, url: ctx.baseUrl + "/dilemmes/" + item.id, name: item.title })) }]
  });
}

// ---------- Articles ----------

function articlePage(ctx, article) {
  const path = "/articles/" + article.slug;
  const trail = [{ name: "Jeu", path: "/" }, { name: "Articles", path: "/articles" }, { name: article.title, path }];
  const sections = article.sections.map((html, i) => {
    const adAfter = i === 0 ? adWrap("article-top") : i === Math.floor(article.sections.length / 2) ? adWrap("article-middle") : "";
    return html + adAfter;
  });
  const others = articles.filter((item) => item.slug !== article.slug);
  const body = `
        ${crumbsHtml(trail)}
        <article class="prose article">
          <p class="eyebrow">Article · ${article.readMinutes} min de lecture</p>
          <h1 class="display-title">${esc(article.title)}</h1>
          ${sections.join("\n")}
        </article>
        ${adWrap("article-bottom")}
        ${playCta()}
        <section class="related" aria-labelledby="more-title">
          <h2 id="more-title">À lire aussi</h2>
          <ul class="link-list">${others.map((item) => `<li><a href="/articles/${item.slug}">${esc(item.title)}</a><span>${esc(item.description)}</span></li>`).join("")}<li><a href="/dilemmes">Les ${scenarios.length} dilemmes à deux</a><span>Lis les situations et choisis de partager ou de tout prendre.</span></li></ul>
        </section>`;
  return layout(ctx, {
    path,
    title: `${article.title} | ${SITE}`,
    description: article.description,
    body,
    ogType: "article",
    ld: [
      breadcrumb(ctx, trail),
      { "@context": "https://schema.org", "@type": "Article", headline: article.title, description: article.description, inLanguage: "fr", datePublished: LAST_UPDATE, dateModified: LAST_UPDATE, mainEntityOfPage: ctx.baseUrl + path, author: { "@type": "Organization", name: SITE }, publisher: { "@type": "Organization", name: SITE } }
    ]
  });
}

function articlesHub(ctx) {
  const trail = [{ name: "Jeu", path: "/" }, { name: "Articles", path: "/articles" }];
  const body = `
        ${crumbsHtml(trail)}
        <article class="prose">
          <p class="eyebrow">Articles</p>
          <h1 class="display-title">Jeux, confiance et théorie des jeux</h1>
          <p class="lead">Des articles pour mieux comprendre ce qui se joue quand on doit choisir entre partager et tout garder, et pour organiser de bonnes soirées entre amis.</p>
          <ul class="link-list article-list">${articles.map((item) => `<li><a href="/articles/${item.slug}">${esc(item.title)}</a><span>${esc(item.description)}</span><small>${item.readMinutes} min de lecture</small></li>`).join("")}</ul>
        </article>
        ${playCta()}`;
  return layout(ctx, {
    path: "/articles",
    title: `Articles : jeux de confiance et dilemmes | ${SITE}`,
    description: "Articles sur les jeux de confiance, le dilemme du prisonnier et l'animation de soirées dilemmes entre amis.",
    body,
    ld: [breadcrumb(ctx, trail)]
  });
}

// ---------- Pages légales et informatives (sans publicité) ----------

const contactLine = (ctx) => (ctx.contactEmail ? `<a href="mailto:${esc(ctx.contactEmail)}">${esc(ctx.contactEmail)}</a>` : esc(MISSING_EMAIL));

function infoPage(ctx, { path, title, description, heading, eyebrow, html }) {
  const trail = [{ name: "Jeu", path: "/" }, { name: heading, path }];
  const body = `
        ${crumbsHtml(trail)}
        <article class="prose">
          <p class="eyebrow">${esc(eyebrow)}</p>
          <h1 class="display-title">${esc(heading)}</h1>
${html}
        </article>`;
  return layout(ctx, { path, title: `${title} | ${SITE}`, description, body, ld: [breadcrumb(ctx, trail)] });
}

function aboutPage(ctx) {
  return infoPage(ctx, {
    path: "/a-propos",
    title: "À propos",
    heading: "À propos",
    eyebrow: "Le projet",
    description: `Qui est derrière « ${SITE_FULL} », comment le jeu fonctionne et comment le site est financé.`,
    html: `<p class="lead">« ${esc(SITE_FULL)} » est un jeu en français pour téléphone et ordinateur : un organisateur prépare une partie, partage un lien, et chaque ami répond séparément à des dilemmes, des questions personnelles et des mises en situation.</p>
<h2>Une démarche de jeu, pas de diagnostic</h2>
<p>Le score d'une partie compare des choix dans un jeu. Il ne mesure ni la personnalité ni la fiabilité de quelqu'un. Les textes des dilemmes sont des créations originales écrites pour ce projet, avec un niveau d'intensité indiqué pour chaque situation.</p>
<h2>Comment le site est financé</h2>
<p>Le jeu est gratuit. Pour couvrir les frais d'hébergement, le site peut afficher des annonces Google AdSense sur ses pages d'information (dilemmes, articles, règles) et sur l'écran de résultats. Aucune annonce n'apparaît pendant les choix, ni à côté des boutons de réponse. Pour en savoir plus sur les données concernées, consulte la <a href="/confidentialite">politique de confidentialité</a>.</p>
<h2>Nous contacter</h2>
<p>Pour une question, une suggestion ou une demande concernant tes données, rends-toi sur la page <a href="/contact">Contact</a>.</p>`
  });
}

function contactPage(ctx) {
  return infoPage(ctx, {
    path: "/contact",
    title: "Contact",
    heading: "Contact",
    eyebrow: "Nous écrire",
    description: `Contacter l'éditeur de « ${SITE_FULL} » pour une question, un signalement ou une demande liée à vos données.`,
    html: `<p class="lead">Une question, une suggestion, un problème avec une partie ? Écris-nous.</p>
<p>Adresse de contact : ${contactLine(ctx)}</p>
<h2>Pour quels sujets ?</h2>
<ul>
<li>Un problème technique rencontré pendant une partie.</li>
<li>Une suggestion de dilemme ou d'amélioration.</li>
<li>Une demande d'accès, de correction ou de suppression de données (voir la <a href="/confidentialite">politique de confidentialité</a>).</li>
<li>Le signalement d'un contenu qui te paraît inapproprié.</li>
</ul>
<p>Nous répondons en général sous quelques jours. Pour t'aider à retrouver une partie, indique son lien ou son identifiant, sans nous transmettre d'informations inutiles.</p>`
  });
}

function legalPage(ctx) {
  return infoPage(ctx, {
    path: "/mentions-legales",
    title: "Mentions légales",
    heading: "Mentions légales",
    eyebrow: "Informations légales",
    description: `Éditeur, hébergeur et conditions d'utilisation du site « ${SITE_FULL} ».`,
    html: `<h2>Éditeur du site</h2>
<p>Le site « ${esc(SITE_FULL)} » est édité à titre non professionnel par ${esc(ctx.ownerName)}. Contact : ${contactLine(ctx)}. Le responsable de la publication est l'éditeur.</p>
<h2>Hébergement</h2>
<p>Le site est hébergé par Render (<a href="https://render.com" rel="noopener noreferrer">render.com</a>). Les parties peuvent également être enregistrées dans une base Upstash (<a href="https://upstash.com" rel="noopener noreferrer">upstash.com</a>) lorsque ce stockage est activé.</p>
<h2>Propriété intellectuelle</h2>
<p>Les textes, le code et les éléments graphiques du site sont protégés. Toute reproduction substantielle sans autorisation est interdite. Les courtes citations avec un lien vers la page d'origine sont bienvenues.</p>
<h2>Nature du service</h2>
<p>Le jeu est un divertissement. Les scores et les verdicts décrivent des choix faits dans une partie précise : ils ne constituent ni un test psychologique, ni une évaluation de la personnalité, ni un conseil. Les situations des dilemmes sont fictives.</p>
<h2>Responsabilité</h2>
<p>Nous nous efforçons de maintenir le site accessible et exact, sans garantie de disponibilité continue. Le site peut contenir des liens vers des sites tiers dont nous ne contrôlons pas le contenu.</p>
<h2>Publicité</h2>
<p>Le site peut afficher des annonces diffusées par Google AdSense. Les informations relatives aux cookies et aux identifiants publicitaires figurent dans la <a href="/confidentialite">politique de confidentialité</a>.</p>
<p><small>Dernière mise à jour : ${LAST_UPDATE_FR}.</small></p>`
  });
}

function privacyPage(ctx) {
  return infoPage(ctx, {
    path: "/confidentialite",
    title: "Politique de confidentialité",
    heading: "Politique de confidentialité",
    eyebrow: "Vos données",
    description: `Données traitées par « ${SITE_FULL} », cookies publicitaires Google AdSense, durées de conservation et droits des utilisateurs.`,
    html: `<p class="lead">Cette page explique quelles informations le site utilise, pourquoi, et comment les contrôler. Elle s'applique au jeu et à toutes les pages du site.</p>
<h2>Responsable du traitement</h2>
<p>Le responsable est ${esc(ctx.ownerName)}, joignable à l'adresse ${contactLine(ctx)}.</p>
<h2>Les données du jeu</h2>
<p>Pour faire fonctionner une partie, le serveur enregistre le pseudo saisi par chaque joueur, ses choix, ses réponses et ses scores, ainsi que des identifiants techniques de partie et de session. Aucune adresse e-mail, aucun numéro de téléphone et aucun compte ne sont demandés. Ces données servent uniquement à faire fonctionner le jeu : afficher le bilan à l'invité et le classement à l'organisateur.</p>
<p>Nous te recommandons de ne pas saisir ton nom complet ou d'autres informations sensibles dans les champs de pseudo.</p>
<h2>Stockage dans ton navigateur</h2>
<p>Le jeu utilise le stockage local de ton navigateur (<em>localStorage</em>) pour mémoriser ton pseudo et ton identifiant de session, afin de reprendre ta partie si tu fermes la page. Tu peux effacer ces informations à tout moment dans les réglages de ton navigateur.</p>
<h2>Journaux techniques</h2>
<p>Comme tout site web, l'hébergeur enregistre des informations techniques (adresse IP, date, page demandée) pour assurer la sécurité et le bon fonctionnement du service.</p>
<h2>Publicité et Google AdSense</h2>
<p>Le site peut afficher des annonces diffusées par Google AdSense. Dans ce cas, Google et ses partenaires peuvent utiliser des cookies ou des identifiants similaires, afin de diffuser et de mesurer des annonces, et de les personnaliser à partir de tes visites précédentes sur ce site ou sur d'autres sites, si tu y consens.</p>
<p>Dans l'Espace économique européen, au Royaume-Uni et en Suisse, un message de consentement te permet d'accepter ou de refuser les annonces personnalisées. Tu peux modifier ton choix à tout moment avec le lien « Gérer mes choix publicitaires » en bas de page, lorsqu'il est affiché.</p>
<p>Pour en savoir plus : <a href="https://policies.google.com/technologies/ads" rel="noopener noreferrer">comment Google utilise les données pour les annonces</a>. Tu peux aussi gérer les annonces personnalisées sur <a href="https://myadcenter.google.com" rel="noopener noreferrer">Mon Centre d'annonces</a>, ou consulter <a href="https://www.youronlinechoices.com" rel="noopener noreferrer">youronlinechoices.com</a>.</p>
<p>Aucune annonce n'est affichée pendant les choix du jeu ni sur les pages légales.</p>
<h2>Durée de conservation</h2>
<p>Les parties sont conservées sur le serveur tant que le service est actif, puis supprimées sur simple demande. Les données de navigation publicitaire sont gérées par Google selon ses propres règles.</p>
<h2>Transferts hors de l'Union européenne</h2>
<p>L'hébergeur et Google peuvent traiter des données en dehors de l'Union européenne, notamment aux États-Unis, avec les garanties prévues par leurs politiques respectives.</p>
<h2>Tes droits</h2>
<p>Tu peux demander l'accès à tes données, leur correction, leur suppression, ou t'opposer à leur traitement, en écrivant à ${contactLine(ctx)}. Si tu estimes que tes droits ne sont pas respectés, tu peux aussi saisir l'autorité de protection des données de ton pays.</p>
<h2>Mineurs</h2>
<p>Le site ne s'adresse pas aux enfants de moins de 13 ans. Les plus jeunes doivent jouer sous la supervision d'un adulte, et nous ne collectons sciemment aucune information personnelle auprès d'eux.</p>
<h2>Modifications</h2>
<p>Cette politique peut évoluer, par exemple lors de l'ajout d'un service. La date de dernière mise à jour figure ci-dessous.</p>
<p><small>Dernière mise à jour : ${LAST_UPDATE_FR}.</small></p>`
  });
}

function notFoundPage(ctx) {
  return layout(ctx, {
    path: "/404",
    title: `Page introuvable | ${SITE}`,
    description: "Cette page n'existe pas.",
    robots: "noindex,follow",
    body: `
        <article class="prose">
          <p class="eyebrow">Erreur 404</p>
          <h1 class="display-title">Cette page est introuvable.</h1>
          <p class="lead">Le lien est peut-être incorrect ou la page a été déplacée.</p>
          <p><a class="primary-button" href="/">Retour au jeu <span aria-hidden="true">↗</span></a> <a class="secondary-button" href="/dilemmes">Voir les dilemmes</a></p>
        </article>`
  });
}

// ---------- Fichiers techniques ----------

export function readPublisherId() {
  const file = join(projectDir, "public", "ad-config.js");
  if (!existsSync(file)) return "";
  const match = /clientId:\s*"(ca-pub-[0-9]+)"/.exec(readFileSync(file, "utf8"));
  return match ? match[1].replace(/^ca-/, "") : "";
}

function adsTxt() {
  const publisher = readPublisherId();
  if (!publisher) return "# ads.txt : aucun identifiant éditeur configuré pour le moment (public/ad-config.js).\n";
  return `google.com, ${publisher}, DIRECT, f08c47fec0942fa0\n`;
}

function robotsTxt(ctx) {
  return `User-agent: *\nAllow: /\nDisallow: /api/\n\nUser-agent: Mediapartners-Google\nAllow: /\n\nSitemap: ${ctx.baseUrl}/sitemap.xml\n`;
}

export function sitePaths() {
  return [
    "/", "/guide.html", "/dilemmes", ...scenarios.map((item) => "/dilemmes/" + item.id),
    "/articles", ...articles.map((item) => "/articles/" + item.slug),
    "/a-propos", "/confidentialite", "/mentions-legales", "/contact"
  ];
}

function sitemapXml(ctx) {
  const rows = sitePaths().map((path) => `  <url><loc>${esc(ctx.baseUrl + path)}</loc><lastmod>${LAST_UPDATE}</lastmod></url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows}\n</urlset>\n`;
}

// ---------- Routage ----------

const HTML = "text/html; charset=utf-8";
const page = (status, body, cache = "public, max-age=600") => ({ status, type: HTML, body, cache });

// Retourne { status, type, body, cache } ou null si l'adresse n'est pas une page du site.
export function renderSitePage(pathname, ctx) {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (path === "/robots.txt") return { status: 200, type: "text/plain; charset=utf-8", body: robotsTxt(ctx), cache: "public, max-age=3600" };
  if (path === "/ads.txt") return { status: 200, type: "text/plain; charset=utf-8", body: adsTxt(), cache: "public, max-age=3600" };
  if (path === "/sitemap.xml") return { status: 200, type: "application/xml; charset=utf-8", body: sitemapXml(ctx), cache: "public, max-age=3600" };
  if (path === "/dilemmes") return page(200, dilemmaHub(ctx));
  if (path.startsWith("/dilemmes/")) {
    let id;
    try { id = decodeURIComponent(path.slice("/dilemmes/".length)); } catch { return page(404, notFoundPage(ctx), "no-store"); }
    const index = scenarios.findIndex((item) => item.id === id);
    return index === -1 ? page(404, notFoundPage(ctx), "no-store") : page(200, dilemmaPage(ctx, scenarios[index], index));
  }
  if (path === "/articles") return page(200, articlesHub(ctx));
  if (path.startsWith("/articles/")) {
    const article = articleBySlug.get(path.slice("/articles/".length));
    return article ? page(200, articlePage(ctx, article)) : page(404, notFoundPage(ctx), "no-store");
  }
  if (path === "/a-propos") return page(200, aboutPage(ctx));
  if (path === "/contact") return page(200, contactPage(ctx));
  if (path === "/mentions-legales") return page(200, legalPage(ctx));
  if (path === "/confidentialite") return page(200, privacyPage(ctx));
  return null;
}

export const renderNotFound = (ctx) => page(404, notFoundPage(ctx), "no-store");
