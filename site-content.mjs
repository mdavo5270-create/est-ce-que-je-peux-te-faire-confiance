// Contenu éditorial du site : FAQ de l'accueil et articles de fond.
// Textes originaux, sans interpolation : chaque entrée de `sections` est un bloc HTML.

export const homeFaq = [
  {
    q: "Comment se déroule une partie ?",
    a: "L'organisateur répond à trois dilemmes, choisit trois questions personnelles qui le concernent et prépare quatre situations. Il partage ensuite un lien : chaque ami répond de son côté, découvre son propre score sur 100, et l'organisateur voit le classement du groupe."
  },
  {
    q: "Combien d'amis peuvent jouer ?",
    a: "Le jeu ne fixe aucune limite : le même lien peut être envoyé à autant d'amis que tu le souhaites. La capacité réelle dépend seulement des ressources du serveur qui héberge le jeu."
  },
  {
    q: "Faut-il créer un compte ?",
    a: "Non. Un simple pseudo suffit. Il est mémorisé dans ton navigateur pour que tu puisses reprendre ta partie si tu fermes la page, mais il ne s'agit pas d'un compte récupérable sur un autre appareil."
  },
  {
    q: "Les autres invités voient-ils mes réponses ?",
    a: "Non. Chaque invité ne voit que son propre bilan. Seul l'organisateur consulte le classement et le détail des réponses, une fois que les amis ont terminé."
  },
  {
    q: "Le score mesure-t-il vraiment la confiance ?",
    a: "Non, et c'est important : c'est un jeu. Le score décrit les choix faits dans une partie précise, pas la personnalité ni la fiabilité d'une personne dans la vie réelle."
  },
  {
    q: "Le jeu est-il gratuit ?",
    a: "Oui. Le site peut afficher des annonces sur ses pages d'information et sur l'écran de résultats, jamais pendant les choix. Elles servent à couvrir les frais d'hébergement."
  }
];

export const articles = [
  {
    slug: "jeux-de-confiance-entre-amis",
    title: "6 jeux de confiance à faire entre amis, sans matériel",
    description: "Six jeux simples pour tester la complicité d'un groupe : dilemmes, devinettes, points de rencontre et pot commun. Aucune préparation, aucun matériel.",
    readMinutes: 5,
    sections: [
      `<p class="lead">Se faire confiance, ce n'est pas seulement un sentiment : c'est aussi une série de petites décisions. Qui garde un secret ? Qui tient sa promesse ? Qui partage quand il pourrait tout garder ? Les jeux ci-dessous transforment ces questions en moments de jeu, entre amis, en couple ou en famille. Ils ne demandent ni matériel ni préparation, seulement un groupe et quelques minutes.</p>
<p>Un conseil avant de commencer : aucun de ces jeux ne mesure la fiabilité réelle de quelqu'un. Ils révèlent des réflexes, des façons de décider et de se comprendre. C'est précisément ce qui les rend drôles, et parfois surprenants.</p>`,
      `<h2>1. Partager ou voler</h2>
<p>Deux joueurs font face à une ressource que l'on ne peut pas diviser sans renoncer à une partie de ce qu'on voudrait. Chacun choisit en secret : partager ou tout prendre. Si les deux partagent, chacun obtient une aide correcte. Si un seul prend tout, il gagne davantage, mais fait perdre l'autre. Si les deux prennent tout, tout le monde perd. C'est la version ludique d'un cas célèbre de la théorie des jeux, que nous détaillons dans <a href="/articles/dilemme-du-prisonnier-explique">notre article sur le dilemme du prisonnier</a>.</p>
<p>Vous pouvez inventer vos propres situations, ou piocher dans nos <a href="/dilemmes">dilemmes à deux</a>, classés par niveau d'intensité.</p>`,
      `<h2>2. Deux vérités, un mensonge</h2>
<p>Chaque joueur énonce trois affirmations sur lui-même : deux sont vraies, une est fausse. Les autres doivent deviner laquelle. Le jeu paraît anodin, mais il apprend vite à repérer les petits signaux : un sourire en retard, une précision de trop, une hésitation. Pour les groupes qui se connaissent bien, essayez des affirmations de plus en plus improbables, car ce sont les vérités étranges qui déstabilisent le plus.</p>`,
      `<h2>3. Qui me connaît le mieux ?</h2>
<p>Une personne répond en secret à dix questions sur elle-même : sa boisson préférée, sa plus grande peur en voyage, ce qu'elle ferait avec un jour de congé imprévu. Les autres notent leurs réponses de leur côté, puis on compare. Chaque bonne réponse rapporte un point. Ce jeu fait ressortir qui écoute vraiment, et il donne souvent lieu à de belles surprises : on croit connaître ses amis, jusqu'à ce qu'on perde face à un collègue.</p>
<p>C'est aussi le principe des questions personnelles de notre jeu <a href="/">« Est-ce que je peux te faire confiance ? »</a>, où l'organisateur fixe ses réponses et chaque ami essaie de les deviner.</p>`,
      `<h2>4. Le point de rencontre</h2>
<p>Voici une expérience popularisée par l'économiste Thomas Schelling dans son livre <em>The Strategy of Conflict</em>, publié en 1960. Deux personnes doivent se retrouver dans une grande ville, sans pouvoir se parler, sans savoir où l'autre va. Chacune note en secret le lieu et l'heure qu'elle choisit. Si les deux réponses sont identiques, c'est gagné.</p>
<p>La plupart des gens convergent vers un lieu évident, un « point focal » : la gare principale, un monument célèbre, midi. Essayez avec votre ville. Vous verrez à quel point deux personnes qui se font confiance peuvent s'accorder sans un mot, et à quel point elles se trompent quand elles réfléchissent trop.</p>`,
      `<h2>5. Le pot commun</h2>
<p>Chaque joueur reçoit dix jetons (des pièces, des allumettes, des bonbons). En secret, il décide combien il met dans un pot commun et combien il garde. On double le contenu du pot, puis on le répartit à parts égales entre tous les joueurs. Si tout le monde joue le jeu, tout le monde double sa mise. Mais celui qui garde ses jetons tout en profitant du pot des autres finit gagnant, au détriment du groupe.</p>
<p>Les économistes appellent ce mécanisme le jeu du bien public. Il illustre très bien pourquoi la confiance est précieuse : plus on croit que les autres contribuent, plus on a envie de contribuer soi-même. Jouez plusieurs manches, vous verrez la dynamique du groupe évoluer.</p>`,
      `<h2>6. La promesse tenue</h2>
<p>Un jeu plus lent, qui s'étale sur une semaine. Chaque participant fait une petite promesse à un autre : appeler un jour précis, apporter quelque chose, écrire un message. À la fin de la semaine, on fait le bilan. Qui a tenu parole ? Qui a oublié ? Et surtout, comment s'est-on senti quand on a été prévenu d'un empêchement, par rapport à un oubli silencieux ?</p>
<p>La confiance se construit rarement sur de grandes déclarations. Elle se construit sur des promesses modestes, tenues ou honnêtement reportées.</p>`,
      `<h2>Pour bien jouer</h2>
<p>Quelques règles simples rendent ces jeux plus agréables. Annoncez dès le départ que personne n'est jugé sur ses choix. Évitez de rejouer une manche pour « se racheter ». Laissez chacun expliquer sa décision une fois le résultat révélé, c'est là que se trouvent les meilleures conversations. Et si l'ambiance devient tendue, changez de jeu.</p>
<p>Envie d'essayer tout de suite ? <a href="/">Créez une partie</a>, envoyez le lien à vos amis et découvrez qui partage, qui hésite et qui vous connaît le mieux. Pour animer toute une soirée, notre guide <a href="/articles/animer-une-soiree-dilemmes">pour animer une soirée dilemmes</a> vous donne la marche à suivre.</p>`
    ]
  },
  {
    slug: "dilemme-du-prisonnier-explique",
    title: "Le dilemme du prisonnier expliqué simplement",
    description: "Pourquoi deux personnes raisonnables peuvent-elles choisir de se trahir alors que coopérer les arrangerait ? Explication claire, exemples et stratégie gagnante.",
    readMinutes: 6,
    sections: [
      `<p class="lead">Deux personnes ont intérêt à coopérer, mais chacune est tentée de trahir l'autre. Quand les deux cèdent à la tentation, elles finissent toutes les deux moins bien loties que si elles s'étaient fait confiance. C'est le dilemme du prisonnier, l'un des cas d'école les plus célèbres de la théorie des jeux. Voici comment il fonctionne, d'où il vient et ce qu'il nous apprend sur la confiance.</p>`,
      `<h2>L'histoire classique</h2>
<p>Deux suspects sont arrêtés et interrogés dans des pièces séparées, sans pouvoir communiquer. Chacun a le choix entre se taire et dénoncer l'autre. Voici un exemple de conséquences, avec des durées de peine :</p>
<ul>
<li>Si les deux se taisent, ils font chacun un an de prison.</li>
<li>Si l'un dénonce et que l'autre se tait, le dénonciateur est libéré et l'autre fait trois ans.</li>
<li>Si les deux se dénoncent, ils font chacun deux ans.</li>
</ul>
<p>Individuellement, dénoncer semble toujours plus avantageux : quoi que fasse l'autre, on s'en sort mieux en le dénonçant. Pourtant, quand les deux raisonnent ainsi, ils obtiennent deux ans chacun, alors qu'un silence mutuel leur aurait coûté un an seulement. La logique individuelle mène à un résultat collectif décevant.</p>`,
      `<h2>D'où vient ce dilemme ?</h2>
<p>La structure du jeu a été décrite en 1950 par les mathématiciens Merrill Flood et Melvin Dresher, alors chercheurs à la RAND Corporation. Le mathématicien Albert Tucker lui a donné la même année son habillage d'histoire de prisonniers, pour l'expliquer à un public de psychologues. Depuis, le dilemme sert de modèle dans des domaines très variés : économie, biologie, politique, environnement.</p>
<p>On le retrouve par exemple dans les guerres de prix entre entreprises concurrentes, dans les négociations sur le climat, ou dans les décisions de groupe où chacun préfère laisser les autres faire l'effort.</p>`,
      `<h2>Et si l'on joue plusieurs fois ?</h2>
<p>Tout change quand les mêmes personnes se retrouvent manche après manche. Trahir aujourd'hui peut coûter cher demain, car l'autre s'en souviendra. La confiance devient alors une stratégie rentable.</p>
<p>C'est ce qu'a montré le politologue Robert Axelrod au début des années 1980, en organisant des tournois où des programmes informatiques s'affrontaient dans des dilemmes répétés. Le vainqueur était étonnamment simple : « donnant donnant » (en anglais <em>tit for tat</em>), proposé par le psychologue et mathématicien Anatol Rapoport. Sa règle tient en deux lignes : coopérer au premier tour, puis refaire ce que l'autre a fait au tour précédent.</p>`,
      `<h2>Pourquoi cette stratégie fonctionne</h2>
<p>Axelrod en a tiré quelques qualités qui se transposent assez bien à la vie réelle :</p>
<ul>
<li><strong>Être bienveillant :</strong> ne jamais trahir le premier.</li>
<li><strong>Savoir réagir :</strong> répondre à une trahison, pour ne pas se laisser exploiter.</li>
<li><strong>Savoir pardonner :</strong> revenir à la coopération dès que l'autre le fait.</li>
<li><strong>Rester lisible :</strong> avoir une conduite assez claire pour que l'autre la comprenne.</li>
</ul>
<p>Ces enseignements ne font pas de la confiance une recette magique. Ils rappellent seulement que, sur la durée, coopérer sans naïveté est souvent plus payant que trahir.</p>`,
      `<h2>Le lien avec notre jeu</h2>
<p>Dans <a href="/">« Est-ce que je peux te faire confiance ? »</a>, chaque dilemme reprend cette tension sous une forme simplifiée : PARTAGER correspond à coopérer, VOLER à trahir. Si les deux joueurs partagent, le dilemme rapporte 10 points. Si un seul prend tout, il n'en rapporte que 2,5, et si les deux volent, il n'en rapporte aucun. Ce barème est une adaptation ludique, pas une reproduction exacte du dilemme classique, puisqu'il récompense avant tout la coopération.</p>
<p>Vous pouvez lire chaque situation et décider de votre côté dans <a href="/dilemmes">notre bibliothèque de dilemmes</a>. Rappelons que le résultat d'une partie décrit un moment de jeu, pas votre fiabilité réelle.</p>`,
      `<h2>À retenir</h2>
<p>Le dilemme du prisonnier montre que la confiance n'est pas une naïveté : c'est un pari raisonnable, surtout quand on se reverra. Il explique aussi pourquoi des personnes de bonne volonté peuvent se retrouver dans une impasse, simplement parce qu'elles redoutent la trahison de l'autre. Parler, s'engager et se montrer fiable dans la durée restent les meilleurs moyens d'en sortir.</p>`
    ]
  },
  {
    slug: "animer-une-soiree-dilemmes",
    title: "Comment animer une soirée dilemmes sans froisser personne",
    description: "Règles, durée, choix des thèmes, gestion des tensions : le guide pratique pour organiser une soirée de dilemmes moraux agréable pour tout le monde.",
    readMinutes: 5,
    sections: [
      `<p class="lead">Les dilemmes font parler. Ils révèlent des valeurs, provoquent des fous rires et parfois des désaccords vifs. Bien préparée, une soirée dilemmes devient un moment de complicité mémorable. Mal cadrée, elle peut tourner à l'interrogatoire. Voici comment l'organiser pour que chacun s'y sente bien.</p>`,
      `<h2>1. Posez le cadre dès le début</h2>
<p>Avant la première question, annoncez deux règles. D'abord, personne n'est jugé sur son choix : il s'agit de jouer, pas de prouver quoi que ce soit. Ensuite, chacun peut passer son tour s'il ne se sent pas à l'aise. Ces deux phrases suffisent à désamorcer la plupart des tensions.</p>`,
      `<h2>2. Montez en intensité progressivement</h2>
<p>Commencez par des situations légères, puis augmentez peu à peu l'enjeu. Notre <a href="/dilemmes">bibliothèque de dilemmes</a> est classée en cinq niveaux, de « sensible » à « critique ». Ouvrez avec un niveau 1 ou 2, qui lance la conversation sans mettre personne mal à l'aise, et gardez les niveaux 4 et 5 pour la fin de soirée, quand le groupe est chaleureux et détendu.</p>`,
      `<h2>3. Fixez une durée raisonnable</h2>
<p>Une soirée de dilemmes tient bien en une heure à une heure et demie. Au-delà, la fatigue émotionnelle s'installe. Prévoyez quatre à six situations, avec le temps de discuter chaque issue. Mieux vaut s'arrêter alors que tout le monde en redemande que traîner jusqu'à l'épuisement.</p>`,
      `<h2>4. Laissez chacun s'expliquer</h2>
<p>Le choix lui-même compte moins que ce qui le motive. Après chaque situation, invitez les joueurs à dire pourquoi ils ont partagé ou tout pris, mais seulement s'ils en ont envie. Posez des questions ouvertes : « Qu'est-ce qui t'a fait hésiter ? », « Qu'aurais-tu changé si tu avais eu plus de temps ? ». Évitez les « Comment as-tu pu ? », qui ferment la discussion.</p>`,
      `<h2>5. Gérez les tensions avec humour</h2>
<p>Quelqu'un a choisi de tout prendre alors que tout le monde partageait ? Transformez la surprise en moment de jeu plutôt qu'en reproche. Rappelez que la partie est fictive, que les situations sont volontairement extrêmes, et que le résultat ne dit rien de la vraie vie. Si un sujet touche réellement quelqu'un, changez de situation sans insister.</p>`,
      `<h2>6. Choisissez le bon format</h2>
<p>En petit groupe de trois ou quatre, la discussion à voix haute fonctionne très bien. Dès que vous êtes plus nombreux, ou si certains sont plus timides, laissez chacun répondre en privé, puis révélez les résultats. C'est exactement ce que permet notre jeu : l'organisateur prépare la partie, partage un lien, et chaque ami répond de son côté depuis son téléphone, sans voir les réponses des autres.</p>
<p>Pour lancer une partie maintenant, rendez-vous sur <a href="/">la page du jeu</a>. Pour d'autres idées d'activités, consultez nos <a href="/articles/jeux-de-confiance-entre-amis">six jeux de confiance à faire entre amis</a>.</p>`,
      `<h2>Le mot de la fin</h2>
<p>Une bonne soirée dilemmes laisse chacun avec un sourire, une anecdote et le sentiment de mieux connaître les autres. Si c'est le cas, c'est réussi, quels que soient les scores.</p>`
    ]
  }
];

export const articleBySlug = new Map(articles.map((item) => [item.slug, item]));
