
# Est-ce que je peux te faire confiance ?

Une application web en français, pensée pour le téléphone et l'ordinateur. Un hôte prépare une partie et partage le même lien avec son groupe. Chaque invité répond séparément; dès qu'il termine, il voit son propre score sur 100, son verdict de confiance et le détail de ses réponses. Seul l'organisateur voit les scores et les réponses détaillées de tout le groupe ainsi que le classement privé, qui s'enrichit à mesure que les amis finissent.

## Lancer l'application

Prérequis : Node.js 20 ou plus récent. Aucune dépendance externe n'est nécessaire.

```sh
npm start
```

Ouvre [http://localhost:4173](http://localhost:4173). En développement, `npm run dev` redémarre le serveur après une modification.

Les parties sont enregistrées dans `data/games.json`. Pour choisir un autre port ou fichier, définir `PORT` ou `DATA_FILE`.

## Garder les parties après un redémarrage (hébergeur gratuit)

Sur un hébergeur gratuit comme Render, le disque est effacé à chaque redémarrage ou redéploiement, donc `data/games.json` disparaît. Pour éviter de perdre les parties, le serveur peut les enregistrer dans des bases Redis gratuites d'[Upstash](https://upstash.com) (aucune dépendance à installer).

**Une base, ou jusqu'à 5 pour répartir la charge.** Chaque base se déclare avec deux variables d'environnement :

| Base | URL | Token |
| --- | --- | --- |
| 1 | `UPSTASH_REDIS_REST_URL` | `UPSTASH_REDIS_REST_TOKEN` |
| 2 à 5 | `UPSTASH_REDIS_REST_URL_2` … `_5` | `UPSTASH_REDIS_REST_TOKEN_2` … `_5` |

Chaque partie est rangée dans **une seule** base, choisie d'après son identifiant : avec 5 bases, chacune reçoit environ un cinquième des parties et des écritures. Une action de joueur n'écrit que sa propre partie, jamais l'ensemble. Au démarrage, le serveur lit toutes les bases et au journal apparaît « Stockage distant actif ».

**Base collectrice (facultative).** Avec `UPSTASH_REDIS_REST_URL_COLLECTOR` et `UPSTASH_REDIS_REST_TOKEN_COLLECTOR`, une base supplémentaire rassemble toutes les parties : le serveur lui envoie en un seul lot, à intervalle régulier, les parties modifiées depuis le dernier envoi (toutes les 60 secondes par défaut, réglable avec `COLLECT_INTERVAL_SECONDS`). C'est aussi la copie de secours : si une base de répartition est illisible au démarrage, ses parties sont reprises depuis la collectrice. Sans collectrice, le serveur refuse de démarrer quand une base est illisible, plutôt que de perdre ou d'écraser des parties.

Changer le nombre de bases est possible : au démarrage, chaque partie mal placée est recopiée dans sa nouvelle base puis retirée de l'ancienne.

**Anti-archivage.** Au démarrage puis toutes les 24 heures, le serveur écrit un petit signe de vie dans chaque base : une base gratuite restée inactive finirait archivée.

**Garder le service éveillé.** `/healthz` répond « ok » à toute méthode HTTP : c'est l'adresse à appeler à intervalle régulier (par exemple avec un « schedule » QStash en cron `*/5 * * * *`) pour que Render ne mette pas le service en veille.

Sans ces variables, le serveur continue d'utiliser le fichier local. Les parties sont rangées sous la clé `confiance:games:h` (modifiable avec `GAMES_KEY`).

## Parcours d'une partie

1. L'hôte choisit son nom. Il n'a pas besoin de prévoir combien d'amis participeront.
2. Il lance deux dés avant chacun de ses trois dilemmes. Le total de 2 à 12 sélectionne un scénario parmi les 110 textes du jeu; l'intensité augmente entre les tours.
3. Après les dilemmes, l'hôte choisit trois questions parmi une banque de 50 et fixe ses propres réponses parmi cinq propositions fixes, sans saisie libre. La question sur la boisson propose l'eau, la bière, le vin, le chocolat chaud ou « Aucune de ces réponses ». Il passe ces questions sur trois écrans distincts, puis voit chaque mise en situation sur son propre écran. Pour chacune, quatre réponses sont proposées : son premier clic marque la priorité; son deuxième clic, sur une réponse différente, marque l'alternative acceptée. Les deux autres réponses valent zéro. Il peut revenir en arrière avant de verrouiller sa préparation.
4. La préparation est verrouillée. Le même lien d'invitation peut être envoyé à autant d'amis que souhaité; le jeu n'impose pas de nombre maximal et personne n'a besoin de fermer les inscriptions.
5. Les invités répondent dans cet ordre : question personnelle, situation, dilemme, puis le même cycle deux fois; une quatrième situation termine la partie. Ils choisissent toujours parmi des boutons de réponse prédéfinis : les trois questions personnelles concernent A, et l'invité essaie de deviner ses réponses; dans chaque mise en situation, il choisit ce qu'il ferait pour A. Aucun champ de réponse libre n'est utilisé dans ces phases. Chacun fait face aux trois mêmes dilemmes et répond aux quatre mêmes situations. Le pseudo est mémorisé dans le navigateur; rouvrir le même lien sur cet appareil reprend la session de l'invité.
6. Dès qu'un invité finit, il voit son bilan personnel : score, verdict, choix et corrections. Il ne reçoit aucun résultat concernant un autre invité ni le classement global. L'organisateur peut consulter le détail de chacun et le classement privé s'actualise à mesure que les amis finissent.

Un invité qui ferme la page peut reprendre sa partie en rouvrant le lien sur le même navigateur. Le profil local retient son pseudo et son jeton de session; ce n'est pas un compte récupérable sur un autre appareil. Le lien d'invitation reste ouvert et ne montre aucune réponse.

## Scores

Chaque résultat d'ami est calculé sur 100 points :

- **Dilemmes : 30 points.** Pour chacune des trois paires de choix A/ami : PARTAGER/PARTAGER vaut 10 points; un choix de chaque type vaut 2,5; VOLER/VOLER vaut 0.
- **Questions personnelles : 30 points.** Chaque réponse qui correspond à la réponse de référence choisie par l'hôte vaut 10 points. Les cinq choix incluent « Aucune de ces réponses ».
- **Situations : 40 points.** La réponse idéale vaut 10; l'alternative acceptée vaut 5; chacune des deux autres réponses vaut 0.

Deux indicateurs complémentaires sont affichés pour chaque duo :

- **Coopération :** nombre de PARTAGER parmi les six décisions des deux joueurs, sur six.
- **Confiance dans cette partie :** moyenne des trois paires de dilemmes (100 % pour deux PARTAGER, 25 % pour des choix opposés, 0 % pour deux VOLER). Le message affiché est choisi parmi des formulations écrites pour les résultats possibles.

Ces nombres décrivent uniquement les choix effectués dans cette partie; ils ne sont pas des mesures scientifiques de la personnalité ou de la fiabilité. Partager ne garantit pas une victoire individuelle. Le Serpent du doute garde chaque indice jusqu'à ce que l'invité partage ou copie le lien d'invitation. Il donne ensuite un indice distinct à chaque dilemme, vrai ou inversé au hasard, sans influencer le score.

## Lien de partage

Le jeu ne fixe pas de nombre maximal d'invités, mais la capacité réelle dépend des ressources de l'hébergement. Le serveur écoute sur toutes les interfaces. Pour des amis sur le même Wi-Fi, définis `PUBLIC_URL` avec l'adresse locale de l'ordinateur qui héberge le jeu. Pour jouer par Internet, déploie le service derrière HTTPS et définis `PUBLIC_URL` à l'adresse publique.

Exemple PowerShell pour un réseau local :

```powershell
$env:PUBLIC_URL = "http://192.168.1.20:4173"
npm start
```

## Animations

Les animations sont isolées de la logique du jeu :

- `public/animations.css` : l'illustration animée du Serpent du doute.
- `public/motion.js` et `public/motion.css` : tout le reste (transitions entre écrans, lancer de dés, retour sur les choix, compteurs et jauges des résultats, classement en direct, détails des parties).

`motion.js` intercepte l'affectation `app.innerHTML` de `app.js`, compare l'écran d'avant et celui d'après, puis anime uniquement ce qui a changé : un nouvel écran déclenche un fondu croisé et une entrée orchestrée, une simple mise à jour (sélection, nouveau classement) ne rejoue pas les animations d'entrée. `app.js` n'a pas besoin de le connaître, et une erreur dans `motion.js` ne bloque jamais le jeu. L'option système « réduire les animations » est respectée.

Quand `motion.js` ou `motion.css` change, incrémenter le numéro `?v=` correspondant dans `public/index.html`.

## Tests

```sh
npm test
```

Les tests couvrent les banques, les règles de score, les invitations multi-amis, le verrouillage, la confidentialité avant révélation, le classement, la sauvegarde des réponses, ainsi que les pages publiques, le sitemap et les règles d'emplacement publicitaire.

## Site public, référencement et publicité

Le serveur publie, en plus du jeu, des pages indexables qui apportent le trafic et le contenu qu'exige Google AdSense :

- `/dilemmes` et `/dilemmes/<id>` : une page par dilemme (110 au total), avec les quatre issues et une interaction facultative.
- `/articles/...` : trois articles de fond (jeux de confiance, dilemme du prisonnier, animer une soirée).
- `/a-propos`, `/contact`, `/mentions-legales`, `/confidentialite` : pages exigées par AdSense, sans aucune annonce.
- `/robots.txt`, `/sitemap.xml` (généré, 121 adresses) et `/ads.txt` (généré depuis `public/ad-config.js`, avec `public/ads.txt` comme secours explicite pour l'exploration).

Variables d'environnement à définir sur l'hébergeur :

| Variable | Rôle |
| --- | --- |
| `PUBLIC_URL` | Adresse publique du site (ex. `https://mon-domaine.fr`), utilisée pour les liens canoniques et le sitemap. |
| `OWNER_NAME` | Nom de l'éditeur affiché dans les mentions légales et la politique de confidentialité. |
| `CONTACT_EMAIL` | Adresse de contact affichée sur les pages légales. Tant qu'elle manque, un texte à compléter est affiché. |

### Règles d'emplacement des annonces

Les annonces éditoriales sont placées sur l'accueil (`home-content`), le guide (`guide-bottom`), le catalogue de dilemmes (`hub-top`, `hub-middle`), chaque fiche de dilemme (`dilemma-top`, `dilemma-bottom`) et les articles (`article-top`, `article-middle`, `article-bottom`). Une unité distincte `game-play` est réservée aux écrans de jeu : elle reste montée pendant la session, sous le contenu de réponse, avec 170 px d'écart des commandes. Elle ne se recharge donc pas à chaque réponse. Il n'y a pas d'annonce sur les pages légales ou les erreurs 404. Chaque unité est chargée une fois, à l'approche de l'écran, et masquée si Google ne la remplit pas.

### Activer la publicité

1. Le site est validé dans AdSense. L'identifiant éditeur `ca-pub-1658775159189335` est renseigné; `/ads.txt` génère maintenant la ligne Google correspondante.
2. Dans AdSense, créer une unité « display responsive », puis renseigner son `slotId` ou un numéro distinct dans `slots` pour chaque emplacement ci-dessus, notamment `game-play`.
3. Publier un message de consentement dans « Confidentialité et messages ». Après publication, passer `consentConfigured` à `true`. Google demande une CMP certifiée TCF pour les annonces personnalisées dans l'EEE, au Royaume-Uni et en Suisse.
4. Le Serpent utilise l'Ad Placement API pour les vidéos récompensées. L'accès à AdSense H5 Games Ads est sur demande et doit être approuvé; une fois l'accord obtenu et le consentement publié, passer `h5GamesEnabled` à `true`. Le joueur confirme explicitement le lancement, et l'indice n'est accordé qu'après le callback `adViewed`. En cas de non-diffusion ou d'annonce interrompue, le partage du lien reste une solution de secours. Cette récompense n'ajoute aucun point.
5. `testMode: true` sert aux essais sur les unités display. Le code n'ajoute aucune dépendance.

Google recommande de retirer les annonces de contenu des pages de jeu ou de les éloigner d'au moins 150 px; l'emplacement `game-play` garde 170 px de séparation et reste distinct des boutons. Les annonces H5 récompensées du Serpent nécessitent l'accès au programme H5 Games Ads; elles ne sont pas disponibles simplement parce que le site est validé. Voir les instructions Google sur [les règles AdSense](https://support.google.com/adsense/answer/23921?hl=fr), [les pages de jeux](https://support.google.com/adsense/answer/2768340?hl=fr), [H5 Games Ads](https://support.google.com/adsense/answer/1705831?hl=fr), [l'Ad Placement API](https://developers.google.com/ad-placement/apis/adbreak?hl=fr) et le [consentement des utilisateurs européens](https://support.google.com/adsense/answer/13554116?hl=fr).

## Contenu

La banque actuelle comprend 110 dilemmes. Le fichier [120-dilemmes-a-evaluer.md](120-dilemmes-a-evaluer.md) est conservé pour la prochaine réécriture et l'évaluation par Claude; les textes pourront être remplacés ensuite sans changer les règles du jeu. Les choix éditoriaux et les références générales sont dans [SOURCES.md](SOURCES.md).
