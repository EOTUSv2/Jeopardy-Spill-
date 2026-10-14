const fs = require('fs');
const path = require('path');
const { isHostAllowed, makeCode, MAX_PLAYERS } = require('./gameManager');
const { strings } = require('./strings');

// "Nærmest vinner": everyone guesses a number, the closest guesses score.
// Runs in its own Socket.IO namespace so it never touches the Jeopardy game.
const ROUNDS = 10;
const GUESS_TIME_MS = 30000;
const POINTS_BY_PLACE = [3, 2, 1];
const EXACT_BONUS = 2;

function loadQuestions() {
  const file = path.join(process.cwd(), 'questions-naermest.json');
  const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
  const valid = (data.questions || []).filter(
    (q) => q && typeof q.q === 'string' && q.q.trim() && Number.isFinite(q.answer) && q.unit
  );
  if (valid.length < ROUNDS) {
    throw new Error(
      `questions-naermest.json trenger minst ${ROUNDS} gyldige spørsmål (q, answer, unit). Fant ${valid.length}.`
    );
  }
  return valid;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Rank guesses by distance; equal distances share a place.
function rankGuesses(guesses, answer) {
  const rows = Object.entries(guesses)
    .map(([playerId, value]) => ({ playerId, value, distance: Math.abs(value - answer) }))
    .sort((a, b) => a.distance - b.distance);
  let place = 0;
  rows.forEach((row, i) => {
    if (i === 0 || row.distance !== rows[i - 1].distance) place = i;
    row.place = place;
    row.exact = row.distance === 0;
    row.points = (POINTS_BY_PLACE[place] || 0) + (row.exact ? EXACT_BONUS : 0);
  });
  return rows;
}

function createNaermestManager(io) {
  const nsp = io.of('/naermest');
  let game = null;
  let timer = null;

  function clearTimer() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function newGame() {
    clearTimer();
    game = {
      code: makeCode(),
      status: 'lobby', // lobby | playing | finished
      players: [], // { id, socketId, name, score }
      questions: [],
      round: 0,
      stage: null, // question | guesses | answer
      deadline: null,
      guesses: {}, // playerId -> number
      submitted: {}, // playerId -> true
      results: null, // ranked rows once the answer is shown
      error: null,
    };
    try {
      game.questions = shuffle(loadQuestions()).slice(0, ROUNDS);
    } catch (err) {
      game.error = err.message;
    }
  }

  function findPlayer(id) {
    return game.players.find((p) => p.id === id);
  }

  function publicPlayer(p) {
    return { id: p.id, name: p.name, score: p.score, connected: !!p.socketId };
  }

  function current() {
    return game.questions[game.round];
  }

  function baseState() {
    const q = game.status === 'playing' ? current() : null;
    return {
      code: game.code,
      serverTime: Date.now(),
      status: game.status,
      error: game.error,
      players: game.players.map(publicPlayer),
      maxPlayers: MAX_PLAYERS,
      round: game.round,
      rounds: game.questions.length,
      stage: game.stage,
      deadline: game.deadline,
      question: q ? q.q : null,
      unit: q ? q.unit : null,
      answer: q && game.stage === 'answer' ? q.answer : null,
      submittedIds: Object.keys(game.submitted),
      // Everyone's guesses become public once the time is up.
      guesses: game.stage === 'question' ? null : game.guesses,
      results: game.results,
    };
  }

  function playerState(playerId) {
    const me = findPlayer(playerId);
    return {
      ...baseState(),
      me: me ? publicPlayer(me) : null,
      myGuess: game.guesses[playerId] === undefined ? null : game.guesses[playerId],
      mySubmitted: !!game.submitted[playerId],
    };
  }

  function broadcast() {
    if (!game) return;
    nsp.to('host').emit('state:host', baseState());
    game.players.forEach((p) => {
      if (p.socketId) nsp.to(p.socketId).emit('state:player', playerState(p.id));
    });
  }

  function startQuestion() {
    clearTimer();
    game.stage = 'question';
    game.guesses = {};
    game.submitted = {};
    game.results = null;
    game.deadline = Date.now() + GUESS_TIME_MS;
    timer = setTimeout(() => {
      timer = null;
      endGuessing();
      broadcast();
    }, GUESS_TIME_MS);
  }

  function endGuessing() {
    if (!game || game.stage !== 'question') return;
    clearTimer();
    game.stage = 'guesses';
    game.deadline = null;
  }

  nsp.on('connection', (socket) => {
    const hostAllowed = isHostAllowed(socket);

    socket.on('host:hello', (cb) => {
      if (!hostAllowed) {
        socket.emit('host:denied');
        return cb && cb(null);
      }
      socket.join('host');
      if (!game) newGame();
      cb && cb(baseState());
    });

    socket.on('host:new', (cb) => {
      if (!hostAllowed) return;
      newGame();
      socket.join('host');
      cb && cb(baseState());
      broadcast();
    });

    socket.on('host:start', () => {
      if (!hostAllowed || !game || game.status !== 'lobby' || game.players.length < 1) return;
      game.status = 'playing';
      game.round = 0;
      startQuestion();
      broadcast();
    });

    socket.on('host:stopTime', () => {
      if (!hostAllowed || !game) return;
      endGuessing();
      broadcast();
    });

    socket.on('host:reveal', () => {
      if (!hostAllowed || !game || game.stage !== 'guesses') return;
      game.stage = 'answer';
      game.results = rankGuesses(game.guesses, current().answer);
      game.results.forEach((row) => {
        const p = findPlayer(row.playerId);
        if (p) p.score += row.points;
      });
      broadcast();
    });

    socket.on('host:next', () => {
      if (!hostAllowed || !game || game.stage !== 'answer') return;
      if (game.round < game.questions.length - 1) {
        game.round += 1;
        startQuestion();
      } else {
        game.status = 'finished';
        game.stage = null;
      }
      broadcast();
    });

    socket.on('player:join', ({ code, name, clientId }, cb) => {
      if (!game) newGame();
      if (!code || code.toUpperCase() !== game.code) {
        return cb && cb({ error: strings.errors.wrongCode });
      }
      let player = findPlayer(clientId);
      if (player) {
        player.socketId = socket.id;
      } else {
        if (game.status !== 'lobby') return cb && cb({ error: strings.errors.alreadyStarted });
        if (game.players.length >= MAX_PLAYERS) {
          return cb && cb({ error: strings.errors.full(MAX_PLAYERS) });
        }
        if (!name || !name.trim()) return cb && cb({ error: strings.errors.needName });
        player = { id: clientId, socketId: socket.id, name: name.trim().slice(0, 20), score: 0 };
        game.players.push(player);
      }
      socket.data.playerId = clientId;
      cb && cb({ ok: true });
      broadcast();
    });

    // Guesses can be changed until the time is up. Only a first "send"
    // changes what the TV shows, so only that triggers a broadcast.
    socket.on('player:guess', ({ value, submit }) => {
      const id = socket.data.playerId;
      if (!game || game.stage !== 'question' || !id || !findPlayer(id)) return;
      const n = Number(value);
      if (!Number.isFinite(n) || Math.abs(n) > 1e12) return;
      game.guesses[id] = n;
      if (submit && !game.submitted[id]) {
        game.submitted[id] = true;
        broadcast();
      }
    });

    socket.on('disconnect', () => {
      if (!game) return;
      const p = game.players.find((x) => x.socketId === socket.id);
      if (p) {
        p.socketId = null;
        broadcast();
      }
    });
  });
}

module.exports = { createNaermestManager, rankGuesses };
