// Configuration AdSense : l'identifiant éditeur est prêt. Les annonces restent
// inactives tant qu'une unité publicitaire et le message de consentement ne sont pas configurés.
//
// 1. clientId  : identifiant éditeur du compte AdSense (ca-pub-XXXXXXXXXXXXXXXX).
// 2. slotId    : numéro d'une unité publicitaire « display responsive » (utilisé partout).
//    Pour suivre chaque position séparément, renseigne `slots` avec un numéro par position :
//    guide-bottom, home-content, game-play, hub-top, hub-middle, dilemma-top, dilemma-bottom,
//    article-top, article-middle, article-bottom.
// 3. consentConfigured : à passer à true UNIQUEMENT après avoir créé et publié le message de
//    consentement (Privacy & messaging, certifié TCF) dans le compte AdSense. Tant que cette
//    valeur est false, les unités display et les annonces récompensées restent désactivées.
// 4. h5GamesEnabled : passer à true uniquement après acceptation au programme AdSense H5 Games Ads.
//
// Rien ne s'affiche sur localhost, ni tant que ces valeurs ne sont pas valides.
window.GAME_ADS = {
  clientId: "ca-pub-1658775159189335",
  slotId: "",
  slots: {},
  consentConfigured: false,
  h5GamesEnabled: false,
  testMode: false
};
