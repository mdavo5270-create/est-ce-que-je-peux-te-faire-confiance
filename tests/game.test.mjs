
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, unlinkSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createGameServer } from "../server.mjs";
import { scenarios } from "../scenarios.mjs";
import { personalQuestions, situations, validateQuizBanks } from "../quiz-banks.mjs";

async function startServer(t, dataFile = null) {
  const server = createGameServer({ dataFile });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return { server, base: "http://127.0.0.1:" + server.address().port };
}
async function api(base, path, options = {}) {
  const response = await fetch(base + path, {
    method: options.method || "GET",
    headers: { ...(options.token ? { authorization: "Bearer " + options.token } : {}), ...(options.body ? { "content-type": "application/json" } : {}) },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  return { status: response.status, data: await response.json() };
}
const setupBody = {
  personal: personalQuestions.slice(0, 3).map((item) => ({ id: item.id, answerIndex: 0 })),
  situations: situations.slice(0, 4).map((item) => ({ id: item.id, idealIndex: 0, alternativeIndex: 1 }))
};
async function createHost(base, { choices = ["PARTAGER", "PARTAGER", "PARTAGER"] } = {}) {
  const created = await api(base, "/api/games", { method: "POST", body: { name: "Alex" } });
  assert.equal(created.status, 201);
  const { id, token } = created.data;
  const rounds = [];
  for (const choice of choices) {
    const rolled = await api(base, "/api/games/" + id + "/roll", { method: "POST", token, body: {} });
    assert.equal(rolled.status, 201);
    rounds.push(rolled.data.myRounds.at(-1));
    const saved = await api(base, "/api/games/" + id + "/choice", { method: "POST", token, body: { choice } });
    assert.equal(saved.status, 200);
  }
  return { id, token, rounds };
}
async function prepareHost(base, options = {}) {
  const host = await createHost(base, options);
  const saved = await api(base, "/api/games/" + host.id + "/setup", { method: "POST", token: host.token, body: setupBody });
  assert.equal(saved.status, 200);
  const invite = await api(base, "/api/games/" + host.id + "/invite", { token: host.token });
  assert.equal(invite.status, 200);
  return { ...host, invite: new URL(invite.data.url).searchParams.get("invite") };
}
async function joinGuest(base, id, invite, name) {
  const joined = await api(base, "/api/games/" + id + "/join", { method: "POST", body: { invite, name } });
  assert.equal(joined.status, 201);
  return { token: joined.data.token, guestId: joined.data.guestId, view: joined.data.data };
}
async function playGuest(base, id, guest, { dilemmaChoices = ["PARTAGER", "PARTAGER", "PARTAGER"], personalChoices = [0, 0, 0], situationChoices = [0, 0, 0, 0] } = {}) {
  const questions = [], rounds = [], hints = [];
  let view = guest.view, dilemmaIndex = 0, personalIndex = 0, situationIndex = 0;
  const expectedTypes = ["personal", "situation", "dilemma", "personal", "situation", "dilemma", "personal", "situation", "dilemma", "situation"];
  for (let step = 0; step < 10; step += 1) {
    const prompt = view.currentPrompt;
    assert.ok(prompt, "each of the ten steps has a prompt before the answer");
    assert.equal(prompt.type, expectedTypes[step]);
    let result;
    if (prompt.type === "dilemma") {
      rounds.push(prompt.round);
      if (prompt.serpentHint) hints.push(prompt.serpentHint);
      result = await api(base, "/api/games/" + id + "/choice", { method: "POST", token: guest.token, body: { choice: dilemmaChoices[dilemmaIndex++] } });
    } else {
      questions.push(prompt);
      const choiceIndex = prompt.type === "personal" ? personalChoices[personalIndex++] : situationChoices[situationIndex++];
      result = await api(base, "/api/games/" + id + "/answer", { method: "POST", token: guest.token, body: { type: prompt.type, choiceIndex } });
    }
    assert.equal(result.status, 200);
    view = result.data;
  }
  assert.equal(view.progress, 10);
  assert.equal(view.currentPrompt, null);
  return { view, questions, rounds, hints };
}

test("the personal bank has fifty five-option cards and the situation bank fifty four-option cards", () => {
  assert.equal(validateQuizBanks(), true);
  assert.equal(personalQuestions.length, 50);
  assert.equal(situations.length, 50);
  for (const item of personalQuestions) {
    assert.equal(item.options.length, 5);
    assert.equal(item.options[4], "Aucune de ces réponses");
    assert.equal(new Set(item.options).size, 5);
  }
  assert.equal(personalQuestions[0].prompt, "Quelle boisson préfères-tu ?");
  assert.equal(personalQuestions[0].guestPrompt, "Selon toi, quelle boisson est-ce que je préfère ?");
  assert.deepEqual(personalQuestions[0].options, ["De l'eau", "De la bière", "Du vin", "Du chocolat chaud", "Aucune de ces réponses"]);
  for (const item of situations) {
    assert.equal(item.options.length, 4);
    assert.equal(new Set(item.options).size, 4);
  }
  assert.match(situations[0].guestPrompt, /^Je reçois une mauvaise nouvelle.*Selon toi, qu'aimerais-je que tu fasses pour moi \?/);
});

test("the guest receives personal and situation questions from the host's point of view", async (t) => {
  const { base } = await startServer(t);
  const host = await prepareHost(base);
  const guest = await joinGuest(base, host.id, host.invite, "Sam");
  assert.equal(guest.view.currentPrompt.question.prompt, personalQuestions[0].guestPrompt);

  const answered = await api(base, "/api/games/" + host.id + "/answer", {
    method: "POST", token: guest.token, body: { type: "personal", choiceIndex: 0 }
  });
  assert.equal(answered.status, 200);
  assert.equal(answered.data.currentPrompt.question.prompt, situations[0].guestPrompt);
});

test("the invite form submits a named guest and safely handles a missing name", () => {
  const client = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
  const joinForm = client.match(/<form id="join-form"[\s\S]*?<\/form>/)?.[0] || "";
  assert.match(joinForm, /<input[^>]*id="join-name"[^>]*name="name"/);
  assert.match(client, /typeof rawName==="string"\?rawName\.trim\(\):""/);
  assert.match(client, /if\(!name\)\{document\.querySelector\("#join-error"\)/);
});

test("participant screens explain when the organizer can see answers and offer a searchable ranking", () => {
  const client = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
  assert.match(client, /L'organisateur verra tes réponses et ton résultat quand tu auras terminé/);
  assert.match(client, /L'organisateur peut maintenant consulter ton score et le détail de tes réponses/);
  assert.match(client, /Dès qu'un ami termine, l'hôte voit son résultat/);
  assert.match(client, /Rechercher un ami/);
  assert.match(client, /12 premiers inscrits/);
  assert.match(client, /100 % si vous partagez tous les deux, 25 % si vos choix s'opposent, 0 % si vous volez tous les deux/);
  assert.doesNotMatch(client, /Tes réponses restent cachées jusqu'à ce que tous les joueurs aient fini/);
});

test("the browser remembers a player's nickname and resumes their same-device invite session", () => {
  const client = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
  assert.match(client, /localStorage\.getItem\(storagePrefix\+"profile"\)/);
  assert.match(client, /localStorage\.setItem\(storagePrefix\+"profile"/);
  assert.match(client, /if\(id&&invite\)\{const savedGuest=readIdentity\(id,"B"\)/);
  assert.match(client, /value="\$\{esc\(savedProfileName\(\)\)\}"/);
});

test("the dilemma bank covers every dice total and five severity levels", () => {
  assert.equal(scenarios.length, 110);
  assert.equal(new Set(scenarios.map((item) => item.id)).size, 110);
  for (let total = 2; total <= 12; total += 1) {
    const matching = scenarios.filter((item) => item.rollTotals.includes(total));
    assert.equal(matching.length, 10);
    assert.deepEqual([...new Set(matching.map((item) => item.severity))].sort(), [1,2,3,4,5]);
  }
  for (const item of scenarios) {
    assert.ok(item.problem.length > 250 && item.doubt.length > 100);
    assert.deepEqual(Object.keys(item.outcomes).sort(), ["bothShare","bothSteal","otherSteals","youSteal"]);
  }
});

test("dilemma decisions accept exactly PARTAGER or VOLER and guests cannot roll", async (t) => {
  const { base } = await startServer(t);
  const created = await api(base, "/api/games", { method: "POST", body: { name: "Alex" } });
  const { id, token } = created.data;
  await api(base, "/api/games/" + id + "/roll", { method: "POST", token, body: {} });
  const bad = await api(base, "/api/games/" + id + "/choice", { method: "POST", token, body: { choice: "NEUTRE" } });
  assert.equal(bad.status, 400);
  assert.equal((await api(base, "/api/games/" + id + "/choice", { method: "POST", token, body: { choice: "PARTAGER" } })).status, 200);
  const host = await prepareHost(base);
  const guest = await joinGuest(base, host.id, host.invite, "Sam");
  assert.equal((await api(base, "/api/games/" + host.id + "/roll", { method: "POST", token: guest.token, body: {} })).status, 403);
});

test("setup requires three unique personal questions and four situations with distinct keys", async (t) => {
  const { base } = await startServer(t);
  const host = await createHost(base);
  const incomplete = await api(base, "/api/games/" + host.id + "/setup", { method: "POST", token: host.token, body: { personal: setupBody.personal.slice(0,2), situations: setupBody.situations } });
  assert.equal(incomplete.status, 400);
  const duplicate = structuredClone(setupBody);
  duplicate.personal[1].id = duplicate.personal[0].id;
  assert.equal((await api(base, "/api/games/" + host.id + "/setup", { method:"POST",token:host.token,body:duplicate })).status,400);
  const sameKeys = structuredClone(setupBody);
  sameKeys.situations[0].alternativeIndex = sameKeys.situations[0].idealIndex;
  assert.equal((await api(base, "/api/games/" + host.id + "/setup", { method:"POST",token:host.token,body:sameKeys })).status,400);
});

test("personal answers support the fifth fixed option and reject answers outside each question's options", async (t) => {
  const { base } = await startServer(t);
  const hostWithFifthAnswer = await createHost(base);
  const setupWithFifthAnswer = structuredClone(setupBody);
  setupWithFifthAnswer.personal[0].answerIndex = 4;
  const savedSetup = await api(base, "/api/games/" + hostWithFifthAnswer.id + "/setup", { method:"POST", token:hostWithFifthAnswer.token, body:setupWithFifthAnswer });
  assert.equal(savedSetup.status, 200);
  const host = await prepareHost(base);
  const guest = await joinGuest(base, host.id, host.invite, "Sam");
  const tooHigh = await api(base, "/api/games/" + host.id + "/answer", { method:"POST", token:guest.token, body:{ type:"personal", choiceIndex:5 } });
  assert.equal(tooHigh.status, 400);
  const selectedNone = await api(base, "/api/games/" + host.id + "/answer", { method:"POST", token:guest.token, body:{ type:"personal", choiceIndex:4 } });
  assert.equal(selectedNone.status, 200);
  assert.equal(selectedNone.data.currentPrompt.type, "situation");
});

test("the organizer sees results as friends finish and guests receive no group ranking or answers", async (t) => {
  const { base } = await startServer(t);
  const host = await prepareHost(base,{choices:["PARTAGER","PARTAGER","VOLER"]});
  const a = await joinGuest(base,host.id,host.invite,"Camille");
  const b = await joinGuest(base,host.id,host.invite,"Noé");
  assert.notEqual(a.token,b.token);
  assert.equal(a.view.progress,0);
  assert.equal(a.view.currentPrompt.type,"personal");
  assert.equal("setup" in a.view,false);
  assert.equal("hostAnswerIndex" in a.view.currentPrompt.question,false);
  assert.equal("idealIndex" in a.view.currentPrompt.question,false);
  const resultA = await playGuest(base,host.id,a,{
    dilemmaChoices:["PARTAGER","VOLER","PARTAGER"],
    personalChoices:[0,1,2],
    situationChoices:[0,1,2,0]
  });
  assert.equal(resultA.view.readyToReveal,true);
  const waitingHost = await api(base,"/api/games/"+host.id,{token:host.token});
  assert.equal(waitingHost.data.readyToReveal,true);
  assert.equal(waitingHost.data.results.matches.length,1);
  assert.deepEqual(waitingHost.data.results.leaderboard.map(x=>x.name),["Camille"]);
  assert.equal(waitingHost.data.guests.filter(x=>x.completed).length,1);
  const resultB = await playGuest(base,host.id,b,{
    dilemmaChoices:["VOLER","VOLER","VOLER"],
    personalChoices:[1,1,1],
    situationChoices:[2,2,2,2]
  });
  assert.equal(resultB.view.readyToReveal,true);
  assert.equal(resultA.rounds.length,3);
  assert.equal(resultB.rounds.length,3);
  assert.deepEqual(resultA.rounds.map(x=>x.scenario.id),host.rounds.map(x=>x.scenario.id));
  assert.deepEqual(resultB.rounds.map(x=>x.dice),host.rounds.map(x=>x.dice));
  assert.deepEqual(resultA.questions.map(x=>x.question.id),["p01","s01","p02","s02","p03","s03","s04"]);
  assert.equal(resultA.hints.length,1);
  assert.deepEqual(resultA.hints,resultB.hints,"each friend gets the same Serpent clue");
  const liveAfterSecond=await api(base,"/api/games/"+host.id,{token:host.token});
  assert.equal(liveAfterSecond.data.results.matches.length,2);
  assert.deepEqual(liveAfterSecond.data.results.leaderboard.map(x=>x.name),["Camille","Noé"]);
  const afterReveal=await api(base,"/api/games/"+host.id+"/join",{method:"POST",body:{invite:host.invite,name:"Inès"}});
  assert.equal(afterReveal.status,201,"friends can still join after earlier results are revealed");
  const guestReveal=await api(base,"/api/games/"+host.id,{token:b.token});
  assert.equal(guestReveal.data.readyToReveal,true);
  assert.equal(guestReveal.data.results,null);
  assert.equal("leaderboard" in guestReveal.data,false);
  assert.equal("matches" in guestReveal.data,false);
  assert.equal("completedGuests" in guestReveal.data,false);
  assert.deepEqual(liveAfterSecond.data.results.leaderboard.map(x=>[x.rank,x.name]),[[1,"Camille"],[2,"Noé"]]);
  assert.equal(liveAfterSecond.data.results.matches[0].scores.total,50);
  assert.equal(liveAfterSecond.data.results.matches[0].scores.dilemmas.points,15);
  assert.equal(liveAfterSecond.data.results.matches[0].scores.personal.points,10);
  assert.equal(liveAfterSecond.data.results.matches[0].scores.situations.points,25);
  assert.equal(liveAfterSecond.data.results.matches[0].cooperation.shared,4);
  assert.equal(liveAfterSecond.data.results.matches[0].cooperation.percent,67);
  assert.equal(liveAfterSecond.data.results.matches[0].trust.percent,50);
  const hostReveal = await api(base,"/api/games/"+host.id,{token:host.token});
  assert.equal(hostReveal.data.results.matches.length,2);
  assert.equal(hostReveal.data.results.matches[0].scores.total,50);
  assert.equal(hostReveal.data.results.leaderboard[0].guestId,hostReveal.data.results.matches[0].guestId);
  const locked = await api(base,"/api/games/"+host.id+"/answer",{method:"POST",token:a.token,body:{type:"personal",choiceIndex:0}});
  assert.equal(locked.status,409);
});

test("the invite remains open and rankings update as friends finish", async (t) => {
  const { base } = await startServer(t);
  const host = await prepareHost(base);
  const first = await joinGuest(base,host.id,host.invite,"Éli");
  await playGuest(base,host.id,first);
  const beforeSecond = await api(base,"/api/games/"+host.id,{token:host.token});
  assert.equal(beforeSecond.data.results.matches.length,1);
  const second = await joinGuest(base,host.id,host.invite,"Lou");
  const reveal = await playGuest(base,host.id,second);
  assert.equal(reveal.view.readyToReveal,true);
  const live = await api(base,"/api/games/"+host.id,{token:host.token});
  assert.equal(live.data.readyToReveal,true);
  assert.equal(live.data.results.leaderboard[0].rank,1);
  assert.equal(live.data.results.leaderboard[1].rank,1);
});

test("the invite stays open for extra friends, setup locks at first join, and answers cannot change", async (t) => {
  const { base } = await startServer(t);
  const host = await prepareHost(base);
  const closeEmpty = await api(base,"/api/games/"+host.id+"/close-invites",{method:"POST",token:host.token,body:{}});
  assert.equal(closeEmpty.status,410);
  const joined = await joinGuest(base,host.id,host.invite,"Malo");
  const closeAsGuest = await api(base,"/api/games/"+host.id+"/close-invites",{method:"POST",token:joined.token,body:{}});
  assert.equal(closeAsGuest.status,410);
  const edit = await api(base,"/api/games/"+host.id+"/setup",{method:"POST",token:host.token,body:setupBody});
  assert.equal(edit.status,409);
  const extraFriend = await joinGuest(base,host.id,host.invite,"Zoé");
  assert.notEqual(extraFriend.token,joined.token);
  const locked = await api(base,"/api/games/"+host.id+"/answer",{method:"POST",token:joined.token,body:{type:"personal",choiceIndex:0}});
  assert.equal(locked.status,200);
  const replay = await api(base,"/api/games/"+host.id+"/answer",{method:"POST",token:joined.token,body:{type:"personal",choiceIndex:1}});
  assert.equal(replay.status,409);
  for (let i=0;i<18;i+=1) {
    const guest=await joinGuest(base,host.id,host.invite,"Ami"+i);
    assert.ok(guest.token);
  }
  const openView=await api(base,"/api/games/"+host.id,{token:host.token});
  assert.equal(openView.data.guestCount,20);
});

test("the server preserves locked game state across a restart", async (t) => {
  const dataFile=join(tmpdir(),"trust-game-"+randomUUID()+".json");
  const first=await startServer(t,dataFile);
  const host=await createHost(first.base,{choices:["PARTAGER"]});
  await new Promise(resolve=>first.server.close(resolve));
  const second=await startServer(t,dataFile);
  const view=await api(second.base,"/api/games/"+host.id,{token:host.token});
  assert.equal(view.status,200);
  assert.equal(view.data.myRounds[0].choiceLocked,true);
  assert.equal(view.data.myRounds[0].choice,undefined,"an unfinished host choice is still hidden from the public view");
  const persisted=JSON.parse(readFileSync(dataFile,"utf8")).find(item=>item.id===host.id);
  assert.equal(persisted.host.rounds[0].choice,"PARTAGER","the locked choice is saved privately on disk");
  t.after(()=>{try{unlinkSync(dataFile);}catch{}try{unlinkSync(dataFile+".tmp");}catch{}});
});

