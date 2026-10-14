const os = require('os');
const { buildGameBoards } = require('./questions');
const { strings } = require('./strings');

const MAX_PLAYERS = 10;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const QUESTION_TIME_MS = 20000;
const FINAL_TIME_MS = 30000;
const FINAL_ANSWER_MAX = 60;

function makeCode() {
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

function localAddresses() {
  const addrs = new Set(['127.0.0.1', '::1']);
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) addrs.add(net.address);
  }
  return addrs;
}

// Only the machine running the server may act as host, so players on the
// same WiFi cannot open /host to read the answers or send host commands.
// Set ALLOW_REMOTE_HOST=1 to host from another device on the network.
function isHostAllowed(socket) {
  if (process.env.ALLOW_REMOTE_HOST === '1') return true;
  const raw = (socket.handshake && socket.handshake.address) || '';
  return localAddresses().has(raw.replace(/^::ffff:/, ''));
}

function createGameManager(io) {
  let game = null;
  let openCellTimer = null;

  let finalTimer = null;

  function clearOpenCellTimer() {
    if (openCellTimer) {
      clearTimeout(openCellTimer);
      openCellTimer = null;
    }
  }

  function clearFinalTimer() {
    if (finalTimer) {
      clearTimeout(finalTimer);
      finalTimer = null;
    }
  }

  function newGame() {
    clearOpenCellTimer();
    clearFinalTimer();
    game = {
      code: makeCode(),
      status: 'lobby', // lobby | playing | final | finished
      players: [], // { id, socketId, name, score }
      boardIndex: 0,
      boards: null,
      openCell: null,
      // The player who last answered correctly "owns" the board and gets the
      // next Daily Double.
      lastCorrectPlayerId: null,
      finalQuestion: null,
      final: null,
      error: null,
    };
    try {
      const built = buildGameBoards();
      game.boards = built.boards;
      game.finalQuestion = built.final;
    } catch (err) {
      game.error = err.message;
    }
    return game;
  }

  function ensureGame() {
    if (!game) newGame();
    return game;
  }

  function boardComplete(board) {
    return board.categories.every((c) => c.cells.every((cell) => cell.used));
  }

  function findPlayer(id) {
    return game.players.find((p) => p.id === id);
  }

  // Daily Double wagers: at least the board's lowest value, at most the
  // player's score or the board's top value, whichever is higher.
  function ddLimits(playerId) {
    const board = game.boards[game.boardIndex];
    const player = findPlayer(playerId);
    const min = 100 * board.multiplier;
    const max = Math.max(player ? player.score : 0, 500 * board.multiplier);
    return { min, max };
  }

  function startFinal() {
    const eligibleIds = game.players.filter((p) => p.score > 0).map((p) => p.id);
    if (eligibleIds.length === 0 || !game.finalQuestion) {
      game.status = 'finished';
      return;
    }
    game.status = 'final';
    game.final = {
      stage: 'wager', // wager | question | review | answer
      category: game.finalQuestion.category,
      question: game.finalQuestion.question,
      answer: game.finalQuestion.answer,
      eligibleIds,
      wagers: {}, // playerId -> points
      answers: {}, // playerId -> text
      submitted: {}, // playerId -> true when the player pressed send
      deadline: null,
      order: [], // eligible ids, lowest score first, set when review starts
      current: 0,
      currentShown: false,
      results: {}, // playerId -> 'correct' | 'incorrect'
    };
  }

  function endFinalQuestion() {
    const f = game.final;
    if (!f || f.stage !== 'question') return;
    clearFinalTimer();
    f.stage = 'review';
    f.deadline = null;
    f.order = f.eligibleIds
      .map((id, joinIndex) => ({ id, joinIndex, score: findPlayer(id).score }))
      .sort((a, b) => a.score - b.score || a.joinIndex - b.joinIndex)
      .map((x) => x.id);
    f.current = 0;
    f.currentShown = false;
  }

  function publicPlayer(p) {
    return { id: p.id, name: p.name, score: p.score, connected: !!p.socketId, stats: p.stats };
  }

  function hostState() {
    if (!game) return null;
    return {
      code: game.code,
      serverTime: Date.now(),
      status: game.status,
      error: game.error,
      players: game.players.map(publicPlayer),
      maxPlayers: MAX_PLAYERS,
      boardIndex: game.boardIndex,
      boards: game.boards,
      openCell: game.openCell,
      final: game.final,
      board1Complete: game.boards ? boardComplete(game.boards[0]) : false,
      board2Complete: game.boards ? boardComplete(game.boards[1]) : false,
    };
  }

  function playerState(playerId) {
    if (!game) return null;
    const strippedBoards = game.boards
      ? game.boards.map((b) => ({
          multiplier: b.multiplier,
          categories: b.categories.map((c) => ({
            name: c.name,
            cells: c.cells.map((cell) => ({ value: cell.value, used: cell.used })),
          })),
        }))
      : null;

    const oc = game.openCell;
    const openCell = oc
      ? {
          category: oc.category,
          value: oc.value,
          dailyDouble: oc.dailyDouble,
          ddStage: oc.ddStage,
          ddPlayerId: oc.ddPlayerId,
          // The wager is announced on the TV once locked, so everyone may see it.
          wager: oc.ddStage === 'wager' ? null : oc.wager,
          ddLimits: oc.dailyDouble && oc.ddPlayerId === playerId ? ddLimits(playerId) : null,
          buzzedPlayerId: oc.buzzedPlayerId,
          wrongPlayerIds: oc.wrongPlayerIds,
          isMine: oc.buzzedPlayerId === playerId,
          buzzMs: oc.buzzMs,
          iBuzzedWrong: oc.wrongPlayerIds.includes(playerId),
          revealed: oc.revealed,
          answer: oc.revealed ? oc.answer : null,
          deadline: oc.deadline,
        }
      : null;

    // Players only ever see their own wager and answer, never anyone else's
    // until the host reveals it on the TV.
    const f = game.final;
    const final = f
      ? {
          stage: f.stage,
          category: f.category,
          question: f.stage === 'wager' ? null : f.question,
          answer: f.stage === 'answer' ? f.answer : null,
          deadline: f.deadline,
          eligible: f.eligibleIds.includes(playerId),
          myWager: f.wagers[playerId] === undefined ? null : f.wagers[playerId],
          myAnswer: f.answers[playerId] || '',
          mySubmitted: !!f.submitted[playerId],
          myResult: f.results[playerId] || null,
        }
      : null;

    const me = game.players.find((p) => p.id === playerId);

    return {
      code: game.code,
      serverTime: Date.now(),
      status: game.status,
      error: game.error,
      players: game.players.map(publicPlayer),
      maxPlayers: MAX_PLAYERS,
      boardIndex: game.boardIndex,
      boards: strippedBoards,
      openCell,
      final,
      me: me ? publicPlayer(me) : null,
    };
  }

  function broadcast() {
    if (!game) return;
    io.to('host').emit('state:host', hostState());
    game.players.forEach((p) => {
      if (p.socketId) io.to(p.socketId).emit('state:player', playerState(p.id));
    });
  }

  io.on('connection', (socket) => {
    const hostAllowed = isHostAllowed(socket);

    socket.on('host:hello', (cb) => {
      if (!hostAllowed) {
        socket.emit('host:denied');
        return cb && cb(null);
      }
      socket.join('host');
      ensureGame();
      cb && cb(hostState());
      broadcast();
    });

    socket.on('host:new', (cb) => {
      if (!hostAllowed) return;
      newGame();
      socket.join('host');
      cb && cb(hostState());
      broadcast();
    });

    socket.on('host:start', () => {
      if (!hostAllowed) return;
      if (!game || game.status !== 'lobby') return;
      if (game.players.length < 1) return;
      game.status = 'playing';
      broadcast();
    });

    socket.on('host:openCell', ({ catIndex, cellIndex }) => {
      if (!hostAllowed) return;
      if (!game || game.status !== 'playing' || game.openCell) return;
      const board = game.boards[game.boardIndex];
      const cat = board.categories[catIndex];
      const cell = cat && cat.cells[cellIndex];
      if (!cell || cell.used) return;
      clearOpenCellTimer();
      game.openCell = {
        catIndex,
        cellIndex,
        value: cell.value,
        category: cat.name,
        question: cell.question,
        answer: cell.answer,
        buzzedPlayerId: null,
        wrongPlayerIds: [],
        revealed: false,
        deadline: Date.now() + QUESTION_TIME_MS,
        openedAt: Date.now(),
        buzzMs: null, // how long the first buzz took, shown on the TV
        dailyDouble: false,
        ddStage: null, // pick | wager | locked | question
        ddPlayerId: null,
        wager: null,
      };
      if (cell.dailyDouble) {
        // No buzzing and no countdown: one player wagers and answers alone.
        const owner = findPlayer(game.lastCorrectPlayerId);
        Object.assign(game.openCell, {
          dailyDouble: true,
          deadline: null,
          ddPlayerId: owner ? owner.id : null,
          ddStage: owner ? 'wager' : 'pick',
        });
        broadcast();
        return;
      }
      openCellTimer = setTimeout(() => {
        if (!game || !game.openCell) return;
        const oc = game.openCell;
        if (oc.buzzedPlayerId) return;
        oc.revealed = true;
        oc.deadline = null;
        openCellTimer = null;
        broadcast();
      }, QUESTION_TIME_MS);
      broadcast();
    });

    socket.on('host:ddAssign', ({ playerId }) => {
      if (!hostAllowed) return;
      const oc = game && game.openCell;
      if (!oc || !oc.dailyDouble || !['pick', 'wager'].includes(oc.ddStage)) return;
      if (playerId === null) {
        oc.ddPlayerId = null;
        oc.ddStage = 'pick';
      } else {
        if (!findPlayer(playerId)) return;
        oc.ddPlayerId = playerId;
        oc.ddStage = 'wager';
      }
      oc.wager = null;
      broadcast();
    });

    socket.on('host:ddShowQuestion', () => {
      if (!hostAllowed) return;
      const oc = game && game.openCell;
      if (!oc || !oc.dailyDouble || oc.ddStage !== 'locked') return;
      oc.ddStage = 'question';
      broadcast();
    });

    socket.on('host:reveal', () => {
      if (!hostAllowed) return;
      if (!game || !game.openCell) return;
      clearOpenCellTimer();
      game.openCell.revealed = true;
      game.openCell.deadline = null;
      broadcast();
    });

    socket.on('host:resolve', ({ result }) => {
      if (!hostAllowed) return;
      if (!game || !game.openCell) return;
      clearOpenCellTimer();
      const oc = game.openCell;
      const board = game.boards[game.boardIndex];
      const cell = board.categories[oc.catIndex].cells[oc.cellIndex];
      if (oc.dailyDouble) {
        const ddPlayer = findPlayer(oc.ddPlayerId);
        const ready = ddPlayer && oc.ddStage === 'question';
        if (result === 'correct' && ready) {
          ddPlayer.score += oc.wager;
          ddPlayer.stats.correct += 1;
          ddPlayer.stats.bestDailyDouble = Math.max(ddPlayer.stats.bestDailyDouble, oc.wager);
          game.lastCorrectPlayerId = ddPlayer.id;
        } else if (result === 'incorrect' && ready) {
          ddPlayer.score -= oc.wager;
        } else if (result !== 'close') {
          return;
        }
        cell.used = true;
        game.openCell = null;
        broadcast();
        return;
      }

      const player = game.players.find((p) => p.id === oc.buzzedPlayerId);

      if (result === 'correct' && player) {
        player.score += oc.value;
        player.stats.correct += 1;
        game.lastCorrectPlayerId = player.id;
        cell.used = true;
        game.openCell = null;
      } else if (result === 'incorrect' && player) {
        player.score -= oc.value;
        oc.wrongPlayerIds.push(player.id);
        oc.buzzedPlayerId = null;
        const remaining = game.players.filter((p) => !oc.wrongPlayerIds.includes(p.id));
        if (remaining.length === 0) {
          cell.used = true;
          game.openCell = null;
        }
      } else if (result === 'close') {
        cell.used = true;
        game.openCell = null;
      }
      broadcast();
    });

    socket.on('host:nextBoard', () => {
      if (!hostAllowed) return;
      if (!game) return;
      clearOpenCellTimer();
      if (game.boardIndex === 0 && boardComplete(game.boards[0])) {
        game.boardIndex = 1;
      } else if (game.boardIndex === 1 && boardComplete(game.boards[1]) && game.status === 'playing') {
        startFinal();
      }
      broadcast();
    });

    socket.on('host:finalShowQuestion', () => {
      if (!hostAllowed) return;
      const f = game && game.final;
      if (!f || f.stage !== 'wager') return;
      // Anyone who did not lock a wager in time plays for nothing.
      f.eligibleIds.forEach((id) => {
        if (f.wagers[id] === undefined) f.wagers[id] = 0;
      });
      f.stage = 'question';
      f.deadline = Date.now() + FINAL_TIME_MS;
      clearFinalTimer();
      finalTimer = setTimeout(() => {
        finalTimer = null;
        endFinalQuestion();
        broadcast();
      }, FINAL_TIME_MS);
      broadcast();
    });

    socket.on('host:finalStopTime', () => {
      if (!hostAllowed) return;
      endFinalQuestion();
      broadcast();
    });

    socket.on('host:finalShowAnswer', () => {
      if (!hostAllowed) return;
      const f = game && game.final;
      if (!f || f.stage !== 'review' || f.currentShown) return;
      f.currentShown = true;
      broadcast();
    });

    socket.on('host:finalJudge', ({ result }) => {
      if (!hostAllowed) return;
      const f = game && game.final;
      if (!f || f.stage !== 'review' || !f.currentShown) return;
      const id = f.order[f.current];
      if (!id || f.results[id] || !['correct', 'incorrect'].includes(result)) return;
      const player = findPlayer(id);
      const wager = f.wagers[id] || 0;
      player.score += result === 'correct' ? wager : -wager;
      if (result === 'correct') player.stats.correct += 1;
      f.results[id] = result;
      broadcast();
    });

    socket.on('host:finalNext', () => {
      if (!hostAllowed) return;
      const f = game && game.final;
      if (!f) return;
      if (f.stage === 'review') {
        const id = f.order[f.current];
        if (!f.results[id]) return;
        if (f.current < f.order.length - 1) {
          f.current += 1;
          f.currentShown = false;
        } else {
          f.stage = 'answer';
        }
      } else if (f.stage === 'answer') {
        game.status = 'finished';
      }
      broadcast();
    });

    socket.on('player:wager', ({ amount }) => {
      if (!game) return;
      const playerId = socket.data.playerId;
      const value = Math.round(Number(amount));
      if (!playerId || !Number.isFinite(value)) return;

      const oc = game.openCell;
      if (oc && oc.dailyDouble && oc.ddStage === 'wager' && oc.ddPlayerId === playerId) {
        const { min, max } = ddLimits(playerId);
        if (value < min || value > max) return;
        oc.wager = value;
        oc.ddStage = 'locked';
        broadcast();
        return;
      }

      const f = game.final;
      if (f && f.stage === 'wager' && f.eligibleIds.includes(playerId)) {
        if (f.wagers[playerId] !== undefined) return;
        const player = findPlayer(playerId);
        if (value < 0 || value > player.score) return;
        f.wagers[playerId] = value;
        broadcast();
      }
    });

    // Drafts arrive while the player types, so a dropped phone still keeps
    // what was written. `submit` only marks it as sent; editing stays open
    // until the time runs out. No screen shows a draft, so a draft alone is
    // stored without a broadcast (ten typing phones would otherwise cause a
    // full re-render on every device several times a second).
    socket.on('player:finalAnswer', ({ text, submit }) => {
      const f = game && game.final;
      const playerId = socket.data.playerId;
      if (!f || f.stage !== 'question' || !f.eligibleIds.includes(playerId)) return;
      const clean = String(text || '')
        .replace(/[\u0000-\u001f\u007f]/g, ' ')
        .slice(0, FINAL_ANSWER_MAX);
      f.answers[playerId] = clean;
      if (submit && !f.submitted[playerId]) {
        f.submitted[playerId] = true;
        broadcast();
      }
    });

    socket.on('player:join', ({ code, name, clientId }, cb) => {
      ensureGame();
      if (!game || !code || code.toUpperCase() !== game.code) {
        return cb && cb({ error: strings.errors.wrongCode });
      }
      let player = game.players.find((p) => p.id === clientId);
      if (player) {
        player.socketId = socket.id;
        if (name) player.name = name;
      } else {
        if (game.status !== 'lobby') {
          return cb && cb({ error: strings.errors.alreadyStarted });
        }
        if (game.players.length >= MAX_PLAYERS) {
          return cb && cb({ error: strings.errors.full(MAX_PLAYERS) });
        }
        if (!name || !name.trim()) {
          return cb && cb({ error: strings.errors.needName });
        }
        player = {
          id: clientId,
          socketId: socket.id,
          name: name.trim().slice(0, 20),
          score: 0,
          // Real numbers from the evening, used for the awards at the end.
          stats: { correct: 0, fastestMs: null, bestDailyDouble: 0 },
        };
        game.players.push(player);
      }
      socket.join('players');
      socket.data.playerId = clientId;
      cb && cb({ ok: true, playerId: clientId });
      broadcast();
    });

    socket.on('player:buzz', () => {
      if (!game || !game.openCell) return;
      const playerId = socket.data.playerId;
      if (!playerId) return;
      const oc = game.openCell;
      if (oc.dailyDouble) return;
      if (oc.buzzedPlayerId) return;
      if (oc.wrongPlayerIds.includes(playerId)) return;
      if (!game.players.some((p) => p.id === playerId)) return;
      oc.buzzedPlayerId = playerId;
      oc.buzzMs = Date.now() - oc.openedAt;
      const buzzer = findPlayer(playerId);
      if (buzzer.stats.fastestMs === null || oc.buzzMs < buzzer.stats.fastestMs) {
        buzzer.stats.fastestMs = oc.buzzMs;
      }
      oc.deadline = null;
      clearOpenCellTimer();
      broadcast();
    });

    socket.on('disconnect', () => {
      if (!game) return;
      const player = game.players.find((p) => p.socketId === socket.id);
      if (player) {
        player.socketId = null;
        broadcast();
      }
    });
  });
}

module.exports = { createGameManager };
