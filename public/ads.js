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

  function init() {
    startConsent();
    const units = [...document.querySelectorAll(".ad-unit[data-ad-slot]")];
    units.forEach((unit) => unit.closest(".ad-wrap")?.setAttribute("data-ad-active", ""));
    if (!("IntersectionObserver" in window)) { units.forEach(mount); return; }
    // Chargement différé : l'annonce n'est demandée que lorsqu'elle approche de l'écran.
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        mount(entry.target);
      });
    }, { rootMargin: "300px 0px" });
    units.forEach((unit) => observer.observe(unit));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
