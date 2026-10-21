(() => {
  const config = window.GAME_ADS || {};
  const idPattern = /^[0-9]{5,20}$/;
  const clientOk = /^ca-pub-[0-9]{10,20}$/.test(config.clientId || "");
  const host = location.hostname.toLowerCase();
  const isLocal = !host || host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host.endsWith(".localhost");
  const enabled = clientOk && config.consentConfigured === true && !isLocal;
  if (!enabled) return;

  const slotFor = (name) => [(config.slots || {})[name], config.slotId, config.guideSlotId].find((value) => idPattern.test(value || "")) || "";
  const deactivate = (wrap) => { if (wrap) wrap.removeAttribute("data-ad-active"); };

  // --- Consentement : module « Privacy & messaging » de Google (Funding Choices) ---
  function startConsent() {
    const signal = () => {
      if (window.frames.googlefcPresent) return;
      if (!document.body) { setTimeout(signal, 0); return; }
      const frame = document.createElement("iframe");
      frame.name = "googlefcPresent";
      frame.style.display = "none";
      frame.setAttribute("aria-hidden", "true");
      frame.tabIndex = -1;
      document.body.append(frame);
    };
    signal();
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://fundingchoicesmessages.google.com/i/" + encodeURIComponent(config.clientId.replace(/^ca-/, "")) + "?ers=1";
    document.head.append(script);
    window.googlefc = window.googlefc || {};
    window.googlefc.callbackQueue = window.googlefc.callbackQueue || [];
    document.querySelectorAll("[data-privacy-choices]").forEach((button) => {
      button.hidden = false;
      button.addEventListener("click", () => {
        try { window.googlefc.callbackQueue.push(window.googlefc.showRevocationMessage); } catch { /* message indisponible */ }
      });
    });
  }

  // --- Chargement unique du script AdSense ---
  let loader = null;
  function loadAdScript() {
    if (!loader) {
      loader = new Promise((resolve, reject) => {
        // Le serveur garde le tag de vérification AdSense dans le <head>.
        // Réutilise-le pour ne pas charger adsbygoogle.js une seconde fois.
        const existing = document.querySelector('script[src^="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?"]');
        if (existing) { resolve(); return; }
        const script = document.createElement("script");
        script.async = true;
        script.crossOrigin = "anonymous";
        script.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + encodeURIComponent(config.clientId);
        script.addEventListener("load", resolve, { once: true });
        script.addEventListener("error", reject, { once: true });
        document.head.append(script);
      });
    }
    return loader;
  }

  // --- Montage d'une annonce (une seule fois par emplacement, jamais rafraîchie) ---
  function mount(unit) {
    if (unit.dataset.adState) return;
    const wrap = unit.closest(".ad-wrap");
    const slot = slotFor(unit.dataset.adSlot);
    if (!slot) { deactivate(wrap); return; }
    unit.dataset.adState = "loading";
    loadAdScript().then(() => {
      const ins = document.createElement("ins");
      ins.className = "adsbygoogle";
      ins.style.display = "block";
      ins.dataset.adClient = config.clientId;
      ins.dataset.adSlot = slot;
      ins.dataset.adFormat = "auto";
      ins.dataset.fullWidthResponsive = "true";
      if (config.testMode === true) ins.dataset.adtest = "on";
      new MutationObserver(() => { if (ins.dataset.adStatus === "unfilled") deactivate(wrap); }).observe(ins, { attributes: true, attributeFilter: ["data-ad-status"] });
      unit.replaceChildren(ins);
      unit.dataset.adState = "done";
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch { deactivate(wrap); }
    }).catch(() => deactivate(wrap));
  }

  let lazyObserver = null;
  function observeUnits(root) {
    if (!root) return;
    const units = [];
    if (root.matches?.(".ad-unit[data-ad-slot]")) units.push(root);
    units.push(...(root.querySelectorAll?.(".ad-unit[data-ad-slot]") || []));
    units.forEach((unit) => {
      if (unit.dataset.adObserved) return;
      unit.dataset.adObserved = "true";
      unit.closest(".ad-wrap")?.setAttribute("data-ad-active", "");
      if (lazyObserver) lazyObserver.observe(unit);
      else mount(unit);
    });
  }

  function init() {
    startConsent();
    if ("IntersectionObserver" in window) {
      // Chargement différé : l'annonce n'est demandée que lorsqu'elle approche de l'écran.
      lazyObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          lazyObserver.unobserve(entry.target);
          mount(entry.target);
        });
      }, { rootMargin: "300px 0px" });
    }
    observeUnits(document);

    // Les questions sont rendues dans une seule page : observe les blocs publicitaires
    // créés lorsque l'écran de jeu change après une réponse.
    const appRoot = document.querySelector("#app");
    if (appRoot) new MutationObserver((records) => {
      records.forEach((record) => record.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) observeUnits(node);
      }));
    }).observe(appRoot, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
