
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

Sur un hébergeur gratuit comme Render, le disque est effacé à chaque redémarrage ou redéploiement, donc `data/games.json` disparaît. Pour éviter de perdre les parties, le serveur peut les enregistrer dans une base Redis gratuite d'Upstash (aucune dépendance à installer) :

1. Créer une base sur [upstash.com](https://upstash.com) (offre gratuite).
2. Copier `UPSTASH_REDIS_REST_URL` et `UPSTASH_REDIS_REST_TOKEN` depuis l'onglet REST de la base.
3. Les définir comme variables d'environnement du service. Au démarrage, le journal affiche « Stockage distant actif ».

Sans ces deux variables, le serveur continue d'utiliser le fichier local. Si la base est injoignable au démarrage, le serveur s'arrête volontairement plutôt que de repartir à vide et d'écraser les parties enregistrées. La clé utilisée est `confiance:games` (modifiable avec `GAMES_KEY`).

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

## Tests

```sh
npm test
```

Les tests couvrent les banques, les règles de score, les invitations multi-amis, le verrouillage, la confidentialité avant révélation, le classement et la sauvegarde des réponses.

## Publicité et publication

Une page informative dédiée est disponible sur `/guide.html`. C'est le seul emplacement prévu pour une bannière AdSense; aucune annonce ne se place près des boutons de choix ou sur les écrans où l'on joue. Le code publicitaire reste inactif sur `localhost` et tant que `clientId`, `guideSlotId` et `consentConfigured` dans `public/ad-config.js` ne sont pas configurés.

Pour l'activer, il faudra publier le site sous HTTPS, ajouter et faire approuver ce domaine dans le compte AdSense, puis remplacer les valeurs vides par l'identifiant éditeur (`ca-pub-…`) et le numéro d'unité publicitaire obtenus dans ce compte. Il faudra aussi publier les informations de confidentialité et configurer la CMP/Privacy & messaging de Google avant l'activation pour les régions concernées. La valeur `consentConfigured` doit rester `false` jusqu'à ce que cette configuration soit réellement faite. Google demande une CMP certifiée intégrée au TCF pour les annonces personnalisées dans l'EEE, au Royaume-Uni et en Suisse : https://support.google.com/adsense/answer/13554116?hl=fr.

Le Serpent conserve actuellement la tâche de partage/copie du lien; cette action ne génère pas de revenu. Une annonce récompensée pour son indice nécessitera une intégration distincte via Google Ad Manager et doit rester facultative. Le code ajouté ici n'ajoute aucune dépendance et n'entraîne aucun coût d'hébergement, de domaine ou de compte publicitaire.

## Contenu

La banque actuelle comprend 110 dilemmes. Le fichier [120-dilemmes-a-evaluer.md](120-dilemmes-a-evaluer.md) est conservé pour la prochaine réécriture et l'évaluation par Claude; les textes pourront être remplacés ensuite sans changer les règles du jeu. Les choix éditoriaux et les références générales sont dans [SOURCES.md](SOURCES.md).

