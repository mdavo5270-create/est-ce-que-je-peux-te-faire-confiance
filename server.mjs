import { createServer } from "node:http";
import { randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from "node:fs";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { personalQuestions, situations } from "./quiz-banks.mjs";
import { scenarios } from "./scenarios.mjs";

const projectDir = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(projectDir, "public");
const defaultDataFile = process.env.DATA_FILE || join(projectDir, "data", "games.json");
const scenarioById = new Map(scenarios.map((item) => [item.id, item]));
const personalById = new Map(personalQuestions.map((item) => [item.id, item]));
const situationById = new Map(situations.map((item) => [item.id, item]));
const guestFlow = [
  { type: "personal", index: 0 },
  { type: "situation", index: 0 },
  { type: "dilemma", index: 0 },
  { type: "personal", index: 1 },
  { type: "situation", index: 1 },
  { type: "dilemma", index: 1 },
  { type: "personal", index: 2 },
  { type: "situation", index: 2 },
  { type: "dilemma", index: 2 },
  { type: "situation", index: 3 }
];

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function safeEqual(left, right) {
  if (typeof left !== "string" || typeof right !== "string") return false;
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

function normalizeStoredGame(game) {
  if (game.host) {
    // New games keep accepting friends; older saved games may still carry this flag.
    game.inviteClosed = false;
    return game;
  }
  if (!game.players || !game.players.A) return game;
  return {
    id: game.id,
    createdAt: game.createdAt,
    host: game.players.A,
    guests: [],
    inviteClosed: false,
    inviteToken: randomBytes(24).toString("base64url"),
    setup: null,
    serpent: null,
    archivedLegacyGuest: game.players.B || null
  };
}

function readGames(dataFile) {
  if (!dataFile || !existsSync(dataFile)) return new Map();
  try {
    const stored = JSON.parse(readFileSync(dataFile, "utf8"));
    return new Map(stored.map((raw) => {
      const game = normalizeStoredGame(raw);
      return [game.id, game];
    }));
  } catch {
    return new Map();
  }
}

function saveGames(games, dataFile) {
  if (!dataFile) return;
  mkdirSync(dirname(dataFile), { recursive: true });
  const temporaryFile = dataFile + ".tmp";
  writeFileSync(temporaryFile, JSON.stringify([...games.values()], null, 2), "utf8");
  renameSync(temporaryFile, dataFile);
}

function sendJson(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store",
    "x-content-type-options": "nosniff"
  });
  response.end(body);
}

async function readJson(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (Buffer.byteLength(body) > 16_384) throw new HttpError(413, "La requête est trop volumineuse.");
  }
  if (!body) return {};
  try { return JSON.parse(body); }
  catch { throw new HttpError(400, "Le contenu envoyé n'est pas valide."); }
}

function tokenFrom(request, url) {
  const authorization = request.headers.authorization || "";
  if (authorization.startsWith("Bearer ")) return authorization.slice(7);
  return url.searchParams.get("token") || "";
}

function getAuthorizedGame(request, url, games, id) {
  const game = games.get(id);
  if (!game) throw new HttpError(404, "Cette partie est introuvable.");
  const token = tokenFrom(request, url);
  if (safeEqual(token, game.host.token)) return { game, role: "A", guest: null };
  const guest = game.guests.find((item) => safeEqual(token, item.token));
  if (guest) return { game, role: "B", guest };
  throw new HttpError(401, "Ce lien de partie n'est pas valide.");
}

function rollDice() {
  const first = randomInt(1, 7);
  const second = randomInt(1, 7);
  return { dice: [first, second], total: first + second };
}

function chooseScenario(total, available, severity = null) {
  let candidates = severity === null ? available : available.filter((item) => item.severity === severity);
  if (!candidates.length) throw new HttpError(409, "Aucun dilemme n'est disponible pour ce tour.");
  const exactMatches = candidates.filter((item) => item.rollTotals.includes(total));
  if (exactMatches.length) candidates = exactMatches;
  else {
    const distance = Math.min(...candidates.map((item) => Math.min(...item.rollTotals.map((roll) => Math.abs(roll - total)))));
    candidates = candidates.filter((item) => Math.min(...item.rollTotals.map((roll) => Math.abs(roll - total))) === distance);
  }
  return candidates[randomInt(0, candidates.length)];
}

function makeProgressiveChain(available) {
  const ordered = [...available].sort((left, right) => left.severity - right.severity || left.id.localeCompare(right.id));
  const middle = Math.floor((ordered.length - 1) / 2);
  return [ordered[0].severity, ordered[middle].severity, ordered.at(-1).severity];
}

function hostCompleted(host) {
  return host.rounds.length === 3 && host.rounds.every((round) => round.choice === "PARTAGER" || round.choice === "VOLER");
}

function guestCompleted(guest) {
  return guest.progress === guestFlow.length
    && guest.rounds.every((round) => round.choice === "PARTAGER" || round.choice === "VOLER")
    && guest.personalAnswers.length === 3
    && guest.situationAnswers.length === 4;
}

function round1(value) {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

function validateSetup(body) {
  if (!body || !Array.isArray(body.personal) || body.personal.length !== 3 || !Array.isArray(body.situations) || body.situations.length !== 4) {
    throw new HttpError(400, "Choisis trois questions personnelles et quatre mises en situation.");
  }
  const personal = body.personal.map((entry) => {
    const question = personalById.get(entry.id);
    if (!question || !Number.isInteger(entry.answerIndex) || entry.answerIndex < 0 || entry.answerIndex >= question.options.length) {
      throw new HttpError(400, "Chaque question personnelle doit avoir une réponse correcte.");
    }
    return { id: entry.id, answerIndex: entry.answerIndex };
  });
  const selectedSituations = body.situations.map((entry) => {
    const situation = situationById.get(entry.id);
    if (!situation
      || !Number.isInteger(entry.idealIndex) || entry.idealIndex < 0 || entry.idealIndex > 3
      || !Number.isInteger(entry.alternativeIndex) || entry.alternativeIndex < 0 || entry.alternativeIndex > 3
      || entry.idealIndex === entry.alternativeIndex) {
      throw new HttpError(400, "Chaque situation doit avoir une réponse idéale et une alternative distinctes.");
    }
    return { id: entry.id, idealIndex: entry.idealIndex, alternativeIndex: entry.alternativeIndex };
  });
  if (new Set(personal.map((entry) => entry.id)).size !== 3) throw new HttpError(400, "Choisis trois questions personnelles différentes.");
  if (new Set(selectedSituations.map((entry) => entry.id)).size !== 4) throw new HttpError(400, "Choisis quatre mises en situation différentes.");
  return { personal, situations: selectedSituations };
}

function buildTrustVerdict(trustPercent, mutualSharePairs, mutualStealPairs, mismatchedPairs, rounds) {
  const key = trustPercent.toFixed(1);
  const messages = {
    "0.0": ["Prudence dans cette partie", "Vous avez tous les deux choisi VOLER aux trois tours. Le jeu ne montre aucun partage réciproque."],
    "8.3": ["Plutôt non dans ce test", "Aucun partage mutuel, deux choix de VOLER ensemble et un désaccord : le signal de coopération est très faible."],
    "16.7": ["Plutôt non dans ce test", "Aucun partage mutuel et deux désaccords. Vos décisions se sont peu rejointes."],
    "25.0": ["Confiance incertaine", "Vos choix ont été opposés aux trois tours. Cette partie ne permet pas de dégager une coopération réciproque."],
    "33.3": ["Réserve importante", "Un partage mutuel, mais deux tours où vous avez tous les deux choisi VOLER."],
    "41.7": ["Résultat mitigé", "Un partage mutuel, un désaccord et un tour où vous avez tous les deux choisi VOLER."],
    "50.0": ["Résultat mitigé", "Un partage mutuel et deux désaccords : il y a un signe positif, avec plusieurs choix divergents."],
    "66.7": ["Plutôt oui dans cette partie", "Deux partages mutuels montrent un signal favorable; un tour où vous avez tous les deux choisi VOLER reste à considérer."],
    "75.0": ["Plutôt oui, avec une réserve", "Deux partages mutuels montrent un signal favorable; vos choix ont divergé sur un tour."],
    "100.0": ["Oui, pour cette partie", "Vous avez tous les deux choisi PARTAGER aux trois tours. C'est un signal favorable dans ce jeu, pas une garantie pour toutes les situations."]
  };
  const selected = messages[key] || ["Résultat à nuancer", "Regardez les choix tour par tour pour comprendre ce pourcentage."];
  const reserves = [];
  rounds.forEach((round, index) => {
    if (round.hostChoice === "PARTAGER" && round.guestChoice === "VOLER") {
      reserves.push("Au dilemme " + (index + 1) + ", A a choisi PARTAGER et B a choisi VOLER.");
    } else if (round.hostChoice === "VOLER" && round.guestChoice === "PARTAGER") {
      reserves.push("Au dilemme " + (index + 1) + ", B a choisi PARTAGER alors que A a choisi VOLER.");
    } else if (round.hostChoice === "VOLER" && round.guestChoice === "VOLER") {
      reserves.push("Au dilemme " + (index + 1) + ", vous avez tous les deux choisi VOLER.");
    }
  });
  return {
    label: selected[0],
    message: selected[1],
    reserve: reserves,
    mutualSharePairs,
    mutualStealPairs,
    mismatchedPairs
  };
}

function scoreGuest(game, guest) {
  const dilemmaDetails = game.host.rounds.map((hostRound, index) => {
    const guestRound = guest.rounds[index];
    let trust = 0;
    if (hostRound.choice === "PARTAGER" && guestRound.choice === "PARTAGER") trust = 100;
    else if (hostRound.choice !== guestRound.choice) trust = 25;
    return {
      turn: index + 1,
      scenario: scenarioById.get(hostRound.scenarioId),
      dice: hostRound.dice,
      total: hostRound.total,
      hostChoice: hostRound.choice,
      guestChoice: guestRound.choice,
      trustPercent: trust,
      points: trust / 10
    };
  });
  const trustSum = dilemmaDetails.reduce((sum, item) => sum + item.trustPercent, 0);
  const trustPercent = round1(trustSum / 3);
  const mutualSharePairs = dilemmaDetails.filter((item) => item.hostChoice === "PARTAGER" && item.guestChoice === "PARTAGER").length;
  const mutualStealPairs = dilemmaDetails.filter((item) => item.hostChoice === "VOLER" && item.guestChoice === "VOLER").length;
  const mismatchedPairs = 3 - mutualSharePairs - mutualStealPairs;
  const sharedChoices = [...game.host.rounds, ...guest.rounds].filter((round) => round.choice === "PARTAGER").length;
  const hostAnswerFor = game.setup.personal;
  const personalDetails = hostAnswerFor.map((entry, index) => {
    const question = personalById.get(entry.id);
    const answerIndex = guest.personalAnswers[index];
    const correct = answerIndex === entry.answerIndex;
    return {
      id: question.id,
      prompt: question.prompt,
      guestPrompt: question.guestPrompt,
      options: question.options,
      hostAnswerIndex: entry.answerIndex,
      guestAnswerIndex: answerIndex,
      correct,
      points: correct ? 10 : 0
    };
  });
  const personalCorrect = personalDetails.filter((entry) => entry.correct).length;
  const situationDetails = game.setup.situations.map((entry, index) => {
    const card = situationById.get(entry.id);
    const answerIndex = guest.situationAnswers[index];
    const result = answerIndex === entry.idealIndex ? "ideal" : answerIndex === entry.alternativeIndex ? "alternative" : "other";
    return {
      id: card.id,
      title: card.title,
      prompt: card.prompt,
      guestPrompt: card.guestPrompt,
      options: card.options,
      idealIndex: entry.idealIndex,
      alternativeIndex: entry.alternativeIndex,
      guestAnswerIndex: answerIndex,
      result,
      points: result === "ideal" ? 10 : result === "alternative" ? 5 : 0
    };
  });
  const idealCount = situationDetails.filter((entry) => entry.result === "ideal").length;
  const alternativeCount = situationDetails.filter((entry) => entry.result === "alternative").length;
  const dilemmaPoints = round1(dilemmaDetails.reduce((sum, item) => sum + item.points, 0));
  const personalPoints = personalDetails.reduce((sum, item) => sum + item.points, 0);
  const situationPoints = situationDetails.reduce((sum, item) => sum + item.points, 0);
  const totalScore = round1(dilemmaPoints + personalPoints + situationPoints);
  return {
    guestId: guest.id,
    name: guest.name,
    scores: {
      dilemmas: { points: dilemmaPoints, maximum: 30 },
      personal: { points: personalPoints, maximum: 30, correct: personalCorrect, total: 3 },
      situations: { points: situationPoints, maximum: 40, ideal: idealCount, alternative: alternativeCount, total: 4 },
      total: totalScore
    },
    cooperation: { shared: sharedChoices, total: 6, percent: Math.round((sharedChoices / 6) * 100) },
    trust: {
      percent: trustPercent,
      ...buildTrustVerdict(trustPercent, mutualSharePairs, mutualStealPairs, mismatchedPairs, dilemmaDetails)
    },
    dilemmas: dilemmaDetails,
    personal: personalDetails,
    situations: situationDetails,
    serpent: game.serpent ? {
      turn: game.serpent.turn,
      said: game.serpent.claimedChoice,
      actual: game.host.rounds[game.serpent.turn - 1].choice,
      wasTrue: game.serpent.wasTrue
    } : null
  };
}

function buildFinalResults(game) {
  const allMatches = game.guests.filter(guestCompleted).map((item) => scoreGuest(game, item));
  const sorted = [...allMatches].sort((left, right) => right.scores.total - left.scores.total);
  let previousScore = null;
  let previousRank = 0;
  const leaderboard = sorted.map((match, index) => {
    const rank = previousScore === match.scores.total ? previousRank : index + 1;
    previousScore = match.scores.total;
    previousRank = rank;
    return { rank, guestId: match.guestId, name: match.name, total: match.scores.total };
  });
  return { matches: allMatches, leaderboard };
}

function promptForGuest(game, guest) {
  const stage = guestFlow[guest.progress];
  if (!stage) return null;
  if (stage.type === "dilemma") {
    const round = game.host.rounds[stage.index];
    return {
      type: "dilemma",
      index: stage.index,
      round: {
        turn: stage.index + 1,
        dice: round.dice,
        total: round.total,
        scenario: scenarioById.get(round.scenarioId)
      },
      serpentHint: game.serpent && game.serpent.turn === stage.index + 1
        ? { turn: game.serpent.turn, said: game.serpent.claimedChoice }
        : null
    };
  }
  if (stage.type === "personal") {
    const config = game.setup.personal[stage.index];
    const question = personalById.get(config.id);
    return {
      type: "personal",
      index: stage.index,
      question: { id: question.id, prompt: question.guestPrompt, options: question.options }
    };
  }
  const config = game.setup.situations[stage.index];
  const card = situationById.get(config.id);
  return {
    type: "situation",
    index: stage.index,
    question: { id: card.id, title: card.title, prompt: card.guestPrompt, options: card.options }
  };
}

function hostView(game) {
  const readyToReveal = game.guests.some(guestCompleted);
  return {
    id: game.id,
    role: "A",
    myName: game.host.name,
    myCompleted: game.host.rounds.filter((round) => round.choice !== null).length,
    myRounds: game.host.rounds.map((round, index) => ({
      turn: index + 1,
      dice: round.dice,
      total: round.total,
      scenario: scenarioById.get(round.scenarioId),
      choiceLocked: round.choice !== null,
      choice: readyToReveal ? round.choice : undefined
    })),
    guestCount: game.guests.length,
    completedGuests: game.guests.filter(guestCompleted).length,
    guests: game.guests.slice(0, 12).map((guest) => ({
      id: guest.id,
      name: guest.name,
      completed: guestCompleted(guest),
      progress: guest.progress,
      totalSteps: guestFlow.length
    })),
    setupDone: Boolean(game.setup),
    setup: game.setup ? {
      personal: game.setup.personal.map((entry) => ({ id: entry.id, answerIndex: entry.answerIndex, question: personalById.get(entry.id) })),
      situations: game.setup.situations.map((entry) => ({ id: entry.id, idealIndex: entry.idealIndex, alternativeIndex: entry.alternativeIndex, question: situationById.get(entry.id) }))
    } : null,
    canInvite: hostCompleted(game.host) && Boolean(game.setup),
    inviteClosed: false,
    readyToReveal,
    results: readyToReveal ? buildFinalResults(game) : null
  };
}

function guestView(game, guest) {
  const readyToReveal = guestCompleted(guest);
  return {
    id: game.id,
    role: "B",
    guestId: guest.id,
    myName: guest.name,
    otherName: game.host.name,
    myCompleted: guest.rounds.filter((round) => round.choice !== null).length,
    myRounds: [],
    progress: guest.progress,
    totalSteps: guestFlow.length,
    currentPrompt: readyToReveal ? null : promptForGuest(game, guest),
    inviteClosed: false,
    readyToReveal,
    results: null
  };
}

function playerView(game, role, guest = null) {
  return role === "A" ? hostView(game) : guestView(game, guest);
}

function publicBaseUrl(request) {
  if (process.env.PUBLIC_URL) return new URL(process.env.PUBLIC_URL).origin;
  const protocol = request.headers["x-forwarded-proto"] && request.headers["x-forwarded-proto"].split(",")[0].trim() || "http";
  const host = request.headers.host || "localhost:" + (process.env.PORT || 4173);
  return new URL(protocol + "://" + host).origin;
}

function serveStatic(request, response, pathname) {
  const requested = pathname === "/" ? "index.html" : decodeURIComponent(pathname).replace(/^\/+/, "");
  const filePath = resolve(publicDir, requested);
  if (!filePath.startsWith(publicDir + sep) && filePath !== publicDir) throw new HttpError(404, "Fichier introuvable.");
  if (!existsSync(filePath)) throw new HttpError(404, "Fichier introuvable.");
  const contentTypes = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".webmanifest": "application/manifest+json; charset=utf-8"
  };
  const data = readFileSync(filePath);
  response.writeHead(200, {
    "content-type": contentTypes[extname(filePath)] || "application/octet-stream",
    "content-length": data.length,
    "cache-control": [".html", ".js", ".css"].includes(extname(filePath)) ? "no-cache" : "public, max-age=3600",
    "x-content-type-options": "nosniff"
  });
  response.end(data);
}

export function createGameServer({ dataFile = defaultDataFile } = {}) {
  const games = readGames(dataFile);
  return createServer(async (request, response) => {
    const url = new URL(request.url, "http://localhost");
    const pathname = url.pathname;
    try {
      if (pathname === "/api/health" && request.method === "GET") {
        return sendJson(response, 200, { ok: true, dilemmas: scenarios.length, personalQuestions: personalQuestions.length, situations: situations.length });
      }
      if (pathname === "/api/banks" && request.method === "GET") {
        return sendJson(response, 200, { personalQuestions, situations });
      }
      if (pathname === "/api/games" && request.method === "POST") {
        const body = await readJson(request);
        const name = typeof body.name === "string" ? body.name.trim().slice(0, 32) : "";
        if (!name) throw new HttpError(400, "Indique ton prénom ou un pseudo pour commencer.");
        let id;
        do { id = randomBytes(9).toString("base64url"); } while (games.has(id));
        const game = {
          id,
          createdAt: new Date().toISOString(),
          inviteToken: randomBytes(24).toString("base64url"),
          inviteClosed: false,
          host: { token: randomBytes(24).toString("base64url"), name, rounds: [], severityChain: null },
          guests: [],
          setup: null,
          serpent: null
        };
        games.set(id, game);
        saveGames(games, dataFile);
        return sendJson(response, 201, { id, token: game.host.token, role: "A" });
      }

      const match = pathname.match(/^\/api\/games\/([\w-]+)(?:\/(invite|join|close-invites|roll|choice|setup|answer))?$/);
      if (match) {
        const [, id, action] = match;
        const game = games.get(id);
        if (!game) throw new HttpError(404, "Cette partie est introuvable.");

        if (action === "join" && request.method === "POST") {
          const body = await readJson(request);
          const name = typeof body.name === "string" ? body.name.trim().slice(0, 32) : "";
          if (!name) throw new HttpError(400, "Choisis un prénom ou un pseudo.");
          if (!safeEqual(body.invite, game.inviteToken)) throw new HttpError(401, "Ce lien d'invitation n'est pas valide.");
          if (!hostCompleted(game.host) || !game.setup) throw new HttpError(409, "Le joueur A prépare encore la partie.");
          if (game.guests.some((guest) => guest.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
            throw new HttpError(409, "Ce pseudo est déjà utilisé dans cette partie. Choisis-en un autre.");
          }
          const guest = {
            id: randomBytes(8).toString("base64url"),
            token: randomBytes(24).toString("base64url"),
            name,
            rounds: game.host.rounds.map((round) => ({ dice: [...round.dice], total: round.total, scenarioId: round.scenarioId, choice: null })),
            personalAnswers: Array(3).fill(null),
            situationAnswers: Array(4).fill(null),
            progress: 0
          };
          game.guests.push(guest);
          saveGames(games, dataFile);
          return sendJson(response, 201, { id: game.id, role: "B", guestId: guest.id, token: guest.token, data: playerView(game, "B", guest) });
        }

        const authorized = getAuthorizedGame(request, url, games, id);
        const { role, guest } = authorized;
        if (!action && request.method === "GET") return sendJson(response, 200, playerView(game, role, guest));

        if (action === "setup" && request.method === "POST") {
          if (role !== "A") throw new HttpError(403, "Seul le joueur A prépare les questions.");
          if (!hostCompleted(game.host)) throw new HttpError(409, "Termine les trois dilemmes avant de préparer les questions.");
          if (game.guests.length > 0) throw new HttpError(409, "La préparation est verrouillée dès qu'un ami rejoint la partie.");
          game.setup = validateSetup(await readJson(request));
          saveGames(games, dataFile);
          return sendJson(response, 200, playerView(game, role));
        }

        if (action === "invite" && request.method === "GET") {
          if (role !== "A") throw new HttpError(403, "Seul le joueur A peut créer l'invitation.");
          if (!hostCompleted(game.host) || !game.setup) throw new HttpError(409, "Termine les dilemmes et prépare les questions avant d'inviter tes amis.");
          if (!game.serpent) {
            const turn = randomInt(1, 4);
            const actual = game.host.rounds[turn - 1].choice;
            const wasTrue = randomInt(1, 101) <= 60;
            game.serpent = {
              turn,
              claimedChoice: wasTrue ? actual : actual === "PARTAGER" ? "VOLER" : "PARTAGER",
              wasTrue
            };
            saveGames(games, dataFile);
          }
          const invite = new URL("/", publicBaseUrl(request));
          invite.searchParams.set("game", game.id);
          invite.searchParams.set("invite", game.inviteToken);
          return sendJson(response, 200, { url: invite.toString() });
        }

        if (action === "close-invites" && request.method === "POST") {
          throw new HttpError(410, "Les résultats se révèlent automatiquement dès qu'un ami termine. Les inscriptions restent ouvertes.");
        }

        if (action === "roll" && request.method === "POST") {
          if (role !== "A") throw new HttpError(403, "Les amis suivent les trois dilemmes déjà choisis par A.");
          if (game.setup) throw new HttpError(409, "Les trois dilemmes sont terminés et les questions sont verrouillées.");
          const player = game.host;
          if (player.rounds.length >= 3) throw new HttpError(409, "Tes trois dilemmes sont terminés.");
          if (player.rounds.at(-1) && player.rounds.at(-1).choice === null) throw new HttpError(409, "Termine d'abord le dilemme en cours.");
          if (!player.severityChain) player.severityChain = makeProgressiveChain(scenarios);
          const { dice, total } = rollDice();
          const usedIds = new Set(player.rounds.map((round) => round.scenarioId));
          const available = scenarios.filter((item) => !usedIds.has(item.id));
          const scenario = chooseScenario(total, available, player.severityChain[player.rounds.length]);
          player.rounds.push({ dice, total, scenarioId: scenario.id, choice: null });
          saveGames(games, dataFile);
          return sendJson(response, 201, playerView(game, role));
        }

        if (action === "choice" && request.method === "POST") {
          const body = await readJson(request);
          if (role === "A") {
            const player = game.host;
            const current = player.rounds.at(-1);
            if (game.setup) throw new HttpError(409, "Ces trois choix sont déjà verrouillés.");
            if (!current || current.choice !== null) throw new HttpError(409, "Aucun dilemme modifiable n'est en attente.");
            if (body.choice !== "PARTAGER" && body.choice !== "VOLER") throw new HttpError(400, "Choisis PARTAGER ou VOLER.");
            current.choice = body.choice;
          } else {
            const stage = guestFlow[guest.progress];
            if (!stage || stage.type !== "dilemma") throw new HttpError(409, "Le prochain choix demandé n'est pas un dilemme.");
            if (body.choice !== "PARTAGER" && body.choice !== "VOLER") throw new HttpError(400, "Choisis PARTAGER ou VOLER.");
            const current = guest.rounds[stage.index];
            if (!current || current.choice !== null) throw new HttpError(409, "Ce dilemme est déjà verrouillé.");
            current.choice = body.choice;
            guest.progress += 1;
          }
          saveGames(games, dataFile);
          return sendJson(response, 200, playerView(game, role, guest));
        }

        if (action === "answer" && request.method === "POST") {
          if (role !== "B") throw new HttpError(403, "Seul un ami invité répond aux questions.");
          const stage = guestFlow[guest.progress];
          const body = await readJson(request);
          if (!stage || !["personal", "situation"].includes(stage.type) || stage.type !== body.type) {
            throw new HttpError(409, "Cette question n'est pas la prochaine étape de la partie.");
          }
          const questionId = stage.type === "personal"
            ? game.setup.personal[stage.index].id
            : game.setup.situations[stage.index].id;
          const options = stage.type === "personal"
            ? personalById.get(questionId).options
            : situationById.get(questionId).options;
          if (!Number.isInteger(body.choiceIndex) || body.choiceIndex < 0 || body.choiceIndex >= options.length) {
            throw new HttpError(400, "Choisis une réponse parmi les propositions affichées.");
          }
          if (stage.type === "personal") guest.personalAnswers[stage.index] = body.choiceIndex;
          else guest.situationAnswers[stage.index] = body.choiceIndex;
          guest.progress += 1;
          saveGames(games, dataFile);
          return sendJson(response, 200, playerView(game, role, guest));
        }
      }

      if (pathname.startsWith("/api/")) throw new HttpError(404, "Route introuvable.");
      if (request.method !== "GET" && request.method !== "HEAD") throw new HttpError(405, "Méthode non prise en charge.");
      return serveStatic(request, response, pathname);
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      if (!(error instanceof HttpError)) console.error(error);
      return sendJson(response, status, { error: error.message || "Une erreur est survenue." });
    }
  });
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const host = process.env.HOST || "0.0.0.0";
  const port = Number(process.env.PORT || 4173);
  const server = createGameServer();
  server.listen(port, host, () => console.log("Est-ce que je peux te faire confiance ? — http://localhost:" + port));
}
