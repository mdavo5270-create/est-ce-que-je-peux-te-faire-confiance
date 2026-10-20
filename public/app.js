
const app = document.querySelector("#app");
const leaveButton = document.querySelector("#leave-game");
const topbarLabel = document.querySelector("#topbar-label");
const storagePrefix = "trust-game:";
let identity = null, banks = null, setupState = null, waitingTimer = null, busy = false, toastTimer = null, game = null, resultsSignature = null, pendingSelection = null;
const icons = {
  arrow:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  lock:'<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="2"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/></svg>',
  people:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 5.5a3 3 0 0 1 0 5.8M17 14a5 5 0 0 1 3.5 4.8"/></svg>',
  dice:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M8 8h.01M16 8h.01M12 12h.01M8 16h.01M16 16h.01"/></svg>',
  sparkle:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/><path d="m19 15 .8 2.2L22 18l-2.2.8L19 15Z"/></svg>'
};
function esc(value=""){return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function storageKey(id,role){return storagePrefix+id+":"+role;}
function savedProfileName(){try{return JSON.parse(localStorage.getItem(storagePrefix+"profile")||"null")?.name||"";}catch{return "";}}
function rememberProfileName(name){try{localStorage.setItem(storagePrefix+"profile",JSON.stringify({name}));}catch{}}
function storeIdentity(value){identity=value;if(value.role!=="JOIN"){localStorage.setItem(storageKey(value.id,value.role),JSON.stringify(value));localStorage.setItem(storagePrefix+"last",JSON.stringify({id:value.id,role:value.role}));}}
function readIdentity(id,role){try{return JSON.parse(localStorage.getItem(storageKey(id,role))||"null");}catch{return null;}}
function restoreIdentity(){
  const params=new URLSearchParams(location.search),id=params.get("game"),invite=params.get("invite");
  if(id&&invite){const savedGuest=readIdentity(id,"B");if(savedGuest)return savedGuest;return{id,role:"JOIN",invite};}
  if(id){const saved=readIdentity(id,params.get("role")||"A");if(saved)return saved;}
  try{const last=JSON.parse(localStorage.getItem(storagePrefix+"last")||"null");return last?readIdentity(last.id,last.role):null;}catch{return null;}
}
async function request(path,options={}){
  const headers={};if(options.body)headers["content-type"]="application/json";if(options.token)headers.authorization="Bearer "+options.token;
  const response=await fetch(path,{method:options.method||"GET",headers,body:options.body?JSON.stringify(options.body):undefined});
  const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||"Une erreur est survenue. Réessaie dans un instant.");return data;
}
function setTopbar(active){leaveButton.classList.toggle("hidden",!active);topbarLabel.textContent=active?"PARTIE PRIVÉE":"UNE PARTIE PRIVÉE";}
function stopWaiting(){if(waitingTimer)clearInterval(waitingTimer);waitingTimer=null;}
function toast(message){document.querySelector(".toast")?.remove();const item=document.createElement("div");item.className="toast";item.setAttribute("role","status");item.textContent=message;document.body.append(item);clearTimeout(toastTimer);toastTimer=setTimeout(()=>item.remove(),2800);}
function setBusy(value){busy=value;app.querySelectorAll("button").forEach(button=>button.disabled=value);}
function showHome(error=""){
  stopWaiting();setTopbar(false);
  app.innerHTML=`
  <section class="home-grid"><div class="home-copy"><p class="eyebrow">Un jeu de choix à plusieurs</p>
  <h1 class="display-title">Est-ce que je peux<br><em>te faire confiance&nbsp;?</em></h1>
  <p class="lead">Trois dilemmes, trois questions personnelles et quatre situations. Joue, invite plusieurs amis avec le même lien, puis compare les résultats.</p>
  <div class="home-notes"><span class="note-pill">${icons.dice} 10 étapes</span><span class="note-pill">${icons.people} Invitations sans limite</span><span class="note-pill">${icons.lock} Choix cachés</span></div></div>
  <form class="intro-card" id="start-form"><div class="card-kicker"><span>La première étape</span><span class="small-lock">${icons.lock} privé</span></div>
  <h2 class="card-title">Ouvre une partie.</h2><p class="card-copy">Tu choisis tes réponses de référence et les situations. Tes amis répondront séparément, sans voir tes choix.</p>
  <label class="form-label" for="player-name">Ton prénom ou un pseudo</label><input class="text-input" id="player-name" name="name" maxlength="32" autocomplete="nickname" placeholder="Par exemple, Alex" value="${esc(savedProfileName())}" required />
  <p class="error-message" id="home-error" role="alert">${esc(error)}</p><button class="primary-button full-width" type="submit">Commencer ${icons.arrow}</button>
  <p class="card-footnote">Le score décrit cette partie; ce n'est pas un test de personnalité.</p></form></section>`;
  document.querySelector("#start-form").addEventListener("submit",startGame);
}
async function startGame(event){
  event.preventDefault();const fd=new FormData(event.currentTarget),rawName=fd.get("name"),name=typeof rawName==="string"?rawName.trim():"";
  if(!name){document.querySelector("#home-error").textContent="Entre ton prénom ou un pseudo pour commencer.";return;}
  try{const created=await request("/api/games",{method:"POST",body:{name}});rememberProfileName(name);storeIdentity({...created,role:"A",playerName:name});history.replaceState(null,"","?game="+encodeURIComponent(created.id)+"&role=A");await refreshGame();}
  catch(error){document.querySelector("#home-error").textContent=error.message;}
}
function progressBars(completed,total=3){
  return `<div class="progress-row" aria-label="Progression : ${completed} sur ${total}"><span>${completed} / ${total}</span><div class="progress-track">${Array.from({length:total},(_,i)=>`<i class="${i<completed?"done":""}"></i>`).join("")}</div></div>`;
}
function currentSelectionKey(data){
  if(data.role==="A"){
    const round=data.myRounds.at(-1);
    return round&&!round.choiceLocked?`A:dilemma:${round.turn}`:null;
  }
  const prompt=data.currentPrompt;
  if(!prompt)return null;
  return prompt.type==="dilemma"?`B:dilemma:${prompt.round.turn}`:`B:${prompt.type}:${prompt.index}`;
}
function selectionConfirmation(){
  return `<div class="selection-confirmation" role="status"><p>Ton choix est prêt. Il ne sera enregistré qu'après confirmation.</p><div><button type="button" class="secondary-button" data-action="cancel-selection">Choisir autrement</button><button type="button" class="primary-button confirm-choice-button" data-action="confirm-selection">Confirmer mon choix ${icons.lock}</button></div></div>`;
}
function die(value){const pips={1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]}[value];return `<div class="die" aria-label="Dé ${value}">${Array.from({length:9},(_,i)=>`<i class="pip ${pips.includes(i)?"on":""}"></i>`).join("")}</div>`;}
function renderDice(round){
  if(!round)return `<div class="dice-area">${die(5)}<span class="plus-sign">+</span>${die(5)}</div><p class="roll-hint">Deux dés choisissent un dilemme progressif, identique pour tous.</p>`;
  return `<div class="dice-area">${die(round.dice[0])}<span class="plus-sign">+</span>${die(round.dice[1])}<span class="plus-sign">=</span><strong class="roll-total">${round.total}</strong></div>`;
}
function scenarioCard(round,role,hint=null){
  const s=round.scenario,level=["","Sensible","Délicat","Tendu","Urgent","Critique"][s.severity]||"Scénario";
  const selectionKey=`${role}:dilemma:${round.turn}`,selected=pendingSelection?.key===selectionKey?pendingSelection.value:null;
  return `<article class="game-card"><div class="dice-header"><span>${role==="A"?"Ton lancer":"Lancer commun"}</span><span>${round.dice[0]} + ${round.dice[1]} = ${round.total}</span></div>${renderDice(round)}
  <div class="scenario-divider"></div><p class="scenario-kicker">Dilemme ${round.turn} sur 3 <span class="level-tag">${esc(level)}</span></p>
  <h2 class="scenario-title">${esc(s.title)}</h2><p class="scenario-text">${esc(s.problem)}</p>
  <div class="resource-box"><span class="resource-label">LA RESSOURCE</span><p>${esc(s.resource)}</p></div>
  <div class="doubt-box"><span class="resource-label">CE QUI PEUT FAIRE HÉSITER</span><p>${esc(s.doubt)}</p></div>
  <section class="outcome-box"><h3>Tu connais les risques</h3><ul class="outcome-list">
  <li><strong>Vous partagez tous les deux.</strong> ${esc(s.outcomes.bothShare)}</li><li><strong>Tu voles, l'autre partage.</strong> ${esc(s.outcomes.youSteal)}</li>
  <li><strong>Tu partages, l'autre vole.</strong> ${esc(s.outcomes.otherSteals)}</li><li><strong>Vous volez tous les deux.</strong> ${esc(s.outcomes.bothSteal)}</li></ul></section>
  ${hint?`<div class="serpent-hint"><span class="serpent-mark" aria-hidden="true">?</span><div><strong>Le Serpent du doute</strong><p>Il murmure que A a choisi <b>${esc(hint.said)}</b>. Dans ce jeu, il dit vrai environ 6 fois sur 10 : il peut aussi mentir. Son indice ne change pas ton score.</p></div></div>`:""}
  <p class="choice-prompt">Sélectionne ta décision, puis confirme-la.</p><div class="choice-row">
  <button type="button" class="choice-button ${selected==="PARTAGER"?"selected":""}" aria-pressed="${selected==="PARTAGER"}" data-action="select-choice" data-choice="PARTAGER"><span class="choice-icon">↗</span> PARTAGER</button>
  <button type="button" class="choice-button steal ${selected==="VOLER"?"selected":""}" aria-pressed="${selected==="VOLER"}" data-action="select-choice" data-choice="VOLER"><span class="choice-icon">↘</span> VOLER</button></div>
  ${selected?selectionConfirmation():`<p class="locked-note">${icons.lock} Un clic sélectionne seulement; rien n'est envoyé avant ta confirmation.</p>`}</article>`;
}
function sidePanel(data){
  return `<aside><section class="sidebar-card"><h2 class="side-title">Ta partie</h2>
  <div class="player-row"><div class="player-info"><span class="avatar">A</span><div><div class="player-name">${esc(data.myName)} <small>(toi)</small></div><div class="player-state">Tes choix sont privés</div></div></div><span class="mini-count">${data.myCompleted}/3</span></div>
  <div class="player-row"><div class="player-info"><span class="avatar alt">${data.guestCount}</span><div><div class="player-name">Amis invités</div><div class="player-state">${data.completedGuests} sur ${data.guestCount} ont terminé</div></div></div><span class="mini-count">${data.guestCount}</span></div></section>
  <section class="sidebar-card howto-card"><h2 class="side-title">Les 10 étapes</h2><ol class="howto-list"><li><span class="howto-num">1</span><span>A joue ses trois dilemmes puis prépare les questions.</span></li><li><span class="howto-num">2</span><span>Chaque ami répond seul aux mêmes questions, sans voir les clés.</span></li><li><span class="howto-num">3</span><span>Le classement s'ouvre quand tous les invités ont terminé.</span></li></ol></section></aside>`;
}
function renderHostTurn(data){
  const current=data.myRounds.at(-1);
  if(current&&!current.choiceLocked)return `<div class="game-layout"><section class="game-main"><div class="game-heading"><div><p class="eyebrow">À toi, ${esc(data.myName)}</p><h1 class="game-title">Le dilemme ${current.turn}.</h1><p class="game-subtitle">Les dés ont fixé le scénario. Lis les conséquences avant de choisir.</p></div><span class="turn-badge">${current.turn} / 3</span></div>${progressBars(data.myCompleted)}${scenarioCard(current,"A")}</section>${sidePanel(data)}</div>`;
  const turn=data.myCompleted+1;
  return `<div class="game-layout"><section class="game-main"><div class="game-heading"><div><p class="eyebrow">À toi, ${esc(data.myName)}</p><h1 class="game-title">Un choix à la fois.</h1><p class="game-subtitle">Les trois dilemmes monteront progressivement en intensité.</p></div><span class="turn-badge">Dilemme ${turn} / 3</span></div>${progressBars(data.myCompleted)}
  <section class="game-card"><div class="dice-header"><span>Le prochain scénario</span><span>Deux dés · six faces</span></div>${renderDice(null)}<button class="primary-button full-width" data-action="roll">Lancer les dés ${icons.arrow}</button><p class="locked-note">${icons.lock} Ton choix restera privé jusqu'à la fin de la partie.</p></section></section>${sidePanel(data)}</div>`;
}
function initSetup(){if(setupState)return;setupState={step:0,personal:Array.from({length:3},(_,i)=>({id:banks.personalQuestions[i].id,answerIndex:null})),situations:Array.from({length:4},(_,i)=>({id:banks.situations[i].id,idealIndex:null,alternativeIndex:null}))};}
function bankSelect(kind,index,selectedId,items){
  const taken=setupState[kind].filter((_,i)=>i!==index).map(entry=>entry.id);
  return `<select class="text-input bank-select" data-setup-kind="${kind}" data-setup-index="${index}">${items.map(item=>`<option value="${esc(item.id)}" ${item.id===selectedId?"selected":""} ${taken.includes(item.id)?"disabled":""}>${esc(kind==="personal"?item.prompt:item.title)}</option>`).join("")}</select>`;
}
function answerOptions(options,selected,index,mode=""){
  return `<div class="option-list">${options.map((option,n)=>`<div class="option-row"><span>${esc(option)}</span><div class="option-actions"><button type="button" class="mini-choice ${selected===n?"selected":""}" aria-pressed="${selected===n}" data-action="set-personal" data-index="${index}" data-choice-index="${n}">${selected===n?"Ta réponse":"Choisir"}</button></div></div>`).join("")}</div>`;
}
function situationOptionButtons(options,entry,index){
  const complete=entry.idealIndex!==null&&entry.alternativeIndex!==null;
  const choices=options.map((option,n)=>{
    const label=entry.idealIndex===n?"Priorité":entry.alternativeIndex===n?"Alternative":null;
    const button=label?`<span class="selection-badge">${label}</span>`:`<button type="button" class="mini-choice" ${complete?"disabled":""} data-action="set-key" data-index="${index}" data-choice-index="${n}">${entry.idealIndex===null?"Choisir en priorité":"Choisir en alternative"}</button>`;
    return `<div class="option-row ${label?"option-row-selected":""}"><span>${esc(option)}</span><div class="option-actions">${button}</div></div>`;
  }).join("");
  return `<div class="option-list">${choices}</div>${complete?`<button type="button" class="setup-reset" data-action="reset-situation" data-index="${index}">Recommencer cette sélection</button>`:""}`;
}
function renderSetup(data){
  initSetup();
  const step=setupState.step,isPersonal=step<3,index=isPersonal?step:step-3;
  const kind=isPersonal?"personal":"situations";
  const entry=setupState[kind][index];
  const items=isPersonal?banks.personalQuestions:banks.situations;
  const q=items.find(item=>item.id===entry.id);
  const content=isPersonal
    ? `<h3>${esc(q.prompt)}</h3><p class="setup-hint">Cette question parle de toi. Choisis ta propre réponse parmi cinq propositions fixes : tes amis devront la deviner.</p>${answerOptions(q.options,entry.answerIndex,index)}`
    : `<h3>${esc(q.prompt)}</h3><p class="setup-hint">Ces réponses décrivent ce que ton ami ferait pour toi. Premier clic : ta priorité. Deuxième clic sur une autre réponse : ton alternative acceptable. Les deux autres valent zéro.</p>${situationOptionButtons(q.options,entry,index)}`;
  const ready=isPersonal?entry.answerIndex!==null:entry.idealIndex!==null&&entry.alternativeIndex!==null;
  const stepName=isPersonal?`Question personnelle ${index+1} sur 3`:`Mise en situation ${index+1} sur 4`;
  return `<section class="setup-page"><div class="game-heading"><div><p class="eyebrow">Préparation privée · étape ${step+1} sur 7</p><h1 class="game-title">${isPersonal?"Ta réponse personnelle.":"Ta priorité pour cette situation."}</h1><p class="game-subtitle">Une seule question à la fois. Tes choix restent cachés à tes amis jusqu'au dévoilement.</p></div><span class="turn-badge">${step+1} / 7</span></div>${progressBars(step,7)}
  <div class="score-preview"><strong>${stepName}</strong><span>${isPersonal?"Tu indiques ta propre réponse.":"Quatre choix prédéfinis · priorité puis alternative."}</span></div>
  <form id="setup-form"><article class="setup-card"><div class="setup-card-head"><span class="setup-number">${isPersonal?"P":"S"}${index+1}</span><div><p class="eyebrow">${isPersonal?"Question personnelle":"Mise en situation"}</p>${bankSelect(kind,index,entry.id,items)}</div></div>${content}</article>
  <p class="error-message" id="setup-error" role="alert"></p><div class="wizard-actions">${step>0?`<button type="button" class="secondary-button" data-action="setup-back">Retour</button>`:`<span></span>`}<button class="primary-button wizard-next" type="submit" ${ready?"":"disabled"}>${step===6?"Verrouiller mes réponses": "Continuer"} ${step===6?icons.lock:icons.arrow}</button></div></form></section>`;
}
function renderInvite(data){
  const guests=data.guests.length?`<div class="guest-progress-list">${data.guests.map(g=>`<div class="guest-progress-row"><span class="avatar alt">${esc(g.name.slice(0,1).toUpperCase())}</span><strong>${esc(g.name)}</strong><span>${g.completed?"Terminé":g.progress+" / 10 étapes"}</span></div>`).join("")}</div>${data.guestCount>data.guests.length?`<p class="invite-hint">Et ${data.guestCount-data.guests.length} autre${data.guestCount-data.guests.length===1?"":"s"} personne${data.guestCount-data.guests.length===1?"":"s"} inscrite${data.guestCount-data.guests.length===1?"":"s"}.</p>`:""}`:`<p class="waiting-indicator">En attente du premier ami</p>`;
  const link=identity.inviteUrl?`<div class="invite-box"><input class="invite-url" id="invite-url" readonly value="${esc(identity.inviteUrl)}" aria-label="Lien d'invitation"/><button class="secondary-button" data-action="copy-invite">Copier le lien</button></div>`:`<button class="primary-button" data-action="load-invite">Créer le lien ${icons.arrow}</button>`;
  return `<section class="waiting-layout"><div class="waiting-card"><div class="waiting-icon">${icons.people}</div><p class="eyebrow">Tes dilemmes et tes clés sont verrouillés</p>
  <h1 class="waiting-title">Invite autant d'amis que tu veux.</h1><p class="waiting-copy">Partage le même lien avec ton groupe. Chaque ami découvre son résultat dès qu'il termine; le classement s'actualise à mesure que les autres finissent. Tu n'as rien à clôturer.</p>
  ${link}${guests}<div class="waiting-indicator">${data.guestCount} ami${data.guestCount===1?"":"s"} inscrit${data.guestCount===1?"":"s"} · ${data.completedGuests} terminé${data.completedGuests===1?"":"s"}</div><p class="invite-hint">Le Serpent du doute donne à chaque invité le même indice, vrai ou inversé, sans modifier son score.</p></div></section>`;
}
function renderJoin(){
  stopWaiting();setTopbar(false);
  app.innerHTML=`<section class="waiting-layout"><div class="waiting-card"><div class="waiting-icon">${icons.lock}</div><p class="eyebrow">Invitation privée</p><h1 class="waiting-title">Tu as été invité à jouer.</h1><p class="waiting-copy">Entre un prénom ou un pseudo. Tes réponses restent cachées jusqu'à ce que tous les joueurs aient fini.</p>
  <form id="join-form" class="join-form"><label class="form-label" for="join-name">Ton prénom ou un pseudo</label><input class="text-input" id="join-name" name="name" maxlength="32" autocomplete="nickname" placeholder="Par exemple, Sam" value="${esc(savedProfileName())}" required/><p class="error-message" id="join-error" role="alert"></p><button class="primary-button full-width" type="submit">Rejoindre la partie ${icons.arrow}</button><p class="invite-hint">Ton pseudo sera retenu dans ce navigateur. Rouvre ce lien sur cet appareil pour retrouver cette partie.</p></form></div></section>`;
  document.querySelector("#join-form").addEventListener("submit",joinGame);
}
function renderGuestStep(data){
  const step=data.progress+1,p=data.currentPrompt;
  if(!p)return renderWaiting(data);
  const title=p.type==="dilemma"?"Un choix difficile.":p.type==="personal"?`Connais-tu ${esc(data.otherName)} ?`:`Que ferais-tu pour ${esc(data.otherName)} ?`;
  const header=`<div class="game-heading"><div><p class="eyebrow">À toi, ${esc(data.myName)}</p><h1 class="game-title">${title}</h1><p class="game-subtitle">Tes réponses sont privées. L'hôte ne verra rien avant la fin de toutes les parties.</p></div><span class="turn-badge">Étape ${step} / 10</span></div>`;
  if(p.type==="dilemma")return `<div class="game-layout"><section class="game-main">${header}${progressBars(data.progress,10)}${scenarioCard(p.round,"B",p.serpentHint)}</section>${sidePanelGuest(data)}</div>`;
  const q=p.question,selectionKey=`B:${p.type}:${p.index}`,selected=pendingSelection?.key===selectionKey?pendingSelection.value:null;
  return `<section class="guest-question">${header}${progressBars(data.progress,10)}<article class="game-card question-card"><p class="eyebrow">${p.type==="personal"?`Question sur ${esc(data.otherName)}`:"Situation pour l'hôte"} · ${p.index+1} / ${p.type==="personal"?3:4}</p>
  ${p.type==="situation"?`<h2 class="scenario-title">${esc(q.title)}</h2>`:""}<h2 class="question-prompt">${p.type==="personal"?`« ${esc(data.otherName)} te demande : ${esc(q.prompt)} »`:esc(q.prompt)}</h2><p class="setup-hint">${p.type==="personal"?`Tu devines la réponse de ${esc(data.otherName)}. Dans la question et les propositions, « je/me » désigne ${esc(data.otherName)}.`:`Tu réponds à la place de ${esc(data.otherName)} : « je/me » désigne l'hôte. Choisis ce que tu ferais pour l'hôte.`}</p>
  <div class="guest-options">${q.options.map((option,i)=>`<button type="button" class="guest-option ${selected===i?"selected":""}" aria-pressed="${selected===i}" data-action="select-answer" data-type="${p.type}" data-choice-index="${i}"><span class="option-index">${String.fromCharCode(65+i)}</span><span>${esc(option)}</span><span class="option-arrow">›</span></button>`).join("")}</div>${selected!==null?selectionConfirmation():`<p class="locked-note">${icons.lock} Choisis une réponse, puis confirme pour l'envoyer.</p>`}</article></section>`;
}
function renderGuestCompleted(data){
  return `<section class="waiting-layout"><div class="waiting-card"><div class="waiting-icon">${icons.lock}</div><p class="eyebrow">Tes réponses sont enregistrées</p><h1 class="waiting-title">C'est terminé, ${esc(data.myName)}.</h1><p class="waiting-copy">L'organisateur consulte le classement et le détail des réponses. Cette partie ne révèle pas les résultats des autres participants.</p><div class="waiting-indicator">Ta session est verrouillée</div><div class="result-actions"><button class="primary-button" data-action="new-game">Créer ma partie et inviter mes amis ${icons.arrow}</button></div></div></section>`;
}
function sidePanelGuest(data){
  return `<aside><section class="sidebar-card"><h2 class="side-title">Ta progression</h2><div class="player-row"><div class="player-info"><span class="avatar alt">${esc(data.myName.slice(0,1).toUpperCase())}</span><div><div class="player-name">${esc(data.myName)} <small>(toi)</small></div><div class="player-state">Tes réponses sont privées</div></div></div><span class="mini-count">${data.progress}/10</span></div><div class="player-row"><div class="player-info"><span class="avatar">A</span><div><div class="player-name">${esc(data.otherName)}</div><div class="player-state">Ses réponses restent cachées</div></div></div><span class="mini-count">•••</span></div></section></aside>`;
}
function renderWaiting(data){
  const status=`${data.completedGuests} / ${data.guestCount} amis ont terminé. Les résultats se révèlent automatiquement à la fin de ta partie.`;
  return `<section class="waiting-layout"><div class="waiting-card"><div class="waiting-icon">${icons.lock}</div><p class="eyebrow">Tes réponses sont enregistrées</p><h1 class="waiting-title">La révélation attend le groupe.</h1><p class="waiting-copy">${status}</p><div class="waiting-indicator">Ta session est verrouillée</div></div></section>`;
}
function answerReviews(items,kind,guestView=false){
  return `<div class="answer-review-list">${items.map((item,i)=>{
    const prompt=guestView?(item.guestPrompt||item.prompt):item.prompt;
    if(kind==="personal")return `<article class="answer-review"><p class="eyebrow">Question personnelle ${i+1}</p><h3>${esc(prompt)}</h3><p><b>Ta réponse :</b> ${esc(item.options[item.guestAnswerIndex])}</p><p><b>Réponse de référence :</b> ${esc(item.options[item.hostAnswerIndex])}</p><span class="score-chip ${item.correct?"good":"zero"}">${item.correct?"10 points":"0 point"}</span></article>`;
    return `<article class="answer-review"><p class="eyebrow">Mise en situation ${i+1}</p><h3>${esc(item.title)} · ${esc(prompt)}</h3><p><b>Ta réponse :</b> ${esc(item.options[item.guestAnswerIndex])}</p><p><b>Idéale :</b> ${esc(item.options[item.idealIndex])}</p><p><b>Alternative acceptée :</b> ${esc(item.options[item.alternativeIndex])}</p><span class="score-chip ${item.result==="other"?"zero":"good"}">${item.result==="ideal"?"10 points":item.result==="alternative"?"5 points":"0 point"}</span></article>`;
  }).join("")}</div>`;
}
function renderMatch(match,guestView=false){
  const s=match.scores;
  const dilemmas=match.dilemmas.map(item=>`<article class="pair-card"><div class="pair-player"><div class="pair-topline">Dilemme ${item.turn} · ${esc(item.scenario.title)}</div><div class="pair-choice">${esc(item.hostChoice)}</div></div><div class="pair-player"><div class="pair-topline">Réponse de ${esc(match.name)}</div><div class="pair-choice ${item.guestChoice==="VOLER"?"steal":""}">${esc(item.guestChoice)}</div></div><div class="pair-verdict"><span class="verdict-icon ${item.trustPercent!==100?"mixed":""}">${item.trustPercent}%</span>${item.points} / 10 pts</div></article>`).join("");
  return `<article class="match-result"><div class="match-title"><div><p class="eyebrow">Partie de ${esc(match.name)}</p><h2>${s.total}<small> / 100</small></h2></div><span class="result-tag">Résultat de jeu</span></div>
  <div class="score-breakdown"><div><b>${s.dilemmas.points} / 30</b><span>Dilemmes</span></div><div><b>${s.personal.points} / 30</b><span>Personnelles · ${s.personal.correct}/3</span></div><div><b>${s.situations.points} / 40</b><span>Situations · ${s.situations.ideal} idéales, ${s.situations.alternative} alternatives</span></div></div>
  <div class="result-grid"><article class="metric-card"><div class="metric-label">Coopération · décisions</div><div class="metric-value-row"><span class="metric-value">${match.cooperation.percent}%</span><span class="metric-detail">${match.cooperation.shared} / 6 choix PARTAGER</span></div><p class="metric-caption">Part des six décisions où un joueur a choisi PARTAGER.</p></article>
  <article class="metric-card trust"><div class="metric-label">Confiance dans cette partie</div><div class="metric-value-row"><span class="metric-value">${match.trust.percent}%</span><span class="metric-detail">${esc(match.trust.label)}</span></div><p class="metric-caption">${esc(match.trust.message)}</p></article></div>
  <details class="formula-details"><summary>Voir les réserves et le détail des dilemmes</summary>${match.trust.reserve.length?`<ul>${match.trust.reserve.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`:`<p>Aucun choix divergent ou double VOLER lors de ces dilemmes.</p>`}<div class="pair-list">${dilemmas}</div></details>
  <section class="pair-section"><div class="section-heading"><h2>Réponses personnelles</h2><p>10 points par correspondance</p></div>${answerReviews(match.personal,"personal",guestView)}</section>
  <section class="pair-section"><div class="section-heading"><h2>Mises en situation</h2><p>Idéale 10 · alternative 5 · autre 0</p></div>${answerReviews(match.situations,"situation",guestView)}</section>
  ${match.serpent?`<aside class="serpent-result"><h3>Le Serpent du doute · dilemme ${match.serpent.turn}</h3><p>Il annonçait que A avait choisi <b>${esc(match.serpent.said)}</b>. C'était ${match.serpent.wasTrue?"vrai":"l'inverse"} : A avait choisi <b>${esc(match.serpent.actual)}</b>. L'indice était commun aux amis et ne change aucun point.</p></aside>`:""}</article>`;
}
function renderResults(data){
  const results=data.results,leaderboard=results.leaderboard||[],matchesByGuestId=new Map(results.matches.map(match=>[match.guestId,match]));
  const liveStatus=`${data.completedGuests} / ${data.guestCount} amis inscrits ont terminé. Le classement s'actualise quand un autre ami finit.`;
  const invitePanel=`<div class="invite-box">${identity.inviteUrl?`<input class="invite-url" id="invite-url" readonly value="${esc(identity.inviteUrl)}" aria-label="Lien d'invitation"/><button class="secondary-button" data-action="copy-invite">Copier le lien</button>`:`<button class="primary-button" data-action="load-invite">Créer le lien pour inviter d'autres amis ${icons.arrow}</button>`}</div><p class="invite-hint">Tu peux continuer à partager ce lien : les résultats apparaissent ici dès qu'un ami termine.</p>`;
  return `<section class="results-page"><div class="result-header"><div><p class="eyebrow">Classement privé de l'organisateur</p><h1 class="game-title">Les résultats évoluent.</h1><p class="game-subtitle">Tu es le seul à voir le classement et les réponses détaillées. Les scores décrivent cette partie, pas la personnalité.</p></div><span class="result-tag">${icons.sparkle} En direct</span></div>
  <div class="waiting-indicator">${liveStatus}</div>${invitePanel}
  <section class="leaderboard"><div class="section-heading"><h2>Classement des amis</h2><p>Score sur 100 · les égalités partagent le rang</p></div>${leaderboard.map(x=>`<div class="leader-row"><span class="rank-badge">${x.rank}</span><strong>${esc(x.name)}</strong><b>${x.total} <small>/100</small></b></div>`).join("")}</section>
  <section class="match-accordion-list"><div class="section-heading"><h2>Détail des parties</h2><p>Sélectionne un nom pour lire ses réponses.</p></div>${leaderboard.map(entry=>{const match=matchesByGuestId.get(entry.guestId);return match?`<details class="match-accordion"><summary><span class="rank-badge">${entry.rank}</span><strong>${esc(entry.name)}</strong><span class="accordion-score">${entry.total} <small>/100</small><em>Lire les réponses</em></span></summary><div class="match-accordion-content">${renderMatch(match)}</div></details>`:"";}).join("")}</section>
  <div id="ad-slot-results" class="advert-slot" aria-label="Publicité"></div>
  <div class="result-note">${icons.sparkle}<p><strong>Partager ne garantit pas une victoire individuelle.</strong> Les scores comparent les réponses dans ce jeu. Le pourcentage de confiance est un indicateur ludique fondé uniquement sur les trois dilemmes, pas une vérité scientifique sur le caractère ou la fiabilité d'une personne.</p></div>
  <div class="result-actions"><button class="secondary-button" data-action="new-game">Créer une nouvelle partie ${icons.arrow}</button></div></section>`;
}
function renderGame(data){
  game=data;setTopbar(true);
  if(pendingSelection&&pendingSelection.key!==currentSelectionKey(data))pendingSelection=null;
  if(data.readyToReveal){
    if(data.role==="B"){stopWaiting();app.innerHTML=renderGuestCompleted(data);return;}
    const signature=JSON.stringify([data.results,data.completedGuests,data.guestCount,identity?.inviteUrl]);
    if(signature!==resultsSignature||!app.querySelector(".results-page")){app.innerHTML=renderResults(data);resultsSignature=signature;}
    pollWaiting();return;
  }
  resultsSignature=null;
  if(data.role==="A"&&data.myCompleted<3){stopWaiting();app.innerHTML=renderHostTurn(data);return;}
  if(data.role==="A"&&!data.setupDone){stopWaiting();app.innerHTML=renderSetup(data);document.querySelector("#setup-form").addEventListener("submit",saveSetup);return;}
  if(data.role==="A"){app.innerHTML=renderInvite(data);if(!identity.inviteUrl&&data.canInvite)loadInvite(null,true);pollWaiting();return;}
  if(!data.currentPrompt){app.innerHTML=renderWaiting(data);pollWaiting();return;}
  stopWaiting();app.innerHTML=renderGuestStep(data);
}
function pollWaiting(){stopWaiting();waitingTimer=setInterval(()=>{if(!busy&&identity&&identity.role!=="JOIN")refreshGame(false);},3500);}
async function refreshGame(showFailure=true){
  if(!identity){showHome();return;}if(identity.role==="JOIN"){renderJoin();return;}
  try{renderGame(await request("/api/games/"+encodeURIComponent(identity.id),{token:identity.token}));}
  catch(error){if(showFailure){identity=null;showHome("Impossible de retrouver la partie : "+error.message);}}
}
async function joinGame(event){
  event.preventDefault();const form=event.currentTarget,rawName=new FormData(form).get("name"),name=typeof rawName==="string"?rawName.trim():"",button=form.querySelector("button");
  if(!name){document.querySelector("#join-error").textContent="Entre ton prénom ou un pseudo pour continuer.";return;}
  button.disabled=true;
  try{
    const joined=await request("/api/games/"+encodeURIComponent(identity.id)+"/join",{method:"POST",body:{name,invite:identity.invite}});
    rememberProfileName(name);storeIdentity({id:identity.id,role:"B",token:joined.token,guestId:joined.guestId,playerName:name});
    history.replaceState(null,"","?game="+encodeURIComponent(identity.id)+"&role=B");renderGame(joined.data);
  }catch(error){document.querySelector("#join-error").textContent=error.message;button.disabled=false;}
}
async function doRoll(button){
  setBusy(true);button.innerHTML='<span class="loading-dot"></span> Les dés roulent…';
  try{renderGame(await request("/api/games/"+encodeURIComponent(identity.id)+"/roll",{method:"POST",token:identity.token,body:{}}));}
  catch(error){toast(error.message);await refreshGame(false);}finally{busy=false;}
}
async function choose(choice){
  setBusy(true);
  try{renderGame(await request("/api/games/"+encodeURIComponent(identity.id)+"/choice",{method:"POST",token:identity.token,body:{choice}}));}
  catch(error){toast(error.message);await refreshGame(false);}finally{busy=false;}
}
function ensureInviteUrl(){
  if(identity.inviteUrl)return Promise.resolve(identity.inviteUrl);
  return request("/api/games/"+encodeURIComponent(identity.id)+"/invite",{token:identity.token}).then(result=>{identity.inviteUrl=result.url;storeIdentity(identity);return result.url;});
}
async function loadInvite(button,automatic=false){
  if(button){button.disabled=true;button.innerHTML='<span class="loading-dot"></span> Création du lien…';}
  try{const url=await ensureInviteUrl();const input=document.querySelector("#invite-url");if(input)input.value=url;if(!automatic)await refreshGame(false);}
  catch(error){toast(error.message);if(button)button.disabled=false;}
}
async function saveSetup(event){
  event.preventDefault();const personal=setupState.personal,situations=setupState.situations;
  const step=setupState.step,isPersonal=step<3,index=isPersonal?step:step-3,entry=setupState[isPersonal?"personal":"situations"][index];
  if(isPersonal&&entry.answerIndex===null){document.querySelector("#setup-error").textContent="Choisis une réponse pour continuer.";return;}
  if(!isPersonal&&(entry.idealIndex===null||entry.alternativeIndex===null||entry.idealIndex===entry.alternativeIndex)){document.querySelector("#setup-error").textContent="Choisis une priorité puis une alternative différente pour continuer.";return;}
  if(step<6){setupState.step+=1;app.innerHTML=renderSetup(game);document.querySelector("#setup-form").addEventListener("submit",saveSetup);return;}
  const button=event.currentTarget.querySelector('button[type="submit"]');button.disabled=true;
  try{await request("/api/games/"+encodeURIComponent(identity.id)+"/setup",{method:"POST",token:identity.token,body:{personal,situations}});setupState=null;await refreshGame();}
  catch(error){document.querySelector("#setup-error").textContent=error.message;button.disabled=false;}
}
async function answer(type,choiceIndex){
  setBusy(true);try{renderGame(await request("/api/games/"+encodeURIComponent(identity.id)+"/answer",{method:"POST",token:identity.token,body:{type,choiceIndex}}));}
  catch(error){toast(error.message);await refreshGame(false);}finally{busy=false;}
}
function selectPending(kind,value){
  const key=currentSelectionKey(game);if(!key)return;
  pendingSelection={key,kind,value};renderGame(game);
}
function cancelPending(){pendingSelection=null;renderGame(game);}
async function confirmPending(){
  if(!pendingSelection)return;
  const selection={...pendingSelection};pendingSelection=null;
  if(selection.kind==="dilemma")return choose(selection.value);
  return answer(selection.kind,selection.value);
}
async function copyInvite(){
  const value=document.querySelector("#invite-url")?.value||identity.inviteUrl;if(!value)return;
  try{await navigator.clipboard.writeText(value);}catch{const input=document.querySelector("#invite-url");if(input){input.select();document.execCommand("copy");}}
  toast("Lien copié. Envoie le même à chacun de tes amis.");
}
function setSetupAnswer(action,index,choiceIndex){
  if(!setupState)return;
  if(action==="personal")setupState.personal[index].answerIndex=choiceIndex;
  else{const entry=setupState.situations[index];if(entry.idealIndex===null)entry.idealIndex=choiceIndex;else if(entry.alternativeIndex===null&&entry.idealIndex!==choiceIndex)entry.alternativeIndex=choiceIndex;else return;}
  app.innerHTML=renderSetup(game);document.querySelector("#setup-form").addEventListener("submit",saveSetup);
}
function resetSituation(index){
  if(!setupState)return;
  setupState.situations[index].idealIndex=null;setupState.situations[index].alternativeIndex=null;
  app.innerHTML=renderSetup(game);document.querySelector("#setup-form").addEventListener("submit",saveSetup);
}
function handleChange(event){
  const select=event.target.closest("select[data-setup-kind]");if(!select||!setupState)return;
  const kind=select.dataset.setupKind,index=Number(select.dataset.setupIndex);setupState[kind][index].id=select.value;
  if(kind==="personal")setupState.personal[index].answerIndex=null;else{setupState.situations[index].idealIndex=null;setupState.situations[index].alternativeIndex=null;}
  app.innerHTML=renderSetup(game);document.querySelector("#setup-form").addEventListener("submit",saveSetup);
}
async function handleClick(event){
  const button=event.target.closest("button[data-action]");if(!button||busy)return;const action=button.dataset.action;
  if(action==="roll")return doRoll(button);if(action==="select-choice")return selectPending("dilemma",button.dataset.choice);
  if(action==="confirm-selection")return confirmPending();if(action==="cancel-selection")return cancelPending();
  if(action==="copy-invite")return copyInvite();if(action==="load-invite")return loadInvite(button);
  if(action==="select-answer")return selectPending(button.dataset.type,Number(button.dataset.choiceIndex));
  if(action==="set-personal")return setSetupAnswer("personal",Number(button.dataset.index),Number(button.dataset.choiceIndex));
  if(action==="set-key")return setSetupAnswer("situation",Number(button.dataset.index),Number(button.dataset.choiceIndex));
  if(action==="reset-situation")return resetSituation(Number(button.dataset.index));
  if(action==="setup-back"&&setupState){setupState.step=Math.max(0,setupState.step-1);app.innerHTML=renderSetup(game);document.querySelector("#setup-form").addEventListener("submit",saveSetup);return;}
  if(action==="new-game"){stopWaiting();identity=null;game=null;setupState=null;pendingSelection=null;localStorage.removeItem(storagePrefix+"last");history.replaceState(null,"",location.pathname);showHome();}
}
leaveButton.addEventListener("click",()=>{stopWaiting();identity=null;game=null;pendingSelection=null;localStorage.removeItem(storagePrefix+"last");history.replaceState(null,"",location.pathname);showHome();});
app.addEventListener("click",handleClick);app.addEventListener("change",handleChange);
(async function init(){try{banks=await request("/api/banks");identity=restoreIdentity();if(identity)await refreshGame();else showHome();}catch(error){showHome("Impossible de charger les questions : "+error.message);}})();

