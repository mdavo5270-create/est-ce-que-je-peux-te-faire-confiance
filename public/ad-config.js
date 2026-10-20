// Configuration AdSense : une seule modification suffit pour tout activer.
//
// 1. clientId  : identifiant éditeur du compte AdSense (ca-pub-XXXXXXXXXXXXXXXX).
// 2. slotId    : numéro d'une unité publicitaire « display responsive » (utilisé partout).
//    Pour suivre chaque position séparément, renseigne `slots` avec un numéro par position :
//    guide-top, guide-bottom, home-content, hub-top, hub-middle, dilemma-top, dilemma-bottom,
//    article-top, article-middle, article-bottom, results.
// 3. consentConfigured : à passer à true UNIQUEMENT après avoir créé et publié le message de
//    consentement (Privacy & messaging, certifié TCF) dans le compte AdSense. Tant que cette
//    valeur est false, aucune annonce n'est chargée.
//
// Rien ne s'affiche sur localhost, ni tant que ces valeurs ne sont pas valides.
window.GAME_ADS = {
  clientId: "",
  slotId: "",
  slots: {},
  consentConfigured: false,
  testMode: false
};
