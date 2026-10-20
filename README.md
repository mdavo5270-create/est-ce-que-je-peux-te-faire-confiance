
# Est-ce que je peux te faire confiance ?

Une application web en français, pensée pour le téléphone et l'ordinateur. Un hôte prépare une partie et partage le même lien avec son groupe. Chaque invité répond séparément; seul l'organisateur voit les scores et les réponses détaillées, dès qu'un invité a terminé. Le classement privé s'enrichit ensuite à mesure que les amis finissent.

## Lancer l'application

Prérequis : Node.js 20 ou plus récent. Aucune dépendance externe n'est nécessaire.

```sh
npm start
```

Ouvre [http://localhost:4173](http://localhost:4173). En développement, `npm run dev` redémarre le serveur après une modification.

Les parties sont enregistrées dans `data/games.json`. Pour choisir un autre port ou fichier, définir `PORT` ou `DATA_FILE`.

## Parcours d'une partie

1. L'hôte choisit son nom. Il n'a pas besoin de prévoir combien d'amis participeront.
2. Il lance deux dés avant chacun de ses trois dilemmes. Le total de 2 à 12 sélectionne un scénario parmi les 110 textes du jeu; l'intensité augmente entre les tours.
3. Après les dilemmes, l'hôte choisit trois questions parmi une banque de 50 et fixe ses propres réponses parmi cinq propositions fixes, sans saisie libre. La question sur la boisson propose l'eau, la bière, le vin, le chocolat chaud ou « Aucune de ces réponses ». Il passe ces questions sur trois écrans distincts, puis voit chaque mise en situation sur son propre écran. Pour chacune, quatre réponses sont proposées : son premier clic marque la priorité; son deuxième clic, sur une réponse différente, marque l'alternative acceptée. Les deux autres réponses valent zéro. Il peut revenir en arrière avant de verrouiller sa préparation.
4. La préparation est verrouillée. Le même lien d'invitation peut être envoyé à autant d'amis que souhaité; le jeu n'impose pas de nombre maximal et personne n'a besoin de fermer les inscriptions.
5. Les invités répondent dans cet ordre : question personnelle, situation, dilemme, puis le même cycle deux fois; une quatrième situation termine la partie. Ils choisissent toujours parmi des boutons de réponse prédéfinis : les trois questions personnelles concernent A, et l'invité essaie de deviner ses réponses; dans chaque mise en situation, il choisit ce qu'il ferait pour A. Aucun champ de réponse libre n'est utilisé dans ces phases. Chacun fait face aux trois mêmes dilemmes et répond aux quatre mêmes situations. Le pseudo est mémorisé dans le navigateur; rouvrir le même lien sur cet appareil reprend la session de l'invité.
6. Dès qu'un invité finit, l'organisateur peut consulter son score, le classement et ses réponses détaillées. L'invité voit une confirmation, mais aucun classement ni résultat de groupe. Les autres invités ne voient ni ses choix ni son score. Le classement privé de l'organisateur s'actualise à mesure que d'autres personnes finissent.

Un invité qui ferme la page peut reprendre sa partie en rouvrant le lien sur le même navigateur. Le profil local retient son pseudo et son jeton de session; ce n'est pas un compte récupérable sur un autre appareil. Le lien d'invitation reste ouvert et ne montre aucune réponse.

## Scores

Chaque résultat d'ami est calculé sur 100 points :

- **Dilemmes : 30 points.** Pour chacune des trois paires de choix A/ami : PARTAGER/PARTAGER vaut 10 points; un choix de chaque type vaut 2,5; VOLER/VOLER vaut 0.
- **Questions personnelles : 30 points.** Chaque réponse qui correspond à la réponse de référence choisie par l'hôte vaut 10 points. Les cinq choix incluent « Aucune de ces réponses ».
- **Situations : 40 points.** La réponse idéale vaut 10; l'alternative acceptée vaut 5; chacune des deux autres réponses vaut 0.

Deux indicateurs complémentaires sont affichés pour chaque duo :

- **Coopération :** nombre de PARTAGER parmi les six décisions des deux joueurs, sur six.
- **Confiance dans cette partie :** moyenne des trois paires de dilemmes (100 % pour deux PARTAGER, 25 % pour des choix opposés, 0 % pour deux VOLER). Le message affiché est choisi parmi des formulations écrites pour les résultats possibles.

Ces nombres décrivent uniquement les choix effectués dans cette partie; ils ne sont pas des mesures scientifiques de la personnalité ou de la fiabilité. Partager ne garantit pas une victoire individuelle. Le Serpent du doute donne à tous les invités le même indice au sujet du choix de l'hôte sur un dilemme; il est vrai ou inversé au hasard et n'influence aucun score.

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

Un emplacement est prévu après le classement. La publicité reste désactivée tant que les champs `clientId` et `resultSlotId` dans `public/ad-config.js` sont vides. Après ouverture et validation d'un compte AdSense et du site, ajoute l'identifiant éditeur (`ca-pub-…`) et l'identifiant de l'unité publicitaire à cet endroit. Le jeu fonctionne en local sans ces identifiants; aucune annonce ne se charge dans cet état. L'indice du Serpent n'est pas encore lié à une annonce récompensée : il reste gratuit jusqu'à l'intégration d'un fournisseur compatible.

## Contenu

La banque actuelle comprend 110 dilemmes. Le fichier [120-dilemmes-a-evaluer.md](120-dilemmes-a-evaluer.md) est conservé pour la prochaine réécriture et l'évaluation par Claude; les textes pourront être remplacés ensuite sans changer les règles du jeu. Les choix éditoriaux et les références générales sont dans [SOURCES.md](SOURCES.md).

