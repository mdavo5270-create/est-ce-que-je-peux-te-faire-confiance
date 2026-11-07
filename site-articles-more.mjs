// Articles de fond, deuxième lot. Textes originaux, sans interpolation :
// chaque entrée de `sections` est un bloc HTML (la première est l'introduction).

export const moreArticles = [
  {
    slug: "comment-se-deroule-une-partie",
    title: "Comment se déroule une partie : le jeu expliqué étape par étape",
    description: "Préparation par l'organisateur, réponses des amis, calcul du score sur 100 et confidentialité des réponses : le fonctionnement complet du jeu, sans zone d'ombre.",
    readMinutes: 5,
    sections: [
      `<p class="lead">« Est-ce que je peux te faire confiance ? » se joue à plusieurs, mais pas en même temps : un organisateur prépare une partie, puis chaque ami la fait à son rythme depuis un lien. Cet article détaille chaque étape, le calcul du score et ce qui reste privé, pour que vous sachiez exactement à quoi vous attendre avant de lancer une partie.</p>`,
      `<h2>Étape 1 : l'organisateur prépare la partie</h2>
<p>Tout commence par une personne qui joue le rôle de référence. Elle répond d'abord à trois dilemmes : pour chacun, elle choisit entre partager et tout prendre. Elle sélectionne ensuite trois questions personnelles qui la concernent, par exemple sur ses goûts ou ses habitudes, et fixe les réponses qu'elle considère comme les bonnes.</p>
<p>Enfin, elle définit quatre situations. Pour chacune, elle indique une réponse prioritaire et une alternative acceptée. C'est cette préparation qui rend la partie personnelle : les amis ne jouent pas contre un système, mais contre l'idée qu'ils se font de la personne qui a préparé la partie.</p>`,
      `<h2>Étape 2 : les amis répondent chacun de leur côté</h2>
<p>L'organisateur partage un lien. Chaque invité reçoit les mêmes questions et y répond seul, sans voir ni les réponses de l'organisateur ni celles des autres invités. Il n'est pas nécessaire d'être connectés au même moment : chacun joue quand il veut, depuis son téléphone ou son ordinateur.</p>
<p>Ce fonctionnement en différé a un avantage : personne n'est influencé par les réactions des autres. Il évite aussi la pression d'une réponse donnée devant tout le monde, ce qui encourage des réponses plus spontanées.</p>`,
      `<h2>Étape 3 : les résultats</h2>
<p>À la fin de sa partie, l'invité voit son score personnel. L'organisateur, lui, voit le classement du groupe et peut ouvrir le détail des réponses de chaque partie. C'est le moment le plus riche : on découvre où les amis ont bien deviné, où ils se sont trompés, et parfois ce que ces écarts révèlent sur la façon dont on se perçoit les uns les autres.</p>`,
      `<h2>Comment le score est calculé</h2>
<p>Le score total est de 100 points, répartis en trois blocs. Les trois dilemmes valent 30 points au total : chacun rapporte jusqu'à 10 points selon les choix de partager ou de tout prendre des deux joueurs. Les trois questions personnelles valent aussi 30 points, à raison de 10 points par bonne réponse sur l'organisateur. Les quatre situations valent 40 points : la réponse prioritaire donne 10 points, l'alternative acceptée 5 points, et les deux autres réponses 0.</p>
<p>Le pourcentage de confiance affiché est, lui, une moyenne ludique calculée uniquement à partir des trois dilemmes. Ce n'est ni une évaluation scientifique ni un jugement sur une relation. Partager ne garantit d'ailleurs pas de gagner : le jeu est conçu pour que le meilleur choix dépende de la situation.</p>`,
      `<h2>Le Serpent du doute</h2>
<p>Pendant la partie, un personnage appelé le Serpent du doute commente la situation. C'est un simple indice de jeu : il est parfois juste et parfois trompeur, et il ne modifie aucun point. Son rôle est d'inviter à se poser la question du doute, ce qui fait partie du thème du jeu. Libre à vous de l'écouter ou de l'ignorer.</p>`,
      `<h2>Ce qui reste privé</h2>
<p>Les choix restent privés pendant la partie : les réponses d'un invité sont cachées aux autres invités. Seul l'organisateur consulte le classement et le détail du groupe, et chacun peut voir son propre bilan à la fin. Pour plus de détails sur les données, la <a href="/confidentialite">politique de confidentialité</a> décrit ce qui est conservé.</p>`,
      `<h2>Pour aller plus loin</h2>
<p>Avant de lancer une première partie, vous pouvez parcourir la <a href="/dilemmes">bibliothèque de dilemmes</a> pour vous faire une idée des situations, ou lire <a href="/articles/dilemme-du-prisonnier-explique">le dilemme du prisonnier expliqué</a>, qui éclaire la logique des choix entre partager et tout prendre. Et pour organiser la soirée, notre guide pour <a href="/articles/animer-une-soiree-dilemmes">animer une soirée dilemmes</a> donne un déroulé simple. Quand vous êtes prêts, <a href="/">créez une partie</a>.</p>`
    ]
  },
  {
    slug: "biais-qui-faussent-notre-jugement-sur-les-autres",
    title: "Ces biais qui faussent notre jugement sur les autres",
    description: "Effet de halo, premières impressions, biais de confirmation : pourquoi nous nous trompons sur les gens et comment garder un regard plus juste.",
    readMinutes: 5,
    sections: [
      `<p class="lead">Nous aimons croire que nous jugeons les autres avec discernement. En réalité, notre cerveau prend des raccourcis pour aller vite, et ces raccourcis nous trompent régulièrement. Connaître les principaux biais ne les supprime pas, mais cela aide à prendre un peu de recul avant de décider qui est fiable, qui ne l'est pas, et à quel point nous nous connaissons vraiment entre amis.</p>`,
      `<h2>Les premières impressions</h2>
<p>Nous nous faisons une opinion sur quelqu'un très vite : en quelques secondes, parfois à partir d'un visage ou d'une voix. Des travaux de psychologie sociale ont montré que des jugements sur des traits comme la compétence ou la fiabilité apparaissent après une exposition très brève. Le problème est que ces jugements rapides ne sont pas forcément fiables, alors qu'ils orientent la manière dont nous interprétons ensuite tout ce que fait la personne.</p>
<p>Un bon réflexe consiste à se rappeler qu'une première impression est une hypothèse, pas un fait. Donnez-vous l'occasion de la corriger.</p>`,
      `<h2>L'effet de halo</h2>
<p>L'effet de halo désigne notre tendance à étendre une qualité visible à d'autres domaines. Une personne sympathique nous semble aussi plus compétente et plus honnête ; une personne brusque nous semble moins fiable, même sans raison. Ce phénomène est décrit depuis le début du XXe siècle par le psychologue Edward Thorndike, et il reste l'un des biais les plus étudiés.</p>
<p>Dans un groupe d'amis, il peut jouer à l'envers : celui qui a toujours été « le fiable » se voit pardonner beaucoup, tandis qu'un ami une fois déçu garde longtemps une étiquette. Se demander « est-ce que je juge ce fait précis ou l'image que j'ai de cette personne ? » aide à y voir plus clair.</p>`,
      `<h2>Le biais de similarité</h2>
<p>Nous faisons plus facilement confiance aux gens qui nous ressemblent : même milieu, mêmes goûts, mêmes opinions. C'est confortable, mais cela peut nous faire négliger des personnes dignes de confiance qui sont simplement différentes de nous, et nous faire surestimer celles qui nous ressemblent. Remarquer cette préférence est déjà une façon de la tempérer.</p>`,
      `<h2>Le biais de confirmation</h2>
<p>Une fois une opinion formée, nous remarquons surtout les éléments qui la confirment et minimisons les autres. Si vous pensez qu'un ami est toujours en retard, vous retiendrez chaque retard et oublierez les fois où il était à l'heure. L'opinion se renforce ainsi sans que les faits aient réellement changé.</p>
<p>Une astuce simple : cherchez activement un contre-exemple. Quand avez-vous vu cette personne agir à l'inverse de ce que vous croyez ?</p>`,
      `<h2>L'erreur fondamentale d'attribution</h2>
<p>Quand quelqu'un nous déçoit, nous avons tendance à expliquer son comportement par son caractère (« il est égoïste »), alors que pour nous-mêmes, nous invoquons plutôt les circonstances (« j'étais débordé »). Cette asymétrie, décrite par le psychologue Lee Ross dans les années 1970, rend nos jugements sur les autres plus sévères que ceux que nous portons sur nous.</p>
<p>Avant de conclure à un défaut de caractère, demandez-vous quelles circonstances ont pu jouer, comme vous le feriez pour vous.</p>`,
      `<h2>Ce que cela change pour un jeu entre amis</h2>
<p>Dans notre jeu, vous devinez les réponses d'un ami ou la manière dont il choisit. C'est une occasion de mesurer, avec le sourire, l'écart entre l'image que vous avez de lui et ce qu'il répond réellement. Un écart n'est pas un échec : c'est une surprise, et souvent le début d'une bonne conversation. Pour tenter l'expérience, <a href="/">lancez une partie</a>.</p>
<p>Pour approfondir les mécanismes de la coopération, lisez aussi <a href="/articles/jeu-de-la-confiance-economistes">le jeu de la confiance des économistes</a> et <a href="/articles/construire-confiance-groupe-amis">cinq habitudes pour construire la confiance</a>.</p>`
    ]
  },
  {
    slug: "faut-il-toujours-dire-la-verite-a-ses-amis",
    title: "Faut-il toujours dire la vérité à ses amis ?",
    description: "Franchise, tact et petits mensonges : comment concilier honnêteté et bienveillance dans une amitié, avec des critères simples pour décider quoi dire.",
    readMinutes: 5,
    sections: [
      `<p class="lead">Votre ami vous montre son projet, sa coupe de cheveux ou son nouveau compagnon, et vous avez des réserves. Dire la vérité, au risque de blesser, ou ménager l'autre, au risque de ne pas être tout à fait honnête ? Cette question traverse toutes les amitiés. Il n'existe pas de réponse unique, mais quelques critères aident à décider avec justesse.</p>`,
      `<h2>Pourquoi on ment (un peu) à ceux qu'on aime</h2>
<p>Les « petits mensonges » de politesse sont très répandus : dire qu'on a aimé un repas moyen, qu'on arrive bientôt alors qu'on est encore chez soi. Ils ont une fonction sociale : adoucir les échanges et éviter des blessures inutiles. Le problème apparaît quand ces petits arrangements s'accumulent et que l'autre ne peut plus s'appuyer sur nos paroles quand il en a vraiment besoin.</p>`,
      `<h2>Trois questions à se poser avant de parler</h2>
<p>La première : <strong>est-ce utile ?</strong> Une remarque sur un détail qui ne changera rien, ou sur quelque chose d'irréversible, a peu de chances d'aider. Une information qui permet à l'autre d'éviter une erreur ou de mieux décider, en revanche, vaut presque toujours d'être dite.</p>
<p>La deuxième : <strong>est-ce le bon moment ?</strong> Un avis donné à chaud, devant du monde ou juste avant un événement important, passe mal. Attendre un moment calme change la manière dont il sera reçu.</p>
<p>La troisième : <strong>qu'est-ce que je cherche ?</strong> Aider l'autre, ou me soulager, ou avoir raison ? Si l'honnêteté sert surtout notre besoin d'exprimer une critique, elle risque de blesser sans aider.</p>`,
      `<h2>Comment dire les choses difficiles</h2>
<p>La forme compte autant que le fond. Décrivez ce que vous avez observé plutôt que de juger la personne : « J'ai trouvé la fin du projet moins claire » est plus audible que « Ton projet est mal fait ». Parlez en votre nom (« j'ai ressenti », « je me suis demandé ») plutôt que de généraliser. Et ajoutez, quand c'est sincère, ce qui vous paraît réussi : une critique équilibrée est plus crédible.</p>
<p>Enfin, laissez de la place à la réponse. Vous partagez un point de vue, pas un verdict : l'autre peut avoir des raisons que vous ignorez.</p>`,
      `<h2>Quand se taire est légitime</h2>
<p>Dire toute la vérité n'est pas une obligation. On peut choisir de ne pas commenter un sujet intime, de ne pas rapporter une rumeur, de ne pas relever une maladresse sans conséquence. La différence se situe entre se taire par respect et mentir activement pour tromper. Le premier laisse l'autre libre de demander ; le second lui enlève cette liberté.</p>
<p>Il existe aussi des cas où se taire est difficile à défendre : quand l'autre risque un vrai préjudice et que vous savez quelque chose qui pourrait l'éviter. Là, le silence a un coût, et il vaut mieux prendre le risque de la maladresse.</p>`,
      `<h2>Un dilemme pour en discuter</h2>
<p>Voici une situation à discuter entre amis : vous apprenez qu'un proche a été trompé sur un point qui compte pour lui, mais l'information vous vient d'une personne qui vous a demandé le secret. Parlez-vous ? À qui devez-vous le plus de loyauté ? Les réponses divergent beaucoup d'une personne à l'autre, ce qui en fait un bon sujet de conversation.</p>
<p>Si vous aimez ce genre de questions, nos <a href="/dilemmes">dilemmes à deux</a> mettent en scène des choix du même ordre, et l'article sur <a href="/articles/dilemmes-moraux-celebres">les dilemmes moraux célèbres</a> en propose cinq classiques.</p>`,
      `<h2>À retenir</h2>
<p>La franchise et la gentillesse ne s'opposent pas : bien dosées, elles se renforcent. Une amitié solide est celle où l'on sait que l'autre dira les choses importantes, avec tact, et où l'on peut en faire autant sans craindre de tout casser. Pour réfléchir aux situations où la confiance se rompt puis se répare, lisez aussi <a href="/articles/reparer-la-confiance-apres-une-deception">réparer la confiance après une déception</a>.</p>`
    ]
  },
  {
    slug: "tragedie-des-biens-communs-et-cooperation",
    title: "La tragédie des biens communs : pourquoi on coopère (ou pas) pour les ressources partagées",
    description: "De l'article de Garrett Hardin aux travaux d'Elinor Ostrom : pourquoi des ressources partagées s'épuisent parfois, et comment des groupes réussissent à les préserver.",
    readMinutes: 5,
    sections: [
      `<p class="lead">Un pré commun, un lac poissonneux, une cuisine partagée en colocation : quand une ressource appartient à tous, chacun a intérêt à en profiter, et personne n'a vraiment intérêt à la préserver. C'est ce que l'on appelle la « tragédie des biens communs ». Heureusement, l'histoire de cette idée ne s'arrête pas au pessimisme : des chercheurs ont montré que les groupes savent aussi s'organiser.</p>`,
      `<h2>L'idée de départ</h2>
<p>L'expression a été popularisée en 1968 par l'écologue Garrett Hardin, dans un article publié dans la revue Science. Il imagine un pâturage ouvert à tous les éleveurs. Chacun gagne à y ajouter une bête de plus, car il en tire tout le bénéfice, alors que le coût du surpâturage est partagé par tous. Résultat : le pré s'épuise, au détriment de chacun.</p>
<p>Le raisonnement est proche de celui du dilemme du prisonnier : ce qui est rationnel pour chacun, pris isolément, est mauvais pour le groupe. Notre article sur <a href="/articles/dilemme-du-prisonnier-explique">le dilemme du prisonnier</a> détaille ce mécanisme dans sa version la plus simple.</p>`,
      `<h2>Un exemple du quotidien</h2>
<p>Pas besoin d'éleveurs pour le voir. Dans une colocation, la vaisselle laissée dans l'évier illustre exactement ce schéma : chacun économise quelques minutes en la laissant, et tous subissent une cuisine en désordre. Au travail, le café finit, personne n'en rachète, et la machine reste vide. La ressource commune est maltraitée parce que le coût individuel d'un petit geste semble plus élevé que son bénéfice perçu.</p>`,
      `<h2>Le jeu du bien public</h2>
<p>Les économistes ont étudié ce problème avec un jeu simple : chaque joueur reçoit une somme et décide d'en verser une partie dans une cagnotte commune. L'organisateur multiplie ensuite la cagnotte et la redistribue à parts égales. Le groupe gagne le plus quand tout le monde donne beaucoup, mais chacun a individuellement intérêt à ne rien verser et à profiter de la cagnotte des autres.</p>
<p>Dans les expériences, les contributions sont souvent importantes au début, puis elles baissent au fil des tours quand certains constatent que d'autres profitent du système. Elles remontent généralement quand les joueurs peuvent communiquer ou sanctionner ceux qui ne participent pas.</p>`,
      `<h2>Ce qu'a montré Elinor Ostrom</h2>
<p>L'économiste américaine Elinor Ostrom a étudié des communautés qui gèrent depuis longtemps des ressources partagées, comme des pâturages de montagne, des forêts ou des systèmes d'irrigation. Elle a constaté que la tragédie n'a rien d'inévitable : de nombreux groupes parviennent à préserver leur ressource sans la confier ni à l'État ni au marché. Ces travaux lui ont valu le prix Nobel d'économie en 2009.</p>
<p>Elle a identifié des conditions qui reviennent souvent : des limites claires de la ressource et du groupe qui l'utilise, des règles adaptées au contexte local, la participation de ceux qui sont concernés à l'élaboration des règles, une surveillance exercée par les membres eux-mêmes, des sanctions graduelles plutôt que brutales, et des moyens simples de régler les conflits.</p>`,
      `<h2>Ce que cela inspire pour un groupe d'amis</h2>
<p>Le point commun de ces conditions est la communication et la transparence. Pour un groupe d'amis ou une colocation, cela se traduit simplement : se mettre d'accord sur quelques règles claires, en discuter ensemble plutôt que de les imposer, rendre visible ce que chacun apporte, et réagir sans agressivité quand quelqu'un oublie sa part. La confiance, ici, ne se base pas sur la naïveté mais sur des repères partagés.</p>`,
      `<h2>Et dans notre jeu ?</h2>
<p>Les dilemmes proposés sur ce site mettent deux personnes face à une ressource qu'elles ne peuvent pas partager sans renoncer à quelque chose. Ils reprennent donc, à petite échelle, la tension entre intérêt individuel et intérêt commun. Pour voir comment votre groupe réagit, parcourez la <a href="/dilemmes">bibliothèque de dilemmes</a> ou <a href="/">lancez une partie</a>. Pour comprendre comment une stratégie de coopération peut s'installer dans la durée, lisez <a href="/articles/donnant-donnant-strategie-cooperation">donnant-donnant</a>.</p>`
    ]
  },
  {
    slug: "jeux-de-confiance-en-equipe-au-travail",
    title: "Jeux de confiance en équipe : ce qui fonctionne (et ce qu'il vaut mieux éviter)",
    description: "Comment utiliser un jeu pour renforcer la cohésion d'une équipe de travail, avec des conditions simples pour que l'exercice reste volontaire, respectueux et utile.",
    readMinutes: 5,
    sections: [
      `<p class="lead">Les activités de cohésion d'équipe ont mauvaise réputation : exercices forcés, mises en scène gênantes, bonne humeur obligatoire. Pourtant, un jeu bien choisi peut aider des collègues à mieux se connaître, à parler d'autre chose que des dossiers et à désamorcer des tensions. Tout dépend de la manière dont on l'utilise. Voici des repères concrets, et une honnêteté nécessaire : aucun jeu ne transforme à lui seul une équipe.</p>`,
      `<h2>Ce qu'un jeu peut apporter</h2>
<p>Un jeu offre un cadre où l'on peut se parler autrement. Les rôles habituels s'estompent pendant quelques minutes, on rit ensemble, on découvre des goûts ou des manières de décider que le travail quotidien ne révèle pas. Ces moments créent des repères communs, qui servent ensuite dans les échanges plus sérieux. À l'inverse, il n'existe pas de preuve solide qu'un seul exercice change durablement le climat d'une équipe : les effets viennent de la répétition et du contexte global.</p>`,
      `<h2>Les conditions pour que cela se passe bien</h2>
<p>La première condition est le <strong>volontariat</strong> : personne ne doit se sentir obligé de participer ou de répondre. Prévoir une façon simple de passer son tour évite le malaise.</p>
<p>La deuxième est la <strong>confidentialité</strong> : ce qui se dit pendant le jeu reste dans le jeu. Rien ne doit remonter à la hiérarchie ni servir à évaluer quelqu'un. Annoncez-le clairement au début.</p>
<p>La troisième est le <strong>choix du niveau</strong> : en équipe, on reste sur des sujets légers ou neutres. Les situations très intimes ou conflictuelles n'ont pas leur place devant des collègues, surtout s'il y a un lien hiérarchique.</p>`,
      `<h2>Quels formats choisir</h2>
<p>Les formats courts et peu engageants marchent le mieux : une question légère au début d'une réunion, un jeu de devinettes de dix minutes avant le déjeuner, un défi d'équipe de quinze minutes lors d'un séminaire. Les dilemmes de niveau léger, où chacun explique son raisonnement, fonctionnent bien, à condition de choisir des situations qui ne touchent à rien de sensible. Dans notre bibliothèque, les <a href="/dilemmes">premiers niveaux</a> sont les plus adaptés à un contexte professionnel.</p>`,
      `<h2>Ce qu'il vaut mieux éviter</h2>
<p>Évitez de transformer un jeu en test : classer des collègues selon leur « score de confiance » serait absurde et potentiellement nocif. Le résultat d'un jeu décrit des choix dans une situation fictive, pas la fiabilité d'une personne. Évitez aussi de noter, de comparer publiquement ou de ressortir les réponses plus tard dans une discussion de travail. Enfin, n'imposez pas le jeu à ceux qui n'en ont pas envie : l'exercice ne devient utile que s'il est choisi.</p>`,
      `<h2>Animer en pratique</h2>
<p>Choisissez un animateur à l'aise avec le groupe, annoncez la durée à l'avance et rappelez les règles : on peut passer, on ne juge pas, on ne rapporte rien. Après le jeu, prévoyez deux minutes pour que chacun dise ce qu'il a trouvé drôle ou surprenant. Si le groupe est large, formez des petits groupes de quatre à six personnes : on s'y exprime plus facilement. Notre guide pour <a href="/articles/animer-une-soiree-dilemmes">animer une soirée dilemmes</a> contient des conseils de rythme qui s'appliquent aussi à une équipe.</p>`,
      `<h2>Pour prolonger</h2>
<p>Si vous cherchez d'autres idées de jeux sans matériel, <a href="/articles/jeux-de-confiance-entre-amis">six jeux de confiance entre amis</a> vous donneront des pistes, et <a href="/articles/construire-confiance-groupe-amis">cinq habitudes pour construire la confiance</a> rappellent que les gestes quotidiens comptent plus que n'importe quel jeu. Pour essayer vous-même, <a href="/">créez une partie</a>.</p>`
    ]
  }
];
