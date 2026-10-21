
const app = document.querySelector("#app");
const leaveButton = document.querySelector("#leave-game");
const topbarLabel = document.querySelector("#topbar-label");
const storagePrefix = "trust-game:";
// Pilote l'affichage du contenu éditorial de l'accueil, placé hors de #app
// pour ne pas être détruit par les rafraîchissements de l'écran.
function syncView(){
  const home=!app.children.length||!!app.querySelector(".home-grid");
  document.body.classList.toggle("in-game",!home);
  document.body.classList.toggle("has-results",!!app.querySelector(".results-page"));
}
new MutationObserver(syncView).observe(app,{childList:true});
syncView();

let identity = null, banks = null, setupState = null, waitingTimer = null, busy = false, toastTimer = null, game = null, resultsSignature = null, pendingSelection = null;
let resultUiState = { query: "", openGuestId: null };
const icons = {
  arrow:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  lock:'<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="2"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/></svg>',
  people:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 5.5a3 3 0 0 1 0 5.8M17 14a5 5 0 0 1 3.5 4.8"/></svg>',
  dice:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M8 8h.01M16 8h.01M12 12h.01M8 16h.01M16 16h.01"/></svg>',
  sparkle:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/><path d="m19 15 .8 2.2L22 18l-2.2.8L19 15Z"/></svg>'
};
function esc(value=""){return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function searchText(value=""){return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase();}
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
  <div class="home-notes"><span class="note-pill">${icons.dice} 10 étapes</span><span class="note-pill">${icons.people} Un lien pour le groupe</span><span class="note-pill">${icons.lock} Choix cachés</span></div></div>
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
function serpentVisual(){
  return `<div class="serpent-visual" aria-hidden="true"><svg class="serpent-illustration" viewBox="0 0 96 96" role="presentation"><circle class="serpent-aura" cx="48" cy="48" r="38"/><path class="serpent-body" pathLength="1" d="M19 71C8 59 12 39 27 33c13-5 27 3 27 15 0 10-11 16-19 10-7-5-3-16 5-15 8 1 10 10 6 16-7 10-1 22 11 22 13 0 23-10 21-22-2-12-11-20-20-24-9-4-17-4-23-6"/><path class="serpent-tail" d="M20 71l-7 5 8 1"/><g class="serpent-head"><path class="serpent-face" d="M37 27c0-8 7-14 16-14 8 0 15 5 15 12 0 7-8 11-16 11-8 0-15-3-15-9Z"/><circle class="serpent-eye" cx="57" cy="20" r="2.2"/><circle class="serpent-eye-glint" cx="57.7" cy="19.3" r=".65"/><path class="serpent-tongue" d="M67 27c5 1 8 3 10 5m-4-4 4-4m-4 4 5 2"/></g><path class="serpent-scale" d="M24 48c4-3 8-3 12 0m8 13c4-3 8-3 12 0m11 5c4-3 8-3 12 0"/></svg></div>`;
}
function serpentPanel(hint,locked,turn){
  if(locked){
    const rewardedEnabled=window.SerpentAds?.enabled===true;
    return `<aside class="serpent-hint serpent-locked" aria-label="Indice verrouillé du Serpent du doute">${serpentVisual()}<div class="serpent-copy"><span class="serpent-label">UNE TÂCHE POUR OBTENIR SON AIDE</span><strong class="serpent-title">Le Serpent garde son indice.</strong><p>Il connaît le choix de A pour ce dilemme. Tu peux le regarder révéler son indice après une action.</p>${rewardedEnabled?`<button type="button" class="primary-button serpent-task-button" data-action="serpent-rewarded" data-turn="${turn}">Demander une publicité récompensée</button><p class="serpent-task-note">Si une annonce est disponible, regarde-la jusqu'au bout pour obtenir l'indice.</p><button type="button" class="secondary-button serpent-task-button hidden" data-action="serpent-ad-confirm" data-turn="${turn}" data-serpent-ad-confirm>Oui, lancer la publicité</button><button type="button" class="secondary-button serpent-task-button hidden" data-action="serpent-task" data-turn="${turn}" data-serpent-share-fallback>Partager le lien à la place</button>`:`<button type="button" class="primary-button serpent-task-button" data-action="serpent-task" data-turn="${turn}">Partager le lien et révéler l'indice</button><p class="serpent-task-note">La publicité récompensée sera proposée lorsque l'accès H5 Games et le message de consentement seront activés.</p>`}<p class="serpent-task-error" data-serpent-task-error role="alert"></p></div></aside>`;
  }
  if(!hint)return "";
  return `<aside class="serpent-hint" aria-label="Indice du Serpent du doute">${serpentVisual()}<div class="serpent-copy"><span class="serpent-label">UN INDICE À PRENDRE AVEC DU RECUL</span><strong class="serpent-title">Le Serpent du doute</strong><p>Il murmure que <b>A a choisi…</b></p><span class="serpent-whisper">${esc(hint.said)}</span><p class="serpent-disclaimer">Il dit vrai environ 6 fois sur 10. Il peut aussi mentir. Cet indice ne change pas ton score.</p></div></aside>`;
}
function scenarioCard(round,role,hint=null,serpentLocked=false){
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
  ${serpentPanel(hint,serpentLocked,round.turn)}
  <p class="choice-prompt">Sélectionne ta décision, puis confirme-la.</p><div class="choice-row">
  <button type="button" class="choice-button ${selected==="PARTAGER"?"selected":""}" aria-pressed="${selected==="PARTAGER"}" data-action="select-choice" data-choice="PARTAGER"><span class="choice-icon">↗</span> PARTAGER</button>
  <button type="button" class="choice-button steal ${selected==="VOLER"?"selected":""}" aria-pressed="${selected==="VOLER"}" data-action="select-choice" data-choice="VOLER"><span class="choice-icon">↘</span> VOLER</button></div>
  ${selected?selectionConfirmation():`<p class="locked-note">${icons.lock} Un clic sélectionne seulement; rien n'est envoyé avant ta confirmation.</p>`}</article>`;
}
function sidePanel(data){
  return `<aside><section class="sidebar-card"><h2 class="side-title">Ta partie</h2>
  <div class="player-row"><div class="player-info"><span class="avatar">A</span><div><div class="player-name">${esc(data.myName)} <small>(toi)</small></div><div class="player-state">Tes choix restent cachés aux invités</div></div></div><span class="mini-count">${data.myCompleted}/3</span></div>
  <div class="player-row"><div class="player-info"><span class="avatar alt">${data.guestCount}</span><div><div class="player-name">Amis invités</div><div class="player-state">${data.completedGuests} sur ${data.guestCount} ont terminé</div></div></div><span class="mini-count">${data.guestCount}</span></div></section>
  <section class="sidebar-card howto-card"><h2 class="side-title">Les 10 étapes</h2><ol class="howto-list"><li><span class="howto-num">1</span><span>A joue ses trois dilemmes puis prépare les questions.</span></li><li><span class="howto-num">2</span><span>Chaque ami répond seul aux mêmes questions, sans voir les clés.</span></li><li><span class="howto-num">3</span><span>Dès qu'un ami termine, l'hôte voit son résultat. Le classement évolue au fil des arrivées.</span></li></ol></section></aside>`;
}
function renderHostTurn(data){
  const current=data.myRounds.at(-1);
  if(current&&!current.choiceLocked)return `<div class="game-layout"><section class="game-main"><div class="game-heading"><div><p class="eyebrow">À toi, ${esc(data.myName)}</p><h1 class="game-title">Le dilemme ${current.turn}.</h1><p class="game-subtitle">Les dés ont fixé le scénario. Lis les conséquences avant de choisir.</p></div><span class="turn-badge">${current.turn} / 3</span></div>${progressBars(data.myCompleted)}${scenarioCard(current,"A")}</section>${sidePanel(data)}</div>`;
  const turn=data.myCompleted+1;
  return `<div class="game-layout"><section class="game-main"><div class="game-heading"><div><p class="eyebrow">À toi, ${esc(data.myName)}</p><h1 class="game-title">Un choix à la fois.</h1><p class="game-subtitle">Les trois dilemmes monteront progressivement en intensité.</p></div><span class="turn-badge">Dilemme ${turn} / 3</span></div>${progressBars(data.myCompleted)}
  <section class="game-card"><div class="dice-header"><span>Le prochain scénario</span><span>Deux dés · six faces</span></div>${renderDice(null)}<button class="primary-button full-width" data-action="roll">Lancer les dés ${icons.arrow}</button><p class="locked-note">${icons.lock} Tes choix restent cachés aux invités.</p></section></section>${sidePanel(data)}</div>`;
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
  <h1 class="waiting-title">Un lien pour tout le groupe.</h1><p class="waiting-copy">Partage le même lien avec tes amis. Il n'y a pas de plafond fixé dans le jeu; la capacité dépend de l'hébergement. Toi, l'organisateur, tu peux consulter chaque résultat dès que la personne termine. Le classement se met à jour automatiquement, sans clôturer les inscriptions.</p>
  ${link}${guests}${data.guestCount>12?`<p class="invite-hint">Cette liste montre les 12 premiers inscrits. Le classement complet apparaît dans l'écran des résultats.</p>`:""}<div class="waiting-indicator">${data.guestCount} ami${data.guestCount===1?"":"s"} inscrit${data.guestCount===1?"":"s"} · ${data.completedGuests} terminé${data.completedGuests===1?"":"s"}</div><p class="invite-hint">Le Serpent donne un indice distinct à chacun des trois dilemmes. Tous les amis reçoivent les mêmes indices; chacun peut dire vrai ou mentir, sans changer le score.</p></div></section>`;
}
function renderJoin(){
  stopWaiting();setTopbar(false);
  app.innerHTML=`<section class="waiting-layout"><div class="waiting-card"><div class="waiting-icon">${icons.lock}</div><p class="eyebrow">Invitation privée</p><h1 class="waiting-title">Tu as été invité à jouer.</h1><p class="waiting-copy">Tu répondras à 3 dilemmes, 3 questions personnelles et 4 situations. L'organisateur verra tes réponses et ton résultat quand tu auras terminé. Les autres invités ne verront pas tes choix.</p>
  <form id="join-form" class="join-form"><label class="form-label" for="join-name">Ton prénom ou un pseudo</label><input class="text-input" id="join-name" name="name" maxlength="32" autocomplete="nickname" placeholder="Par exemple, Sam" value="${esc(savedProfileName())}" required/><p class="error-message" id="join-error" role="alert"></p><button class="primary-button full-width" type="submit">Rejoindre la partie ${icons.arrow}</button><p class="invite-hint">Ton pseudo sera retenu dans ce navigateur. Rouvre ce lien sur cet appareil pour retrouver cette partie.</p></form></div></section>`;
  document.querySelector("#join-form").addEventListener("submit",joinGame);
}
function renderGuestStep(data){
  const step=data.progress+1,p=data.currentPrompt;
  if(!p)return renderGuestCompleted(data);
  const title=p.type==="dilemma"?"Un choix difficile.":p.type==="personal"?`Connais-tu ${esc(data.otherName)} ?`:`Que ferais-tu pour ${esc(data.otherName)} ?`;
  const header=`<div class="game-heading"><div><p class="eyebrow">À toi, ${esc(data.myName)}</p><h1 class="game-title">${title}</h1><p class="game-subtitle">L'organisateur ne verra le détail de tes choix qu'après tes 10 réponses. Les autres invités ne les verront pas.</p></div><span class="turn-badge">Étape ${step} / 10</span></div>`;
  if(p.type==="dilemma")return `<div class="game-layout"><section class="game-main">${header}${progressBars(data.progress,10)}${scenarioCard(p.round,"B",p.serpentHint,p.serpentLocked)}</section>${sidePanelGuest(data)}</div>`;
  const q=p.question,selectionKey=`B:${p.type}:${p.index}`,selected=pendingSelection?.key===selectionKey?pendingSelection.value:null;
  return `<section class="guest-question">${header}${progressBars(data.progress,10)}<article class="game-card question-card"><p class="eyebrow">${p.type==="personal"?`Question sur ${esc(data.otherName)}`:"Situation pour l'hôte"} · ${p.index+1} / ${p.type==="personal"?3:4}</p>
  ${p.type==="situation"?`<h2 class="scenario-title">${esc(q.title)}</h2>`:""}<h2 class="question-prompt">${p.type==="personal"?`« ${esc(data.otherName)} te demande : ${esc(q.prompt)} »`:esc(q.prompt)}</h2><p class="setup-hint">${p.type==="personal"?`Tu devines la réponse de ${esc(data.otherName)}. Dans la question et les propositions, « je/me » désigne ${esc(data.otherName)}.`:`Tu réponds à la place de ${esc(data.otherName)} : « je/me » désigne l'hôte. Choisis ce que tu ferais pour l'hôte.`}</p>
  <div class="guest-options">${q.options.map((option,i)=>`<button type="button" class="guest-option ${selected===i?"selected":""}" aria-pressed="${selected===i}" data-action="select-answer" data-type="${p.type}" data-choice-index="${i}"><span class="option-index">${String.fromCharCode(65+i)}</span><span>${esc(option)}</span><span class="option-arrow">›</span></button>`).join("")}</div>${selected!==null?selectionConfirmation():`<p class="locked-note">${icons.lock} Choisis une réponse, puis confirme pour l'envoyer.</p>`}</article></section>`;
}
function renderGuestCompleted(data){
  if(!data.ownResult)return `<section class="waiting-layout"><div class="waiting-card"><div class="waiting-icon">${icons.lock}</div><p class="eyebrow">Tes réponses sont enregistrées</p><h1 class="waiting-title">C'est terminé, ${esc(data.myName)}.</h1><p class="waiting-copy">Ton résultat personnel se prépare.</p></div></section>`;
  return `<section class="results-page"><div class="result-header"><div><p class="eyebrow">Résultat privé de ${esc(data.myName)}</p><h1 class="game-title">Ton bilan est prêt.</h1><p class="game-subtitle">Tu vois ton score et le détail de tes réponses. Le classement des autres invités reste réservé à l'organisateur.</p></div><span class="result-tag">${icons.lock} Personnel</span></div>${renderMatch(data.ownResult,true)}<div class="result-actions"><button class="primary-button" data-action="new-game">Créer ma partie et inviter mes amis ${icons.arrow}</button></div></section>`;
}
function sidePanelGuest(data){
  return `<aside><section class="sidebar-card"><h2 class="side-title">Ta progression</h2><div class="player-row"><div class="player-info"><span class="avatar alt">${esc(data.myName.slice(0,1).toUpperCase())}</span><div><div class="player-name">${esc(data.myName)} <small>(toi)</small></div><div class="player-state">L'hôte verra tes choix à la fin</div></div></div><span class="mini-count">${data.progress}/10</span></div><div class="player-row"><div class="player-info"><span class="avatar">A</span><div><div class="player-name">${esc(data.otherName)}</div><div class="player-state">Ses réponses restent cachées</div></div></div><span class="mini-count">•••</span></div></section></aside>`;
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
  const serpentHints=match.serpentHints|| (match.serpent?[match.serpent]:[]);
  const dilemmas=match.dilemmas.map(item=>`<article class="pair-card"><div class="pair-player"><div class="pair-topline">Dilemme ${item.turn} · ${esc(item.scenario.title)}</div><div class="pair-choice">${esc(item.hostChoice)}</div></div><div class="pair-player"><div class="pair-topline">Réponse de ${esc(match.name)}</div><div class="pair-choice ${item.guestChoice==="VOLER"?"steal":""}">${esc(item.guestChoice)}</div></div><div class="pair-verdict"><span class="verdict-icon ${item.trustPercent!==100?"mixed":""}">${item.trustPercent}%</span>${item.points} / 10 pts</div></article>`).join("");
  return `<article class="match-result"><div class="match-title"><div><p class="eyebrow">${guestView?"Ton score":"Partie de "+esc(match.name)}</p><h2>${s.total}<small> / 100</small></h2></div><span class="result-tag">${guestView?`${match.trust.percent}% · ${esc(match.trust.label)}`:"Résultat de jeu"}</span></div>
  <div class="score-breakdown"><div><b>${s.dilemmas.points} / 30</b><span>Dilemmes</span></div><div><b>${s.personal.points} / 30</b><span>Personnelles · ${s.personal.correct}/3</span></div><div><b>${s.situations.points} / 40</b><span>Situations · ${s.situations.ideal} idéales, ${s.situations.alternative} alternatives</span></div></div>
  <div class="result-grid"><article class="metric-card"><div class="metric-label">Coopération · décisions</div><div class="metric-value-row"><span class="metric-value">${match.cooperation.percent}%</span><span class="metric-detail">${match.cooperation.shared} / 6 choix PARTAGER</span></div><p class="metric-caption">Nombre de PARTAGER parmi les trois choix de l'hôte et les trois tiens.</p></article>
  <article class="metric-card trust"><div class="metric-label">Confiance dans cette partie</div><div class="metric-value-row"><span class="metric-value">${match.trust.percent}%</span><span class="metric-detail">${esc(match.trust.label)}</span></div><p class="metric-caption">${esc(match.trust.message)} Chaque dilemme vaut 100 % si vous partagez tous les deux, 25 % si vos choix s'opposent, 0 % si vous volez tous les deux. Le chiffre affiché est la moyenne des trois.</p></article></div>
  <details class="formula-details"><summary>Voir les réserves et le détail des dilemmes</summary>${match.trust.reserve.length?`<ul>${match.trust.reserve.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`:`<p>Aucun choix divergent ou double VOLER lors de ces dilemmes.</p>`}<div class="pair-list">${dilemmas}</div></details>
  <section class="pair-section"><div class="section-heading"><h2>Réponses personnelles</h2><p>10 points par correspondance</p></div>${answerReviews(match.personal,"personal",guestView)}</section>
  <section class="pair-section"><div class="section-heading"><h2>Mises en situation</h2><p>Idéale 10 · alternative 5 · autre 0</p></div>${answerReviews(match.situations,"situation",guestView)}</section>
  ${serpentHints.length?`<aside class="serpent-result"><h3>Les trois indices du Serpent du doute</h3>${serpentHints.map(hint=>`<p><b>Dilemme ${hint.turn} :</b> il annonçait que A avait choisi <b>${esc(hint.said)}</b>. C'était ${hint.wasTrue?"vrai":"l'inverse"} : A avait choisi <b>${esc(hint.actual)}</b>.</p>`).join("")}<p>Les mêmes indices étaient proposés à tous les amis. Ils ne changent aucun point.</p></aside>`:""}</article>`;
}
function renderResults(data){
  const results=data.results,leaderboard=results.leaderboard||[];
  const liveStatus=`${data.completedGuests} / ${data.guestCount} amis inscrits ont terminé. Le classement s'actualise quand un autre ami finit.`;
  const invitePanel=`<div class="invite-box">${identity.inviteUrl?`<input class="invite-url" id="invite-url" readonly value="${esc(identity.inviteUrl)}" aria-label="Lien d'invitation"/><button class="secondary-button" data-action="copy-invite">Copier le lien</button>`:`<button class="primary-button" data-action="load-invite">Créer le lien pour inviter d'autres amis ${icons.arrow}</button>`}</div><p class="invite-hint">Tu peux continuer à partager ce lien : les résultats apparaissent ici dès qu'un ami termine.</p>`;
  return `<section class="results-page"><div class="result-header"><div><p class="eyebrow">Classement privé de l'organisateur</p><h1 class="game-title">Les résultats évoluent.</h1><p class="game-subtitle">Tu es le seul à voir le classement et les réponses détaillées. Les scores décrivent cette partie, pas la personnalité.</p></div><span class="result-tag">${icons.sparkle} En direct</span></div>
  <div class="waiting-indicator">${liveStatus}</div>${invitePanel}
  <section class="leaderboard"><div class="section-heading"><h2>Classement des amis</h2><p>Score sur 100 · les égalités partagent le rang</p></div><label class="leaderboard-search"><span>Rechercher un ami</span><input id="leaderboard-search" class="text-input" type="search" placeholder="Prénom ou pseudo" value="${esc(resultUiState.query)}" autocomplete="off"/></label><p class="leaderboard-empty" hidden>Aucun ami ne correspond à cette recherche.</p>${leaderboard.map(x=>`<div class="leader-row" data-rank-name="${esc(searchText(x.name))}"><span class="rank-badge">${x.rank}</span><strong>${esc(x.name)}</strong><b>${x.total} <small>/100</small></b></div>`).join("")}</section>
  <section class="match-accordion-list"><div class="section-heading"><h2>Détail des parties</h2><p>Sélectionne un nom pour lire ses réponses.</p></div><p class="leaderboard-empty" hidden>Aucun ami ne correspond à cette recherche.</p>${leaderboard.map(entry=>`<details class="match-accordion" data-match-id="${esc(entry.guestId)}" data-match-name="${esc(searchText(entry.name))}" ${resultUiState.openGuestId===entry.guestId?"open":""}><summary><span class="rank-badge">${entry.rank}</span><strong>${esc(entry.name)}</strong><span class="accordion-score">${entry.total} <small>/100</small><em>Lire les réponses</em></span></summary><div class="match-accordion-content" data-match-content></div></details>`).join("")}</section>
  <div class="result-note">${icons.sparkle}<p><strong>Partager ne garantit pas une victoire individuelle.</strong> Les scores comparent les réponses dans ce jeu. Le pourcentage de confiance est un indicateur ludique fondé uniquement sur les trois dilemmes, pas une vérité scientifique sur le caractère ou la fiabilité d'une personne.</p></div>
  <div class="result-actions"><button class="secondary-button" data-action="new-game">Créer une nouvelle partie ${icons.arrow}</button></div></section>`;
}
function hydrateMatchDetails(details=app.querySelector(".match-accordion[open]:not([data-rendered])")){
  if(!details)return;
  const match=game?.results?.matches?.find(item=>item.guestId===details.dataset.matchId);if(!match)return;
  const content=details.querySelector("[data-match-content]");if(!content)return;
  content.innerHTML=renderMatch(match);details.dataset.rendered="true";
}
function filterResults(query){
  const normalized=searchText(query.trim());
  app.querySelectorAll("[data-rank-name]").forEach(row=>{row.hidden=!row.dataset.rankName.includes(normalized);});
  const details=[...app.querySelectorAll(".match-accordion[data-match-name]")];
  details.forEach(row=>{row.hidden=!row.dataset.matchName.includes(normalized);});
  app.querySelectorAll(".leaderboard-empty").forEach(item=>{item.hidden=!normalized||details.some(row=>row.dataset.matchName.includes(normalized));});
}
function renderGame(data){
  game=data;setTopbar(true);
  if(pendingSelection&&pendingSelection.key!==currentSelectionKey(data))pendingSelection=null;
  if(data.readyToReveal){
    if(data.role==="B"){stopWaiting();app.innerHTML=renderGuestCompleted(data);return;}
    const signature=JSON.stringify([data.results?.leaderboard?.map(({guestId,total,rank})=>[guestId,total,rank]),data.completedGuests,data.guestCount,identity?.inviteUrl]);
    if(signature!==resultsSignature||!app.querySelector(".results-page")){app.innerHTML=renderResults(data);resultsSignature=signature;filterResults(resultUiState.query);hydrateMatchDetails();}
    pollWaiting();return;
  }
  resultsSignature=null;
  if(data.role==="A"&&data.myCompleted<3){stopWaiting();app.innerHTML=renderHostTurn(data);return;}
  if(data.role==="A"&&!data.setupDone){stopWaiting();app.innerHTML=renderSetup(data);document.querySelector("#setup-form").addEventListener("submit",saveSetup);return;}
  if(data.role==="A"){app.innerHTML=renderInvite(data);if(!identity.inviteUrl&&data.canInvite)loadInvite(null,true);pollWaiting();return;}
  if(!data.currentPrompt){app.innerHTML=renderGuestCompleted(data);return;}
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
  // On indique l'étape validée : le serveur refuse un doublon (double clic, deux onglets).
  const position=game.role==="A"?{turn:game.myRounds.at(-1)?.turn}:{step:game.progress};
  try{renderGame(await request("/api/games/"+encodeURIComponent(identity.id)+"/choice",{method:"POST",token:identity.token,body:{choice,...position}}));}
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
  setBusy(true);try{renderGame(await request("/api/games/"+encodeURIComponent(identity.id)+"/answer",{method:"POST",token:identity.token,body:{type,choiceIndex,step:game.progress}}));}
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
async function copyText(value){
  if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(value);return;}
  const input=document.createElement("textarea");input.value=value;input.setAttribute("readonly","");input.style.position="fixed";input.style.opacity="0";document.body.appendChild(input);input.select();
  const copied=document.execCommand("copy");input.remove();if(!copied)throw new Error("Copie impossible dans ce navigateur.");
}
async function doSerpentTask(button){
  const turn=Number(button.dataset.turn),shareUrl=new URL(game.shareInvitePath,location.origin).toString();
  setBusy(true);
  try{
    const shareData={title:"Est-ce que je peux te faire confiance ?",text:"Rejoins-moi dans cette partie :",url:shareUrl};
    if(navigator.share){
      try{await navigator.share(shareData);}catch(error){if(error.name==="AbortError")throw error;await copyText(shareUrl);}
    }else await copyText(shareUrl);
    const updated=await request("/api/games/"+encodeURIComponent(identity.id)+"/serpent-task",{method:"POST",token:identity.token,body:{turn,task:"share-invite"}});
    renderGame(updated);
  }catch(error){
    const message=error.name==="AbortError"?"Partage annulé : le Serpent garde son indice.":"Le lien n'a pas pu être partagé ou copié. Réessaie pour obtenir l'indice.";
    const errorBox=button.closest(".serpent-hint")?.querySelector("[data-serpent-task-error]");if(errorBox)errorBox.textContent=message;
  }finally{busy=false;app.querySelectorAll("button").forEach(item=>item.disabled=false);}
}
async function doSerpentReward(button){
  const turn=Number(button.dataset.turn),panel=button.closest(".serpent-hint"),errorBox=panel?.querySelector("[data-serpent-task-error]"),confirmButton=panel?.querySelector("[data-serpent-ad-confirm]"),fallbackButton=panel?.querySelector("[data-serpent-share-fallback]");
  if(!window.SerpentAds?.enabled){if(errorBox)errorBox.textContent="La publicité récompensée n'est pas encore disponible.";return;}
  setBusy(true);
  if(errorBox)errorBox.textContent="Recherche d'une publicité disponible…";
  try{
    const result=await window.SerpentAds.requestRewarded(turn,()=>{
      if(errorBox)errorBox.textContent="Une publicité est disponible. Confirme pour la regarder jusqu'au bout.";
      if(confirmButton){confirmButton.hidden=false;confirmButton.disabled=false;}
    });
    if(result.status==="viewed"){
      const updated=await request("/api/games/"+encodeURIComponent(identity.id)+"/serpent-task",{method:"POST",token:identity.token,body:{turn,task:"rewarded-ad"}});
      renderGame(updated);
      return;
    }
    if(confirmButton)confirmButton.hidden=true;
    if(fallbackButton)fallbackButton.hidden=false;
    if(errorBox)errorBox.textContent=result.status==="dismissed"?"Tu as fermé la publicité avant la fin. Le Serpent garde son indice; tu peux partager le lien à la place.":"Aucune publicité n'a pu être terminée. Réessaie plus tard ou partage le lien à la place.";
  }catch(error){
    if(confirmButton)confirmButton.hidden=true;
    if(fallbackButton)fallbackButton.hidden=false;
    if(errorBox)errorBox.textContent="La publicité n'a pas pu démarrer. Réessaie ou partage le lien à la place.";
  }finally{busy=false;app.querySelectorAll("button").forEach(item=>item.disabled=false);}
}
function confirmSerpentAd(button){
  const turn=Number(button.dataset.turn),panel=button.closest(".serpent-hint"),errorBox=panel?.querySelector("[data-serpent-task-error]");
  if(!window.SerpentAds?.showRewarded(turn)){
    if(errorBox)errorBox.textContent="Cette publicité n'est plus disponible. Réessaie ou partage le lien à la place.";
    const fallbackButton=panel?.querySelector("[data-serpent-share-fallback]");if(fallbackButton)fallbackButton.hidden=false;
    return;
  }
  button.hidden=true;
  if(errorBox)errorBox.textContent="La publicité est en cours. Termine-la pour recevoir l'indice.";
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
  const button=event.target.closest("button[data-action]");if(!button)return;const action=button.dataset.action;if(busy&&action!=="serpent-ad-confirm")return;
  if(action==="roll")return doRoll(button);if(action==="select-choice")return selectPending("dilemma",button.dataset.choice);
  if(action==="confirm-selection")return confirmPending();if(action==="cancel-selection")return cancelPending();
  if(action==="serpent-task")return doSerpentTask(button);
  if(action==="serpent-rewarded")return doSerpentReward(button);
  if(action==="serpent-ad-confirm")return confirmSerpentAd(button);
  if(action==="copy-invite")return copyInvite();if(action==="load-invite")return loadInvite(button);
  if(action==="select-answer")return selectPending(button.dataset.type,Number(button.dataset.choiceIndex));
  if(action==="set-personal")return setSetupAnswer("personal",Number(button.dataset.index),Number(button.dataset.choiceIndex));
  if(action==="set-key")return setSetupAnswer("situation",Number(button.dataset.index),Number(button.dataset.choiceIndex));
  if(action==="reset-situation")return resetSituation(Number(button.dataset.index));
  if(action==="setup-back"&&setupState){setupState.step=Math.max(0,setupState.step-1);app.innerHTML=renderSetup(game);document.querySelector("#setup-form").addEventListener("submit",saveSetup);return;}
  if(action==="new-game"){stopWaiting();identity=null;game=null;setupState=null;pendingSelection=null;resultUiState={query:"",openGuestId:null};localStorage.removeItem(storagePrefix+"last");history.replaceState(null,"",location.pathname);showHome();}
}
leaveButton.addEventListener("click",()=>{stopWaiting();identity=null;game=null;pendingSelection=null;resultUiState={query:"",openGuestId:null};localStorage.removeItem(storagePrefix+"last");history.replaceState(null,"",location.pathname);showHome();});
app.addEventListener("click",handleClick);app.addEventListener("change",handleChange);
app.addEventListener("input",event=>{if(event.target.id==="leaderboard-search"){resultUiState.query=event.target.value;filterResults(resultUiState.query);}});
app.addEventListener("toggle",event=>{const details=event.target.closest?.("details.match-accordion");if(!details)return;if(details.open){resultUiState.openGuestId=details.dataset.matchId;hydrateMatchDetails(details);}else if(resultUiState.openGuestId===details.dataset.matchId)resultUiState.openGuestId=null;},true);
(async function init(){try{banks=await request("/api/banks");identity=restoreIdentity();if(identity)await refreshGame();else showHome();}catch(error){showHome("Impossible de charger les questions : "+error.message);}})();
