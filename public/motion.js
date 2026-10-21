/*
 * motion.js — couche d'animations du jeu.
 *
 * Principe : app.js remplace tout le contenu de #app avec `app.innerHTML = ...`
 * à chaque changement d'état. Ce fichier intercepte cette affectation, compare
 * l'écran d'avant et celui d'après, puis choisit l'animation adaptée :
 *   - nouvel écran  -> fondu croisé avec l'ancien écran + entrée orchestrée ;
 *   - même écran    -> uniquement les micro-animations utiles (sélection, nouvelle
 *                      ligne du classement, indice du Serpent, etc.), sans rejouer
 *                      les animations d'entrée.
 * Aucune logique de jeu n'est touchée. Toute erreur ici est avalée : le jeu
 * continue de fonctionner sans animation.
 * `prefers-reduced-motion` est respecté (rien n'est animé en JS, le CSS réduit le reste).
 */
(() => {
  "use strict";

  const app = document.querySelector("#app");
  const nativeHtml = Object.getOwnPropertyDescriptor(Element.prototype, "innerHTML");
  if (!app || !nativeHtml || !nativeHtml.set || app.dataset.motion) return;
  app.dataset.motion = "on";

  const root = document.documentElement;
  const reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const reduced = () => reduceQuery.matches;
  // Les compteurs reposent sur @property (entier animable) : sinon on affiche le chiffre final.
  const COUNTERS = !!(window.CSS && typeof CSS.registerProperty === "function");

  const EASE_OUT = "cubic-bezier(.2,.8,.2,1)";
  const clamp01 = (n) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
  const indexIn = (el) => Array.prototype.indexOf.call(el.parentElement.children, el);
  const num = (text) => {
    const found = String(text || "").match(/\d+/);
    return found ? Number(found[0]) : null;
  };

  /* ------------------------------------------------------------------ */
  /* 1. Interception de app.innerHTML                                    */
  /* ------------------------------------------------------------------ */

  let pending = null;

  function sigOf() {
    const first = app.firstElementChild;
    if (!first) return "";
    const title = app.querySelector("h1");
    const badge = app.querySelector(".turn-badge");
    return [first.className, title ? title.textContent.trim() : "", badge ? badge.textContent.trim() : ""].join("|");
  }

  function keyedElements(selector, keyOf) {
    const seen = new Map();
    const out = new Map();
    app.querySelectorAll(selector).forEach((el) => {
      const base = String(keyOf(el));
      const count = seen.get(base) || 0;
      seen.set(base, count + 1);
      out.set(base + "#" + count, el);
    });
    return out;
  }

  function selectionKeys() {
    const keys = new Set();
    app.querySelectorAll(".choice-row > .selected").forEach((el) => keys.add("choice:" + indexIn(el)));
    app.querySelectorAll(".guest-options > .selected").forEach((el) => keys.add("answer:" + indexIn(el)));
    app.querySelectorAll(".option-list > .option-row").forEach((el) => {
      if (el.querySelector(".mini-choice.selected")) keys.add("mini:" + indexIn(el));
      if (el.classList.contains("option-row-selected")) keys.add("row:" + indexIn(el));
    });
    if (app.querySelector(".selection-confirmation")) keys.add("confirm");
    return keys;
  }

  function hintState() {
    const hint = app.querySelector(".serpent-hint");
    if (!hint) return "";
    return hint.classList.contains("serpent-locked") ? "locked" : "open";
  }

  function capture() {
    const first = app.firstElementChild;
    const before = {
      sig: sigOf(),
      cls: first ? first.className : "",
      badge: num(app.querySelector(".turn-badge")?.textContent),
      rect: app.getBoundingClientRect(),
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      selection: selectionKeys(),
      hint: hintState(),
      progress: app.querySelectorAll(".progress-track i.done").length,
      indicator: app.querySelector(".waiting-indicator")?.textContent || "",
      leaders: new Map(),
      guests: new Map(),
      matches: new Set()
    };
    keyedElements(".leader-row", (el) => el.dataset.rankName || el.textContent).forEach((el, key) => {
      if (!el.hidden && el.offsetParent) before.leaders.set(key, el.getBoundingClientRect().top);
    });
    keyedElements(".guest-progress-row", (el) => el.querySelector("strong")?.textContent || "").forEach((el, key) => {
      before.guests.set(key, el.lastElementChild ? el.lastElementChild.textContent : "");
    });
    app.querySelectorAll(".match-accordion[data-match-id]").forEach((el) => before.matches.add(el.dataset.matchId));
    return before;
  }

  function detachChildren() {
    const fragment = document.createDocumentFragment();
    while (app.firstChild) fragment.append(app.firstChild);
    return fragment;
  }

  Object.defineProperty(app, "innerHTML", {
    configurable: true,
    enumerable: false,
    get() {
      return nativeHtml.get.call(this);
    },
    set(html) {
      try {
        if (!pending) {
          pending = { before: capture(), old: detachChildren() };
          queueMicrotask(flush);
        } else {
          detachChildren(); // plusieurs rendus dans le même tick : on garde l'état d'origine
        }
      } catch (error) {
        console.error("[motion]", error);
      }
      nativeHtml.set.call(this, html);
    }
  });

  function flush() {
    const job = pending;
    pending = null;
    if (!job) return;
    try {
      enhance(job);
    } catch (error) {
      console.error("[motion]", error);
    }
  }

  function enhance({ before, old }) {
    const now = document.timeline && document.timeline.currentTime != null ? document.timeline.currentTime : performance.now();
    root.style.setProperty("--clock", Math.round(now) + "ms");
    const sig = sigOf();
    const first = !before.sig;
    const changed = sig !== before.sig;
    if (changed) enterScreen(before, old, first);
    else stayOnScreen(before);
    decorate(app, { animate: changed });
  }

  /* ------------------------------------------------------------------ */
  /* 2. Changement d'écran : fondu croisé + entrée orchestrée            */
  /* ------------------------------------------------------------------ */

  const STAGE = ".home-copy,.intro-card,.game-heading,.progress-row,.score-preview,.game-card,.setup-card,.wizard-actions,.waiting-card,.sidebar-card,.result-header,.waiting-indicator,.invite-box,.leaderboard,.match-accordion-list,.match-result,.result-note,.result-actions";
  let enterTimer = 0;

  function direction(before) {
    const first = app.firstElementChild;
    const now = num(app.querySelector(".turn-badge")?.textContent);
    if (first && first.className === before.cls && before.badge != null && now != null && now < before.badge) return -1;
    return 1;
  }

  function spawnGhost(nodes, before, dir) {
    const layer = document.createElement("div");
    const cs = getComputedStyle(app);
    layer.className = "motion-ghost";
    layer.setAttribute("aria-hidden", "true");
    layer.inert = true;
    layer.style.cssText =
      "top:" + (before.rect.top + before.scrollY) + "px;" +
      "left:" + (before.rect.left + before.scrollX) + "px;" +
      "width:" + before.rect.width + "px;" +
      "height:" + Math.min(before.rect.height, 1600) + "px;" +
      "padding:" + cs.padding + ";" +
      "--dir:" + dir + ";";
    layer.append(nodes);
    layer.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
    layer.querySelectorAll("[name],[data-action]").forEach((el) => {
      el.removeAttribute("name");
      el.removeAttribute("data-action");
    });
    layer.querySelectorAll("a,button,input,select,textarea,summary").forEach((el) => el.setAttribute("tabindex", "-1"));
    document.body.append(layer);
    const remove = () => layer.remove();
    layer.addEventListener("animationend", remove, { once: true });
    setTimeout(remove, 900);
  }

  function markStages() {
    let index = 0;
    app.querySelectorAll(STAGE).forEach((el) => {
      const parent = el.parentElement ? el.parentElement.closest(STAGE) : null;
      if (parent && app.contains(parent)) return;
      el.setAttribute("data-enter", "");
      el.style.setProperty("--enter-i", String(Math.min(index, 7)));
      index += 1;
    });
  }

  function enterScreen(before, old, first) {
    const dir = direction(before);
    app.style.setProperty("--dir", String(dir));
    document.querySelectorAll(".motion-ghost").forEach((el) => el.remove());
    if (reduced()) return;

    if (!first && old && old.childNodes.length) spawnGhost(old, before, dir);
    markStages();
    app.classList.add("is-entering");
    clearTimeout(enterTimer);
    enterTimer = setTimeout(() => {
      app.classList.remove("is-entering");
      app.querySelectorAll("[data-enter]").forEach((el) => {
        el.removeAttribute("data-enter");
        el.style.removeProperty("--enter-i");
      });
    }, 1500);

    if (!first && window.scrollY > 40) window.scrollTo({ top: 0, behavior: "smooth" });

    progressFill(before);
    const area = app.querySelector(".game-card .dice-area");
    if (area && area.querySelector(".roll-total")) runDice(area);
    const tag = app.querySelector(".match-title .result-tag");
    if (tag) tag.classList.add("pop-in");
  }

  function progressFill(before) {
    const bars = app.querySelectorAll(".progress-track i.done");
    bars.forEach((bar, i) => {
      if (i < before.progress) return;
      bar.classList.add("fill-in");
      bar.style.setProperty("--fill-delay", 420 + (i - before.progress) * 90 + "ms");
    });
  }

  /* ------------------------------------------------------------------ */
  /* 3. Dés : secousse pendant l'attente, puis lancer et atterrissage    */
  /* ------------------------------------------------------------------ */

  const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

  function setFace(die, value) {
    const on = PIPS[value] || PIPS[1];
    die.querySelectorAll(".pip").forEach((pip, i) => pip.classList.toggle("on", on.includes(i)));
    die.dataset.face = String(value);
  }

  function randomFace(except) {
    let value = 1 + Math.floor(Math.random() * 6);
    if (value === except) value = (value % 6) + 1;
    return value;
  }

  function runDice(area) {
    const dice = Array.from(area.querySelectorAll(".die"));
    if (!dice.length) return;
    const total = area.querySelector(".roll-total");
    const fast = /commun/i.test(area.closest(".game-card")?.querySelector(".dice-header span")?.textContent || "");
    const startDelay = 300;
    const finals = dice.map((die) => num(die.getAttribute("aria-label")) || 1);
    const landAt = dice.map((_, i) => startDelay + (fast ? 520 : 780) + i * (fast ? 150 : 260));
    const landed = dice.map(() => false);
    const lastSwap = dice.map(() => 0);
    const t0 = performance.now();
    let done = false;

    area.classList.add("is-rolling");
    if (total) total.classList.add("is-waiting");
    dice.forEach((die, i) => {
      setFace(die, randomFace(finals[i]));
      die.style.setProperty("--spin", i % 2 ? "-1" : "1");
      die.style.setProperty("--roll-ms", landAt[i] - startDelay + "ms");
      die.style.setProperty("--roll-delay", startDelay + "ms");
      die.classList.add("is-tumbling");
    });

    function finish() {
      if (done) return;
      done = true;
      dice.forEach((die, i) => {
        setFace(die, finals[i]);
        die.classList.remove("is-tumbling");
        if (!landed[i]) die.classList.add("is-landed");
      });
      area.classList.remove("is-rolling");
      if (total) {
        total.classList.remove("is-waiting");
        total.classList.add("is-revealed");
      }
    }

    function frame(now) {
      if (done || !area.isConnected) return;
      const t = now - t0;
      dice.forEach((die, i) => {
        if (landed[i]) return;
        if (t >= landAt[i]) {
          landed[i] = true;
          setFace(die, finals[i]);
          die.classList.remove("is-tumbling");
          die.classList.add("is-landed");
          return;
        }
        if (now - lastSwap[i] > 80) {
          lastSwap[i] = now;
          setFace(die, randomFace(Number(die.dataset.face)));
        }
      });
      if (landed.every(Boolean)) finish();
      else requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
    setTimeout(finish, landAt[landAt.length - 1] + 500); // filet de sécurité (onglet en arrière-plan)
  }

  // Pendant que le serveur répond, les dés de l'écran « Lancer les dés » s'agitent.
  document.addEventListener(
    "click",
    (event) => {
      const button = event.target.closest && event.target.closest('button[data-action="roll"]');
      if (!button || reduced()) return;
      const area = button.closest(".game-card")?.querySelector(".dice-area");
      if (!area || area.dataset.shaking) return;
      const dice = Array.from(area.querySelectorAll(".die"));
      area.dataset.shaking = "1";
      area.classList.add("is-shaking");
      const timer = setInterval(() => {
        if (!area.isConnected) return clearInterval(timer);
        dice.forEach((die) => setFace(die, randomFace(Number(die.dataset.face))));
      }, 85);
      setTimeout(() => clearInterval(timer), 8000);
    },
    true
  );

  /* ------------------------------------------------------------------ */
  /* 4. Même écran : micro-animations ciblées                            */
  /* ------------------------------------------------------------------ */

  function stayOnScreen(before) {
    const hint = app.querySelector(".serpent-hint");
    if (hint && before.hint === (hint.classList.contains("serpent-locked") ? "locked" : "open")) {
      hint.classList.add("is-still"); // évite de rejouer l'apparition du Serpent à chaque clic
    }
    selectionPop(before);
    if (reduced()) return;
    rowsDiff(before);
  }

  function selectionPop(before) {
    if (reduced()) return;
    const pop = (el) => el && el.classList.add("just-selected");
    app.querySelectorAll(".choice-row > .selected").forEach((el) => {
      if (!before.selection.has("choice:" + indexIn(el))) pop(el);
    });
    app.querySelectorAll(".guest-options > .selected").forEach((el) => {
      if (!before.selection.has("answer:" + indexIn(el))) pop(el);
    });
    app.querySelectorAll(".option-list > .option-row").forEach((el) => {
      const i = indexIn(el);
      if (el.querySelector(".mini-choice.selected") && !before.selection.has("mini:" + i)) pop(el.querySelector(".mini-choice.selected"));
      if (el.classList.contains("option-row-selected") && !before.selection.has("row:" + i)) {
        pop(el);
        pop(el.querySelector(".selection-badge"));
      }
    });
    const confirm = app.querySelector(".selection-confirmation");
    if (confirm && !before.selection.has("confirm")) confirm.classList.add("sheet-in");
  }

  function flash(el, className, ms) {
    el.classList.add(className);
    setTimeout(() => el.classList.remove(className), ms);
  }

  function slideIn(el, delay) {
    el.animate(
      [
        { opacity: 0, transform: "translateX(-18px)" },
        { opacity: 1, transform: "none" }
      ],
      { duration: 560, delay, easing: EASE_OUT, fill: "backwards" }
    );
  }

  function rowsDiff(before) {
    // Classement : les nouvelles lignes arrivent, les autres glissent vers leur nouveau rang.
    let fresh = 0;
    keyedElements(".leader-row", (el) => el.dataset.rankName || el.textContent).forEach((el, key) => {
      if (el.hidden) return;
      const prevTop = before.leaders.get(key);
      if (prevTop == null) {
        const delay = fresh * 90;
        fresh += 1;
        slideIn(el, delay);
        flash(el, "is-new", 2400);
        const score = el.querySelector("b");
        if (score) wrapCount(score, delay + 250, 900);
        return;
      }
      const dy = prevTop - el.getBoundingClientRect().top;
      if (Math.abs(dy) > 2) {
        el.animate([{ transform: "translateY(" + dy + "px)" }, { transform: "none" }], { duration: 620, easing: EASE_OUT });
      }
    });

    // Détail des parties : nouvelle entrée mise en avant.
    let freshDetail = 0;
    app.querySelectorAll(".match-accordion[data-match-id]").forEach((el) => {
      if (el.hidden || before.matches.has(el.dataset.matchId) || !before.matches.size) return;
      slideIn(el, freshDetail * 90);
      flash(el, "is-new", 2400);
      freshDetail += 1;
    });

    // Liste des invités en attente : nouvel invité ou progression.
    let freshGuest = 0;
    keyedElements(".guest-progress-row", (el) => el.querySelector("strong")?.textContent || "").forEach((el, key) => {
      const prevStatus = before.guests.get(key);
      if (prevStatus === undefined) {
        slideIn(el, freshGuest * 90);
        flash(el, "is-new", 2400);
        freshGuest += 1;
      } else if (el.lastElementChild && prevStatus !== el.lastElementChild.textContent) {
        flash(el, "is-updated", 1600);
      }
    });

    const indicator = app.querySelector(".waiting-indicator");
    if (indicator && before.indicator && before.indicator !== indicator.textContent) flash(indicator, "is-updated", 1600);
  }

  /* ------------------------------------------------------------------ */
  /* 5. Compteurs et jauges                                              */
  /* ------------------------------------------------------------------ */

  // Le chiffre réel reste dans le DOM (lecteurs d'écran, copie) : on le masque et on
  // dessine par-dessus un compteur CSS animé (voir motion.css).
  function wrapCount(el, delay = 0, duration = 1100) {
    if (!COUNTERS || reduced() || !el) return;
    const node = Array.from(el.childNodes).find((n) => n.nodeType === 3 && /\d/.test(n.nodeValue));
    if (!node) return;
    const match = node.nodeValue.match(/^(\s*)(\d+)([.,]\d+)?([\s\S]*)$/);
    if (!match) return;
    const target = Number(match[2]);
    if (!target) return;
    const span = document.createElement("span");
    span.className = "count";
    span.textContent = match[2] + (match[3] || "");
    span.dataset.frac = match[3] || "";
    span.style.setProperty("--to", String(target));
    span.style.setProperty("--count-delay", delay + "ms");
    span.style.setProperty("--count-dur", duration + "ms");
    span.style.setProperty("--ink", getComputedStyle(el).color);
    const parent = node.parentNode;
    if (match[1]) parent.insertBefore(document.createTextNode(match[1]), node);
    parent.insertBefore(span, node);
    if (match[4]) node.nodeValue = match[4];
    else node.remove();
  }

  function makeMeter(ratio, delay) {
    const wrap = document.createElement("span");
    const fill = document.createElement("i");
    wrap.className = "meter";
    wrap.setAttribute("aria-hidden", "true");
    fill.style.setProperty("--fill", String(clamp01(ratio)));
    if (delay != null && !reduced()) {
      fill.classList.add("grow");
      fill.style.setProperty("--meter-delay", delay + "ms");
    }
    wrap.append(fill);
    return wrap;
  }

  function decorate(scope, { animate }) {
    const go = animate && !reduced();

    scope.querySelectorAll(".match-result").forEach((result) => {
      if (result.querySelector(":scope > .score-track")) return;
      const title = result.querySelector(":scope > .match-title");
      const score = title && title.querySelector("h2");
      const value = score ? num(score.textContent) : null;
      if (!title || value == null) return;
      const track = document.createElement("div");
      track.className = "score-track";
      track.setAttribute("aria-hidden", "true");
      const fill = document.createElement("i");
      fill.style.setProperty("--fill", String(clamp01(value / 100)));
      if (go) {
        fill.classList.add("grow");
        fill.style.setProperty("--meter-delay", "420ms");
      }
      track.append(fill);
      title.after(track);
      if (go) wrapCount(score, 380, 1300);
    });

    scope.querySelectorAll(".score-breakdown > div").forEach((cell, i) => {
      if (cell.querySelector(".meter")) return;
      const b = cell.querySelector("b");
      const m = b && b.textContent.match(/(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)/);
      if (!m) return;
      cell.append(makeMeter(parseFloat(m[1].replace(",", ".")) / parseFloat(m[2].replace(",", ".")), go ? 620 + i * 120 : null));
      if (go) wrapCount(b, 560 + i * 120, 900);
    });

    scope.querySelectorAll(".metric-card").forEach((card, i) => {
      if (card.querySelector(".meter")) return;
      const row = card.querySelector(".metric-value-row");
      const valueEl = card.querySelector(".metric-value");
      const value = valueEl ? num(valueEl.textContent) : null;
      if (!row || value == null) return;
      row.after(makeMeter(value / 100, go ? 760 + i * 140 : null));
      if (go) wrapCount(valueEl, 700 + i * 140, 1100);
    });

    if (go) {
      scope.querySelectorAll(".leader-row b").forEach((b, i) => wrapCount(b, 520 + Math.min(i, 9) * 70, 900));
      scope.querySelectorAll(".accordion-score").forEach((el, i) => wrapCount(el, 560 + Math.min(i, 9) * 70, 900));
    }
  }

  /* ------------------------------------------------------------------ */
  /* 6. Détails des parties (accordéon fluide)                           */
  /* ------------------------------------------------------------------ */

  let userToggleAt = 0;

  app.addEventListener("click", (event) => {
    const summary = event.target.closest && event.target.closest("details.match-accordion > summary");
    if (!summary) return;
    userToggleAt = performance.now();
    const details = summary.parentElement;
    if (reduced() || !details.open || details.dataset.closing) return;
    const content = details.querySelector(".match-accordion-content");
    if (!content) return;
    event.preventDefault();
    details.dataset.closing = "1";
    content.style.overflow = "hidden";
    const height = content.getBoundingClientRect().height;
    const animation = content.animate(
      [
        { height: height + "px", opacity: 1 },
        { height: "0px", opacity: 0 }
      ],
      { duration: 300, easing: "cubic-bezier(.4,0,.2,1)", fill: "forwards" }
    );
    animation.onfinish = () => {
      details.open = false;
      animation.cancel();
      content.style.overflow = "";
      delete details.dataset.closing;
    };
  });

  app.addEventListener(
    "toggle",
    (event) => {
      const details = event.target.closest && event.target.closest("details.match-accordion");
      if (!details || !details.open || reduced() || performance.now() - userToggleAt > 700) return;
      requestAnimationFrame(() => {
        const content = details.querySelector(".match-accordion-content");
        if (!content) return;
        decorate(content, { animate: true });
        content.style.overflow = "hidden";
        const height = content.getBoundingClientRect().height;
        const animation = content.animate(
          [
            { height: "0px", opacity: 0 },
            { height: height + "px", opacity: 1 }
          ],
          { duration: 420, easing: EASE_OUT }
        );
        animation.onfinish = () => {
          content.style.overflow = "";
        };
      });
    },
    true
  );

  /* ------------------------------------------------------------------ */
  /* 7. Petits retours d'action                                          */
  /* ------------------------------------------------------------------ */

  document.addEventListener(
    "click",
    (event) => {
      const target = event.target.closest && event.target.closest("button[data-action]");
      if (!target || reduced()) return;
      if (target.dataset.action === "confirm-selection") target.classList.add("is-sealing");
      if (target.dataset.action === "copy-invite") flash(target, "is-copied", 1500);
    },
    true
  );

  // Le toast sort en douceur au lieu de disparaître d'un coup.
  new MutationObserver((records) => {
    for (const record of records) {
      record.addedNodes.forEach((node) => {
        if (node.nodeType === 1 && node.classList.contains("toast") && !node.dataset.leaving) {
          document.querySelectorAll(".toast[data-leaving]").forEach((old) => old.remove());
        }
      });
      record.removedNodes.forEach((node) => {
        if (node.nodeType !== 1 || !node.classList.contains("toast") || node.dataset.leaving) return;
        if (reduced() || document.querySelector(".toast:not([data-leaving])")) return;
        node.dataset.leaving = "1";
        node.classList.add("is-leaving");
        document.body.append(node);
        node.addEventListener("animationend", () => node.remove(), { once: true });
        setTimeout(() => node.remove(), 700);
      });
    }
  }).observe(document.body, { childList: true });
})();
