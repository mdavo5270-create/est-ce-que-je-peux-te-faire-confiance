
(() => {
  const config = window.GAME_ADS || {};
  if (!/^ca-pub-[0-9]+$/.test(config.clientId || "")
    || !/^[0-9]+$/.test(config.guideSlotId || "")
    || config.consentConfigured !== true) return;
  const host = window.location.hostname.toLowerCase();
  if (!host || host === "localhost" || host === "127.0.0.1" || host.endsWith(".localhost")) return;
  const slot = document.querySelector("#ad-slot-guide");
  const panel = document.querySelector("#guide-ad-panel");
  if (!slot || !panel) return;
  const script = document.createElement("script");
  script.async = true;
  script.crossOrigin = "anonymous";
  script.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + encodeURIComponent(config.clientId);
  script.addEventListener("load", () => {
    const unit = document.createElement("ins");
    unit.className = "adsbygoogle";
    unit.style.display = "block";
    unit.style.minHeight = "100px";
    unit.dataset.adClient = config.clientId;
    unit.dataset.adSlot = config.guideSlotId;
    unit.dataset.adFormat = "auto";
    unit.dataset.fullWidthResponsive = "true";
    slot.replaceChildren(unit);
    panel.hidden = false;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      panel.hidden = true;
    }
  }, { once: true });
  document.head.append(script);
})();

