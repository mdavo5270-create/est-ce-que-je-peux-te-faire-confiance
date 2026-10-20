import { extraScenarios } from "./scenario-expansion.mjs";

const scenario = ({ id, rollTotals, severity, title, problem, resource, doubt, shared, conflict }) => ({
  id,
  rollTotals,
  severity,
  title,
  problem,
  resource,
  doubt,
  outcomes: {
    bothShare: shared,
    youSteal: "Tu prends l'accès complet. Ton proche reçoit l'aide la plus complète possible; l'autre joueur perd cet accès.",
    otherSteals: "L'autre garde l'accès complet. Son proche reçoit l'aide la plus complète possible; le tien reste sans ce soutien.",
    bothSteal: conflict
  }
});

export const scenarios = [
  scenario({
    id: "dossier-noe", rollTotals: [2], severity: 1, title: "La place de Noé",
    problem: "Ton petit frère a enfin obtenu une place dans une formation qui pourrait changer son avenir. Il lui manque l'équipement adapté pour confirmer son entrée avant ce soir. Il a déjà imaginé la suite; tu l'as entendu en parler comme si elle était à portée de main.\n\nEn face de toi, l'autre joueur attend lui aussi une réponse qui pourrait tout changer pour un proche. Vous avez peu de temps pour vous expliquer. Tu sais seulement que cette occasion compte autant pour lui que pour toi.",
    resource: "Dans la mallette, un ordinateur déjà configuré et une personne prête à aider. Une personne peut s'en servir pour finaliser entièrement son dossier; à deux, vous devrez vous partager le temps et l'accompagnement.",
    doubt: "Tu te dis qu'il partagera peut-être. Puis tu te demandes s'il attend simplement que tu le croies. Si tu hésites, il peut tendre la main avant toi. Si tu te précipites, tu peux lui retirer sa seule chance. Pendant ce temps, l'heure limite approche et Noé ne sait toujours pas si tu pourras l'aider.",
    shared: "Vous partagez l'ordinateur et l'accompagnement. Les deux dossiers avancent, mais aucun n'est garanti d'être terminé avant l'heure limite.",
    conflict: "Vous vous disputez l'ordinateur; il tombe et ne démarre plus. Aucun dossier ne peut être finalisé à temps."
  }),
  scenario({
    id: "cle-du-calme", rollTotals: [3], severity: 1, title: "La clé du calme",
    problem: "Depuis des semaines, tu aides un proche à tenir dans un logement bruyant et instable. Il dort mal. Tu le vois s'épuiser à faire comme si tout allait bien. Une courte période au calme pourrait lui permettre de reprendre pied.\n\nL'autre joueur a lui aussi quelqu'un à mettre à l'abri du bruit et de l'agitation. La clé est posée entre vous. Aucun de vous ne peut vérifier ce qui attend l'autre personne cette nuit.",
    resource: "La mallette contient la clé d'un studio sûr, disponible dès ce soir. Un foyer peut y rester toute la période; en partageant, vous devrez organiser des séjours plus courts pour chacun.",
    doubt: "Tu penses à la promesse de partager, si elle a été faite. Mais une promesse tient-elle quand la porte est juste là et que ton proche attend? Peut-être que l'autre prend déjà sa décision. Peut-être qu'il lit ton hésitation comme une invitation. Tu ne sais pas combien de temps cette place restera disponible.",
    shared: "Vous organisez des séjours plus courts dans le studio. Vos deux proches trouvent un peu de calme, sans savoir si ce sera assez long pour tout arranger.",
    conflict: "La dispute alerte la personne qui gère le studio; elle reprend la clé et annule les deux séjours."
  }),
  scenario({
    id: "portfolio", rollTotals: [4], severity: 1, title: "Deux jours pour convaincre",
    problem: "Tu as deux jours pour terminer un portfolio qui pourrait t'ouvrir une première porte professionnelle. Tu as préparé ce moment pendant des mois. Sans aide, tu risques de présenter un travail inachevé et de perdre une occasion que tu ne sais pas quand tu retrouveras.\n\nL'autre joueur a lui aussi une échéance pour quelqu'un qui compte sur lui. Vous regardez la même ressource, mais aucun de vous ne sait à quel point l'autre est prêt à la garder.",
    resource: "Dans la mallette, un poste de travail complet et l'accompagnement d'une personne experte. Une personne peut préparer un dossier en profondeur; à deux, vous aurez chacun moins de temps.",
    doubt: "Tu pourrais lui laisser commencer, mais tu ne sais pas s'il te laissera ensuite ta part. Tu pourrais prendre la place maintenant, mais alors tu sauras que tu as peut-être fermé la porte à son proche. Le délai ne ralentit pas pendant que vous vous observez. Est-ce que tu attends un signe qui ne viendra peut-être jamais?",
    shared: "Vous partagez le poste et l'accompagnement. Les deux portfolios progressent, mais aucun n'est assuré d'être prêt à temps.",
    conflict: "La dispute fait partir la personne experte et met fin à l'accès au poste. Aucun portfolio ne reçoit l'aide prévue."
  }),
  scenario({
    id: "interpreter", rollTotals: [4], severity: 2, title: "La voix de ta mère",
    problem: "Demain, ta mère doit comprendre les options qui lui sont proposées lors d'un rendez-vous décisif. Sans interprète, elle risque de devoir choisir sans pouvoir poser toutes ses questions. Elle t'a demandé de l'accompagner; tu lui as dit que tu trouverais une solution.\n\nL'autre joueur a lui aussi un rendez-vous important pour une personne proche. La même interprète ne peut pas être partout. Tu ne sais pas ce qu'il est prêt à sacrifier pour être entendu.",
    resource: "La mallette donne accès à une interprète spécialisée. Une famille peut bénéficier d'un rendez-vous complet; en partageant, chacune aura un échange plus court, avec moins de temps pour expliquer sa situation.",
    doubt: "Tu te répètes que l'autre comprendra. Puis tu imagines qu'il puisse appeler avant toi et réserver tout le temps. Pendant ce temps, ta mère attend une réponse qu'elle ne peut pas obtenir seule. Tu ne sais pas si ton silence protège l'autre ou abandonne la personne qui t'a demandé de l'aide.",
    shared: "L'interprète partage son temps entre les deux rendez-vous. Vos proches peuvent poser leurs questions principales, sans garantie que toutes leurs inquiétudes seront clarifiées.",
    conflict: "La dispute fait perdre le créneau; l'interprète doit partir et les deux rendez-vous ont lieu sans son aide."
  }),
  scenario({
    id: "toit-fuite", rollTotals: [5], severity: 2, title: "Le toit qui fuit",
    problem: "La pluie a ouvert une brèche dans le toit de la maison familiale. L'eau approche des affaires et du seul espace encore sec. Si rien n'est fait avant la nuit, une partie de ce que ta famille a réussi à préserver risque d'être perdue.\n\nL'autre joueur a lui aussi une famille exposée aux intempéries. Vous entendez la pluie sur la mallette. Vous savez tous les deux ce qu'une nuit de plus peut coûter; aucun de vous ne sait si l'autre cédera.",
    resource: "La mallette contient un kit spécialisé et l'aide d'un artisan disponible aujourd'hui. Il peut réparer complètement un toit ou renforcer provisoirement deux maisons.",
    doubt: "Tu peux partager le kit et laisser l'artisan répartir ses forces. Tu peux aussi t'assurer que ta maison sera la première réparée. Mais si l'autre prend tout, l'eau continuera de monter chez toi. Si tu prends tout, elle continuera chez lui. La prochaine averse n'attendra pas votre accord.",
    shared: "L'artisan renforce provisoirement les deux toits. Vos familles gagnent du temps, mais aucune maison n'est réparée complètement.",
    conflict: "Dans la dispute, le kit est abîmé et l'artisan repart. Les deux toits restent ouverts à la pluie."
  }),
  scenario({
    id: "carnet-frere", rollTotals: [6], severity: 2, title: "Le dossier de ton frère",
    problem: "Ton frère a une dernière chance de faire reconnaître ses années de formation. Sans le rendez-vous avec la personne qui peut valider son dossier, tout son parcours risque de rester invisible. Il a gardé ses preuves, ses notes, ses espoirs. Il t'a demandé de ne pas le laisser seul face à cette échéance.\n\nL'autre joueur a aussi un dossier qui ne peut plus attendre. Vous êtes devant la même porte, avec deux proches qui ne savent pas encore si quelqu'un leur ouvrira.",
    resource: "La mallette contient une place au seul entretien de validation de la semaine. Une personne peut être accompagnée en profondeur; à deux, vous devrez partager un temps plus court.",
    doubt: "Tu ne sais pas si l'autre te laissera parler en premier. Peut-être croit-il que tu vas prendre la place. Peut-être est-il déjà en train de préparer sa propre défense. Si tu partages, son dossier peut passer avant le tien. Si tu ne le fais pas, tu peux devenir la raison pour laquelle son proche n'aura pas été entendu.",
    shared: "Vous partagez l'entretien. Les deux dossiers sont examinés, mais le temps manque peut-être pour faire reconnaître tout le parcours de chacun.",
    conflict: "Le désaccord fait perdre le créneau unique; aucun dossier n'est présenté à la personne qui peut le valider."
  }),
  scenario({
    id: "atelier-incendie", rollTotals: [6], severity: 3, title: "L'atelier après l'incendie",
    problem: "Un incendie a rendu l'atelier de ta famille inutilisable. Les machines sont arrêtées. Plusieurs proches ont perdu leur routine et leur lieu de travail. Sans les bonnes pièces, les dégâts vont s'aggraver et personne ne sait quand l'activité pourra reprendre.\n\nL'autre joueur doit lui aussi remettre un lieu de travail sur pied. Vous vous retrouvez devant la mallette, chacun avec le visage de ceux qui attendent derrière vous.",
    resource: "À l'intérieur, un ensemble rare de pièces et d'outils calibrés. Il peut remettre un atelier en marche complètement ou aider deux ateliers à reprendre une partie de leur activité.",
    doubt: "Tu pourrais croire que l'autre partagera parce que son problème ressemble au tien. Mais peut-être qu'il voit cette ressemblance comme une raison de prendre tout. Tu peux aussi le devancer. Pendant que tu pèses chaque possibilité, les machines restent immobiles et les personnes qui comptent sur toi attendent.",
    shared: "Les pièces sont réparties entre les deux ateliers. Une partie de l'activité reprend dans chacun, mais les réparations restent incomplètes.",
    conflict: "La dispute fait tomber une pièce calibrée, désormais inutilisable. Les deux ateliers restent arrêtés."
  }),
  scenario({
    id: "rendez-vous-pere", rollTotals: [7], severity: 3, title: "Le rendez-vous de ton père",
    problem: "Ton père attend depuis longtemps une consultation qui pourrait enfin clarifier ce qui lui arrive. Le prochain créneau chez le spécialiste est le dernier avant plusieurs mois. Il te dit qu'il peut attendre; tu entends pourtant l'inquiétude dans sa voix.\n\nL'autre joueur accompagne lui aussi un proche qui attend une réponse médicale. Vous ne savez pas lequel des deux rendez-vous peut le moins attendre. Vous savez seulement qu'un seul créneau complet est disponible aujourd'hui.",
    resource: "La mallette ouvre l'accès au spécialiste et au trajet accompagné jusqu'au centre. Une famille peut bénéficier de la consultation complète; en partageant, le spécialiste peut consacrer un temps plus court à chacune.",
    doubt: "Tu essaies d'imaginer ce que l'autre ferait à ta place. Ça ne t'aide pas. Peut-être qu'il te laissera passer; peut-être qu'il appellera avant toi. Pendant que tu hésites, ton père attend sans savoir si tu as réussi à obtenir de l'aide.",
    shared: "Le spécialiste reçoit les deux familles pour des échanges plus courts. Chacun obtient une première orientation, sans forcément obtenir toutes les réponses attendues.",
    conflict: "Le désaccord fait manquer le départ accompagné et le créneau est donné à la personne suivante. Aucun proche ne voit le spécialiste."
  }),
  scenario({
    id: "garde-lina", rollTotals: [8], severity: 3, title: "La garde de Lina",
    problem: "Ta sœur a une entrevue pour un emploi qui pourrait stabiliser son quotidien. Elle n'a personne pour garder sa fille pendant le rendez-vous et le trajet. Lina te demande quand sa mère reviendra. Tu lui réponds que tout va s'arranger, sans savoir si tu peux le promettre.\n\nL'autre joueur a lui aussi besoin d'une personne de confiance pour un proche. La garde est à portée de main. Vous n'avez pas le temps d'organiser deux solutions séparées.",
    resource: "La mallette contient une place auprès d'une personne de confiance. Une famille peut disposer de toute la période; en partageant, chacune aura une garde plus courte et devra s'organiser autour.",
    doubt: "Tu te dis que l'autre comprendra l'urgence de ta sœur. Mais peut-être que son urgence lui semble encore plus grande. Si tu attends qu'il propose une solution, il peut réserver la place. Si tu la prends, tu laisses son proche sans personne. Et Lina continue de te regarder comme si tu savais déjà comment ça va finir.",
    shared: "La personne de confiance répartit son temps entre les deux familles. Les rendez-vous deviennent possibles, mais les trajets et horaires restent incertains.",
    conflict: "La dispute convainc la personne de confiance de se retirer. Les deux familles perdent la garde et doivent renoncer à leurs rendez-vous."
  }),
  scenario({
    id: "scene-sana", rollTotals: [8], severity: 4, title: "La scène de Sana",
    problem: "Sana, ta meilleure amie, prépare depuis des années une audition pour une école qu'elle croyait inaccessible. Elle n'aura qu'une occasion de monter sur cette scène. Elle ne te demande pas de garantir sa réussite; elle te demande de l'aider à arriver prête.\n\nL'autre joueur accompagne aussi quelqu'un qui joue une chance importante aujourd'hui. Les deux auditions ne se ressemblent pas, mais l'attente, elle, est la même.",
    resource: "Dans la mallette, un équipement adapté et une personne experte pour accompagner la préparation. Une personne peut répéter en profondeur; en partageant, chacune reçoit moins de temps.",
    doubt: "Tu repenses à ce que l'autre a peut-être promis. Les promesses sont faciles avant que la scène s'ouvre. Peut-être qu'il prendra la place dès que tu détourneras les yeux. Peut-être qu'il attend que tu lui prouves que tu lui fais confiance. Pendant ce temps, Sana se prépare sans savoir si tu reviendras avec l'aide promise.",
    shared: "L'accompagnement et l'équipement sont partagés. Les deux personnes peuvent se préparer, mais chacune dispose de moins de temps et de répétitions.",
    conflict: "La dispute fait interrompre la préparation et l'équipement est retiré. Les deux auditions ont lieu sans cet accompagnement."
  }),
  scenario({
    id: "trajet-retour", rollTotals: [9], severity: 4, title: "Le trajet de retour",
    problem: "Un membre de ta famille est bloqué loin de chez lui après un événement difficile. Il attend une place dans un transport sûr. Il t'a envoyé un seul message, puis plus rien. Tu ignores si son téléphone est déchargé ou s'il n'a simplement plus la force de répondre.\n\nL'autre joueur attend lui aussi qu'un proche puisse rentrer sans danger. La nuit approche. Vous ne savez pas combien de temps le véhicule restera disponible.",
    resource: "La mallette contient une place réservée dans un véhicule avec une personne accompagnatrice. Une personne peut faire le trajet complet; en partageant, deux proches peuvent être pris en charge sur une partie du trajet seulement.",
    doubt: "Tu regardes l'autre et tu cherches un signe. Il pourrait appeler son proche en premier et prendre la place. Il pourrait aussi te la laisser. Tu ne peux pas savoir lequel. Chaque minute passée à attendre une réponse est une minute pendant laquelle ton proche est encore là-bas.",
    shared: "Le véhicule prend en charge les deux proches sur une partie du trajet. Ils avancent vers un lieu sûr, mais devront peut-être trouver une autre solution ensuite.",
    conflict: "La dispute retarde le départ; le véhicule part sans personne et les deux proches restent bloqués."
  }),
  scenario({
    id: "soin-domicile", rollTotals: [10], severity: 4, title: "Une journée de soin",
    problem: "Ton oncle vient de rentrer chez lui et ne peut pas encore se débrouiller seul. Pour sa première journée, il a besoin d'aide pour se déplacer et prendre ses soins correctement. Ta famille travaille; chacun essaie de trouver une solution sans montrer à quel point il a peur de le laisser seul.\n\nL'autre joueur doit organiser la première journée d'un proche lui aussi. Le temps de l'équipe de soins est limité. Vous ne savez pas qui en a le plus besoin, ni qui osera le dire en premier.",
    resource: "Dans la mallette, une journée de visite d'une équipe de soins à domicile. Une personne peut recevoir un suivi continu; en partageant, deux foyers auront des visites plus courtes.",
    doubt: "Tu te dis qu'il partagera si tu partages. Puis tu imagines l'équipe entrer d'abord chez l'autre et repartir avant d'arriver chez ton oncle. Peut-être que l'autre fait le même calcul. Pendant que vous vous méfiez l'un de l'autre, deux proches attendent qu'on décide pour eux.",
    shared: "L'équipe passe dans les deux foyers pour des visites plus courtes. Vos proches reçoivent une aide réelle, mais pas un suivi continu.",
    conflict: "Le désaccord retarde l'organisation; l'équipe ne peut plus tenir ses deux visites aujourd'hui."
  }),
  scenario({
    id: "operation-soeur", rollTotals: [10], severity: 5, title: "L'intervention de ta sœur",
    problem: "Ta sœur a besoin d'une intervention urgente. Dans le même temps, un autre membre de ta famille attend lui aussi des soins. Le médecin t'a dit que le délai compte, puis il a quitté la pièce sans te dire quelle situation peut attendre. Tu dois répondre aujourd'hui.\n\nL'autre joueur fait face à une urgence pour quelqu'un qui compte pour lui. Il n'a pas l'air moins inquiet que toi. Vous n'avez ni le temps ni les informations pour comparer vos peurs.",
    resource: "La mallette donne accès à une équipe médicale et à une salle pour une intervention complète. En partageant, l'équipe peut stabiliser deux personnes, mais aucune intervention complète n'est garantie.",
    doubt: "Tu pourrais croire que l'autre choisira de partager. Tu pourrais aussi te dire qu'il n'a aucune raison de faire passer ton proche avant le sien. Si tu prends l'accès, tu peux aider ta sœur; si tu attends, tu peux perdre du temps que tu ne récupéreras pas. Tu n'as aucun moyen de savoir ce que l'autre fera.",
    shared: "L'équipe stabilise les deux personnes. Elles reçoivent une première aide, mais devront peut-être attendre pour l'intervention complète.",
    conflict: "La dispute fait perdre le créneau et retarde l'accès à l'équipe. Les deux familles doivent attendre une nouvelle décision médicale."
  }),
  scenario({
    id: "place-refuge", rollTotals: [11], severity: 5, title: "La dernière place sûre",
    problem: "Après une nuit particulièrement difficile, tu dois trouver un lieu sûr pour un proche avant la fin de la journée. Chaque heure passée dehors rend la situation plus fragile. Tu lui as dit de tenir encore un peu. À présent, tu ne sais plus combien de temps tu peux lui demander d'attendre.\n\nL'autre joueur cherche lui aussi un refuge pour quelqu'un de proche. Il reste une seule place complète. Vous vous connaissez assez pour lire la fatigue sur le visage de l'autre, pas assez pour savoir ce qu'il va décider.",
    resource: "La mallette contient l'accès à une place de refuge, au transport et à une personne référente. Un foyer peut recevoir un accueil complet; en partageant, deux foyers peuvent obtenir une mise à l'abri provisoire et un accompagnement limité.",
    doubt: "L'autre peut prendre la place pendant que tu te demandes si tu dois lui faire confiance. Il peut aussi attendre ton geste. Si tu prends tout, ton proche sera à l'abri et le sien restera dehors. Si tu partages, tu ne peux pas être sûr que l'aide suffira. La journée avance; tu ne sais pas ce qui se passe là-bas maintenant.",
    shared: "Les deux foyers reçoivent une mise à l'abri provisoire et un accompagnement limité. C'est une chance immédiate, sans garantie de solution pour la suite.",
    conflict: "La dispute fait annuler la réservation et le transport repart. Aucun des deux foyers n'entre au refuge."
  }),
  scenario({
    id: "deux-interventions", rollTotals: [12], severity: 5, title: "Deux interventions urgentes",
    problem: "Ta mère et ta sœur ont toutes les deux besoin d'une intervention urgente. L'équipe disponible aujourd'hui n'a le temps d'en mener qu'une complètement. On t'a dit que chacune pouvait attendre un peu, sans te dire ce que ce « peu » signifie. Elles attendent ta réponse.\n\nL'autre joueur doit choisir pour un proche lui aussi. Vous vous regardez sans savoir si l'autre est prêt à céder, ni ce que vous regretterez demain.",
    resource: "Dans la mallette, l'accès à une équipe médicale et à une salle libre. L'équipe peut mener une intervention complète pour une personne ou stabiliser deux personnes en attendant la suite.",
    doubt: "Tu entends déjà les raisons de prendre l'accès complet: ta mère, ta sœur, le temps qui manque. Puis tu te demandes si l'autre se raconte la même chose. Peut-être qu'il tendra la main avant toi. Peut-être qu'il partage vraiment. Pendant que tu hésites, deux personnes que tu aimes attendent une décision que tu ne peux pas prendre à leur place.",
    shared: "L'équipe stabilise les deux personnes. Elles reçoivent une aide immédiate, mais aucune ne bénéficie de l'intervention complète aujourd'hui.",
    conflict: "La dispute fait perdre le créneau opératoire. L'équipe ne peut intervenir sur aucune des deux situations aujourd'hui."
  }),
  ...extraScenarios
];

export const severityLabel = (severity) => ["", "Sensible", "Délicat", "Tendu", "Urgent", "Critique"][severity] ?? "Inconnu";
