
(() => {
  const config = window.GAME_ADS || {};
  if (!/^ca-pub-[0-9]+$/.test(config.clientId || "") || !/^[0-9]+$/.test(config.resultSlotId || "")) return;
  const root = document.querySelector("#app");
  if (!root) return;
  const script = document.createElement("script");
  script.async = true;
  script.crossOrigin = "anonymous";
  script.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + encodeURIComponent(config.clientId);
  const mount = () => {
    const slot = root.querySelector("#ad-slot-results");
    if (!slot || slot.dataset.loaded) return;
    const unit = document.createElement("ins");
    unit.className = "adsbygoogle";
    unit.style.display = "block";
    unit.style.minHeight = "90px";
    unit.dataset.adClient = config.clientId;
    unit.dataset.adSlot = config.resultSlotId;
    unit.dataset.adFormat = "auto";
    unit.dataset.fullWidthResponsive = "true";
    slot.replaceChildren(unit);
    slot.dataset.loaded = "true";
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch {}
  };
  script.addEventListener("load", mount, { once: true });
  document.head.append(script);
  new MutationObserver(mount).observe(root, { childList: true, subtree: true });
})();

