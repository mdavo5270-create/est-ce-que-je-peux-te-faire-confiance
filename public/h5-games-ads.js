(() => {
  const config = window.GAME_ADS || {};
  const clientOk = /^ca-pub-[0-9]{10,20}$/.test(config.clientId || "");
  const host = location.hostname.toLowerCase();
  const isLocal = !host || host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host.endsWith(".localhost");
  const enabled = clientOk && config.consentConfigured === true && config.h5GamesEnabled === true && !isLocal;

  if (!enabled) {
    window.SerpentAds = Object.freeze({ enabled: false });
    return;
  }

  // Initialisation officielle de l'Ad Placement API H5. Le script AdSense est
  // déjà placé dans le <head> par le serveur; cette file attend son chargement.
  window.adsbygoogle = window.adsbygoogle || [];
  window.adBreak = window.adConfig = function (options) {
    window.adsbygoogle.push(options);
  };
  window.adConfig({ preloadAdBreaks: "auto", sound: "off" });

  let activeRequest = null;
  let pendingReward = null;

  function requestRewarded(turn, onAvailable) {
    if (typeof window.adBreak !== "function" || activeRequest) {
      return Promise.resolve({ status: "notReady" });
    }

    return new Promise((resolve) => {
      let settled = false;
      let viewed = false;
      const request = { turn, resolve };
      activeRequest = request;

      const finish = (status) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (activeRequest === request) activeRequest = null;
        if (pendingReward?.request === request) pendingReward = null;
        resolve({ status });
      };
      request.finish = finish;

      const timer = setTimeout(() => finish("timeout"), 30000);
      try {
        window.adBreak({
          type: "reward",
          name: "serpent-doubt-hint-" + turn,
          beforeReward(showAdFn) {
            pendingReward = { request, showAdFn };
            if (typeof onAvailable === "function") onAvailable();
          },
          adDismissed() {},
          adViewed() { viewed = true; },
          adBreakDone(placementInfo) {
            finish(viewed ? "viewed" : placementInfo?.breakStatus || "unavailable");
          }
        });
      } catch {
        finish("error");
      }
    });
  }

  function showRewarded(turn) {
    const reward = pendingReward;
    if (!reward || reward.request.turn !== turn || typeof reward.showAdFn !== "function") return false;
    pendingReward = null;
    try {
      // Called only by the player's explicit confirmation click, as required by the API.
      reward.showAdFn();
      return true;
    } catch {
      reward.request.finish("error");
      return false;
    }
  }

  window.SerpentAds = Object.freeze({ enabled: true, requestRewarded, showRewarded });
})();
