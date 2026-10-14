import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Head from 'next/head';
import io from 'socket.io-client';
import { strings, formatPoints } from '../lib/strings';
import { useCountdown } from '../lib/useCountdown';
import { prefersReducedMotion } from '../lib/useScoreChange';
import { computeAwards, seconds } from '../lib/awards';
import Countdown from '../components/Countdown';
import HostHeader from '../components/HostHeader';
import Lobby from '../components/Lobby';
import FinalScores from '../components/FinalScores';

const QUESTION_SECONDS = 20;
const FINAL_SECONDS = 30;
const EASE_OUT = 'cubic-bezier(0.16, 1, 0.3, 1)';

// Screen rect of the board cell the host just clicked. The question card
// grows out of it, so the room sees which cell was picked.
let pickedCellRect = null;

function useGrowFromCell(ref, { turn }) {
  const [origin] = useState(() => {
    const rect = pickedCellRect;
    pickedCellRect = null;
    return rect;
  });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !origin || prefersReducedMotion() || !el.animate) return;
    const to = el.getBoundingClientRect();
    const dx = origin.left + origin.width / 2 - (to.left + to.width / 2);
    const dy = origin.top + origin.height / 2 - (to.top + to.height / 2);
    const sx = origin.width / to.width;
    const sy = origin.height / to.height;
    const duration = turn ? 720 : 480;
    el.animate(
      [
        {
          transform: `perspective(1400px) translate(${dx}px, ${dy}px) scale(${sx}, ${sy}) rotateY(${turn ? -180 : 0}deg)`,
        },
        { transform: 'perspective(1400px) translate(0px, 0px) scale(1, 1) rotateY(0deg)' },
      ],
      { duration, easing: EASE_OUT }
    );
    // The content would stretch with the card, so it waits until the card
    // has nearly landed. The Daily Double stamp has its own entrance.
    Array.from(el.children)
      .filter((c) => !c.classList.contains('dd-stamp'))
      .forEach((c) =>
        c.animate([{ opacity: 0 }, { opacity: 0, offset: 0.55 }, { opacity: 1 }], {
          duration: duration + 120,
        })
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return !!origin;
}

// Studio sounds on the TV. The host can mute them from the header; the
// choice is remembered on this machine.
let soundOn = true;
let audioCtx = null;

function playNotes(type, notes, volume) {
  if (!soundOn) return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audioCtx = audioCtx || new Ctx();
    const now = audioCtx.currentTime;
    notes.forEach(([freq, at, length]) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now + at);
      gain.gain.setValueAtTime(volume, now + at);
      gain.gain.exponentialRampToValueAtTime(0.001, now + at + length);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(now + at);
      osc.stop(now + at + length + 0.01);
    });
  } catch (e) {
    // audio not available, ignore
  }
}

function playWrongSound() {
  playNotes('sawtooth', [[220, 0, 0.14], [160, 0.15, 0.14]], 0.2);
}

// A short rising blip the moment someone wins the buzz race.
function playBuzzSound() {
  playNotes('square', [[660, 0, 0.07], [990, 0.07, 0.12]], 0.12);
}

// A bright two-note chime for a correct answer.
function playCorrectSound() {
  playNotes('sine', [[784, 0, 0.18], [1175, 0.12, 0.32]], 0.22);
}

function useSoundSetting() {
  const [on, setOn] = useState(true);
  useEffect(() => {
    try {
      const saved = localStorage.getItem('jeopardy_sound') !== 'off';
      soundOn = saved;
      setOn(saved);
    } catch (e) {
      // storage unavailable; keep sound on
    }
  }, []);
  function toggle() {
    soundOn = !on;
    setOn(!on);
    try {
      localStorage.setItem('jeopardy_sound', !on ? 'on' : 'off');
    } catch (e) {
      // not essential
    }
  }
  return [on, toggle];
}

export default function Host() {
  const [state, setState] = useState(null);
  const [denied, setDenied] = useState(false);
  const [sound, toggleSound] = useSoundSetting();
  const socketRef = useRef(null);
  const lastBuzzer = useRef(null);

  useEffect(() => {
    const socket = io();
    socketRef.current = socket;
    socket.on('connect', () => {
      socket.emit('host:hello', (s) => s && setState(s));
    });
    socket.on('host:denied', () => setDenied(true));
    socket.on('state:host', (s) => setState(s));
    return () => socket.disconnect();
  }, []);

  const buzzerId = state && state.openCell ? state.openCell.buzzedPlayerId : null;
  useEffect(() => {
    if (buzzerId && buzzerId !== lastBuzzer.current) playBuzzSound();
    lastBuzzer.current = buzzerId;
  }, [buzzerId]);

  const head = (
    <Head>
      <title>{strings.titleHost}</title>
    </Head>
  );

  if (denied) {
    return (
      <main className="center-page">
        {head}
        <h1 className="page-heading">{strings.hostDeniedTitle}</h1>
        <p className="hint">{strings.hostDeniedHint}</p>
      </main>
    );
  }

  if (!state) {
    return (
      <div className="center-page">
        {head}
        {strings.connecting}
      </div>
    );
  }

  const socket = socketRef.current;

  function startNewGame() {
    socket.emit('host:new', (s) => setState(s));
  }

  if (state.error) {
    return (
      <main className="center-page">
        {head}
        <h1 className="page-heading">{strings.bankErrorTitle}</h1>
        <p className="hint">{state.error}</p>
        <p className="hint">{strings.bankErrorHint}</p>
        <button className="btn btn-gold" onClick={startNewGame}>
          {strings.tryAgain}
        </button>
      </main>
    );
  }

  return (
    <div className="host-page">
      {head}
      <HostHeader
        code={state.code}
        players={state.players}
        ringedPlayerId={ringedPlayerId(state)}
        onNewGame={startNewGame}
      >
        <button className="btn btn-small" onClick={toggleSound} aria-pressed={sound}>
          {sound ? strings.soundOn : strings.soundOff}
        </button>
      </HostHeader>

      {state.status === 'lobby' && <Lobby state={state} onStart={() => socket.emit('host:start')} />}
      {state.status === 'playing' && <Board state={state} socket={socket} />}
      {state.status === 'final' && state.final && <FinalRound state={state} socket={socket} />}
      {state.status === 'finished' && <FinalScores players={state.players} awards={computeAwards(state.players)} />}
    </div>
  );
}

// The player the room should look at right now gets a ring in the scoreboard.
function ringedPlayerId(state) {
  const oc = state.openCell;
  if (oc) return oc.dailyDouble ? oc.ddPlayerId : oc.buzzedPlayerId;
  const f = state.final;
  if (state.status === 'final' && f && f.stage === 'review') return f.order[f.current];
  return null;
}

function Board({ state, socket }) {
  const board = state.boards[state.boardIndex];
  const complete = state.boardIndex === 0 ? state.board1Complete : state.board2Complete;
  const [hintIndex, setHintIndex] = useState(null);
  const boardRef = useRef(null);
  const hadOpenCell = useRef(false);
  const lastIndex = board.categories.length - 1;
  // The columns rise in only the first time each board appears; coming back
  // from a question the board simply fades in.
  const [introDone, setIntroDone] = useState(() => new Set());
  const intro = !introDone.has(state.boardIndex);

  useEffect(() => {
    if (!intro) return;
    const id = setTimeout(
      () => setIntroDone((done) => new Set(done).add(state.boardIndex)),
      1200
    );
    return () => clearTimeout(id);
  }, [intro, state.boardIndex]);

  useEffect(() => {
    if (hintIndex === null) return;
    const closeOnOutsideClick = (e) => {
      if (!e.target.closest('.category-name')) setHintIndex(null);
    };
    const closeOnEscape = (e) => {
      if (e.key === 'Escape') setHintIndex(null);
    };
    window.addEventListener('click', closeOnOutsideClick);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('click', closeOnOutsideClick);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [hintIndex]);

  // After a question closes its cell is gone, so hand keyboard focus to the
  // next open cell instead of letting it fall back to the top of the page.
  useEffect(() => {
    if (state.openCell) {
      hadOpenCell.current = true;
    } else if (hadOpenCell.current) {
      hadOpenCell.current = false;
      const next = boardRef.current && boardRef.current.querySelector('.cell:not(:disabled)');
      if (next) next.focus();
    }
  }, [state.openCell]);

  function openCell(catIndex, cellIndex, e) {
    pickedCellRect = e.currentTarget.getBoundingClientRect();
    setHintIndex(null);
    socket.emit('host:openCell', { catIndex, cellIndex });
  }

  return (
    <main className="board" ref={boardRef}>
      <div className="board-title" key={`title-${state.boardIndex}`}>
        <h1>{strings.board(state.boardIndex + 1)}</h1>
        {board.multiplier > 1 && <span className="board-badge">{strings.doublePoints}</span>}
      </div>

      {!state.openCell && !complete && (
        <div
          className={`board-grid ${intro ? 'board-intro' : 'board-back'}`}
          key={`grid-${state.boardIndex}`}
          style={{ gridTemplateColumns: `repeat(${board.categories.length}, minmax(0, 1fr))` }}
        >
          {board.categories.map((cat, ci) => (
            <div
              key={ci}
              className={`category-col ${hintIndex === ci ? 'hint-open' : ''}`}
              style={{ animationDelay: `${ci * 70}ms` }}
            >
              <div className="category-name">
                <span>{cat.name}</span>
                {cat.hint && (
                  <button
                    className="hint-btn"
                    aria-label={strings.hintAria}
                    aria-expanded={hintIndex === ci}
                    aria-describedby={hintIndex === ci ? `hint-${ci}` : undefined}
                    onClick={() => setHintIndex(hintIndex === ci ? null : ci)}
                  >
                    ?
                  </button>
                )}
                {hintIndex === ci && cat.hint && (
                  <div
                    id={`hint-${ci}`}
                    className={`hint-tooltip ${ci === 0 ? 'hint-start' : ''} ${ci === lastIndex ? 'hint-end' : ''}`}
                    role="tooltip"
                  >
                    {cat.hint}
                  </div>
                )}
              </div>
              {cat.cells.map((cell, vi) => (
                <button
                  key={vi}
                  className="cell"
                  disabled={cell.used}
                  onClick={(e) => openCell(ci, vi, e)}
                >
                  {cell.used ? '' : cell.value}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      {state.openCell &&
        (state.openCell.dailyDouble ? (
          <DailyDoublePanel state={state} socket={socket} />
        ) : (
          <QuestionPanel state={state} socket={socket} />
        ))}

      {!state.openCell && complete && (
        <div className="board-done">
          <button className="btn btn-gold btn-lg" onClick={() => socket.emit('host:nextBoard')}>
            {state.boardIndex === 0
              ? strings.goToBoard2
              : state.players.some((p) => p.score > 0)
                ? strings.goToFinal
                : strings.endGame}
          </button>
        </div>
      )}
    </main>
  );
}

function QuestionPanel({ state, socket }) {
  const oc = state.openCell;
  const buzzedPlayer = state.players.find((p) => p.id === oc.buzzedPlayerId);
  const remaining = useCountdown(oc.deadline, state.serverTime);
  const panelRef = useRef(null);
  const fromCell = useGrowFromCell(panelRef, { turn: false });

  // Move keyboard focus into the question when it opens.
  useEffect(() => {
    if (panelRef.current) panelRef.current.focus();
  }, []);

  function handleWrong() {
    playWrongSound();
    socket.emit('host:resolve', { result: 'incorrect' });
  }

  function handleCorrect() {
    playCorrectSound();
    socket.emit('host:resolve', { result: 'correct' });
  }

  return (
    <section
      className={`question-panel ${fromCell ? 'from-cell' : ''}`}
      ref={panelRef}
      tabIndex={-1}
    >
      <div className="panel-stage">
        <div className="q-cat">
          {oc.category} · {formatPoints(oc.value)}
        </div>
        <h2 className="q-text">{oc.question}</h2>
        <Countdown remaining={remaining} total={QUESTION_SECONDS} />
        {oc.revealed && (
          <div className="q-answer-revealed">
            {strings.answerPrefix} {oc.answer}
          </div>
        )}
        {buzzedPlayer ? (
          <div className="buzzed-name q-buzzed" role="status">
            {strings.playerBuzzed(buzzedPlayer.name)}
            {oc.buzzMs !== null && (
              <span className="buzz-time">{strings.buzzTime(seconds(oc.buzzMs))}</span>
            )}
          </div>
        ) : (
          <div className="q-status">{strings.waitingForBuzz}</div>
        )}
      </div>

      <div className="panel-controls">
        <button
          className="btn btn-small"
          onClick={() => socket.emit('host:resolve', { result: 'close' })}
        >
          {strings.closeNoScore}
        </button>
        <div className="panel-primary">
          {!oc.revealed && (
            <button className="btn btn-gold" onClick={() => socket.emit('host:reveal')}>
              {strings.showAnswer}
            </button>
          )}
          {buzzedPlayer && (
            <>
              <button className="btn btn-correct" onClick={handleCorrect}>
                {strings.correct(oc.value)}
              </button>
              <button className="btn btn-wrong" onClick={handleWrong}>
                {strings.wrong(oc.value)}
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function PlayerTag({ players, id }) {
  const i = players.findIndex((p) => p.id === id);
  if (i < 0) return null;
  return <span className={`player-tag pc-${i % 10}`}>{players[i].name}</span>;
}

function DailyDoublePanel({ state, socket }) {
  const oc = state.openCell;
  const players = state.players;
  const ddPlayer = players.find((p) => p.id === oc.ddPlayerId);
  const name = ddPlayer ? ddPlayer.name : '';
  const asking = oc.ddStage === 'question';
  const panelRef = useRef(null);
  const fromCell = useGrowFromCell(panelRef, { turn: true });

  useEffect(() => {
    if (panelRef.current) panelRef.current.focus();
  }, []);

  function handleWrong() {
    playWrongSound();
    socket.emit('host:resolve', { result: 'incorrect' });
  }

  function handleCorrect() {
    playCorrectSound();
    socket.emit('host:resolve', { result: 'correct' });
  }

  return (
    <section
      className={`question-panel dd-panel ${asking ? 'dd-asking' : 'dd-intro'} ${fromCell ? 'from-cell' : ''}`}
      ref={panelRef}
      tabIndex={-1}
    >
      <div className="dd-stamp">{strings.dailyDouble}</div>
      <div className="q-cat">{oc.category}</div>

      {oc.ddStage === 'pick' && (
        <div className="dd-body" key="pick">
          <h2 className="dd-heading">{strings.ddWhoGets}</h2>
          <p className="dd-hint">{strings.ddWhoGetsHint}</p>
          <div className="dd-pick">
            {players.map((p, i) => (
              <button
                key={p.id}
                className={`dd-pick-btn pc-${i % 10} ${p.connected ? '' : 'offline'}`}
                onClick={() => socket.emit('host:ddAssign', { playerId: p.id })}
              >
                <span className="dd-pick-name">{p.name}</span>
                <span className="dd-pick-score">
                  {p.connected ? formatPoints(p.score) : strings.offline}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {oc.ddStage === 'wager' && (
        <div className="dd-body" key="wager">
          <PlayerTag players={players} id={oc.ddPlayerId} />
          <p className="dd-waiting" role="status">
            {strings.ddWaitingWager(name)}
          </p>
        </div>
      )}

      {oc.ddStage === 'locked' && (
        <div className="dd-body" key="locked">
          <PlayerTag players={players} id={oc.ddPlayerId} />
          <h2 className="dd-wager" role="status">
            {strings.ddWagerLocked(name, formatPoints(oc.wager))}
          </h2>
        </div>
      )}

      {asking && (
        <div className="dd-body dd-question" key="question">
          <h2 className="q-text">{oc.question}</h2>
          {oc.revealed && (
            <div className="q-answer-revealed">
              {strings.answerPrefix} {oc.answer}
            </div>
          )}
          <div className="buzzed-name q-buzzed" role="status">
            {strings.ddAnswering(name, formatPoints(oc.wager))}
          </div>
        </div>
      )}

      <div className="panel-controls">
        <div className="panel-secondary">
          <button
            className="btn btn-small"
            onClick={() => socket.emit('host:resolve', { result: 'close' })}
          >
            {strings.closeNoScore}
          </button>
          {oc.ddStage === 'wager' && (
            <button
              className="btn btn-small"
              onClick={() => socket.emit('host:ddAssign', { playerId: null })}
            >
              {strings.ddGiveToOther}
            </button>
          )}
        </div>
        <div className="panel-primary">
          {oc.ddStage === 'locked' && (
            <button
              className="btn btn-gold"
              onClick={() => socket.emit('host:ddShowQuestion')}
              autoFocus
            >
              {strings.ddShowQuestion}
            </button>
          )}
          {asking && !oc.revealed && (
            <button className="btn btn-gold" onClick={() => socket.emit('host:reveal')}>
              {strings.showAnswer}
            </button>
          )}
          {asking && (
            <>
              <button className="btn btn-correct" onClick={handleCorrect}>
                {strings.correct(oc.wager)}
              </button>
              <button className="btn btn-wrong" onClick={handleWrong}>
                {strings.wrong(oc.wager)}
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function FinalRound({ state, socket }) {
  const f = state.final;
  const players = state.players;
  const remaining = useCountdown(f.deadline, state.serverTime);
  const eligible = players.filter((p) => f.eligibleIds.includes(p.id));
  const sittingOut = players.filter((p) => !f.eligibleIds.includes(p.id));
  const wagered = eligible.filter((p) => f.wagers[p.id] !== undefined).length;
  const sent = eligible.filter((p) => f.submitted[p.id]).length;

  function statusRow(statusOf) {
    return (
      <ul className="final-roster">
        {eligible.map((p) => {
          const i = players.indexOf(p);
          const { label, done } = statusOf(p);
          return (
            <li
              key={p.id}
              className={`roster-chip pc-${i % 10} ${done ? 'is-done' : ''} ${p.connected ? '' : 'offline'}`}
            >
              <span className="roster-name">{p.name}</span>
              <span className="roster-status">
                {p.connected || done ? label : strings.offline}
              </span>
            </li>
          );
        })}
        {sittingOut.map((p) => (
          <li key={p.id} className="roster-chip is-out">
            <span className="roster-name">{p.name}</span>
            <span className="roster-status">{strings.finalSitsOut}</span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <main className="final-stage">
      <section className={`question-panel final-panel final-${f.stage}`} key={f.stage}>
        <div className="final-mark">{strings.final}</div>

        {f.stage === 'wager' && (
          <>
            <p className="final-intro">{strings.finalCategoryIntro}</p>
            <h2 className="final-category">{f.category}</h2>
            <p className="dd-hint">{strings.finalWagerHint}</p>
            {statusRow((p) =>
              f.wagers[p.id] !== undefined
                ? { label: strings.finalLocked, done: true }
                : { label: strings.finalWaiting, done: false }
            )}
            <button
              className="btn btn-gold btn-lg"
              onClick={() => socket.emit('host:finalShowQuestion')}
            >
              {strings.finalShowQuestion(wagered, eligible.length)}
            </button>
          </>
        )}

        {f.stage === 'question' && (
          <>
            <div className="q-cat">{f.category}</div>
            <h2 className="q-text">{f.question}</h2>
            <Countdown remaining={remaining} total={FINAL_SECONDS} />
            {statusRow((p) =>
              f.submitted[p.id]
                ? { label: strings.finalSent, done: true }
                : { label: strings.finalTyping, done: false }
            )}
            {sent === eligible.length ? (
              <button
                className="btn btn-gold btn-lg"
                onClick={() => socket.emit('host:finalStopTime')}
                autoFocus
              >
                {strings.finalAllSent}
              </button>
            ) : (
              <button className="btn btn-small" onClick={() => socket.emit('host:finalStopTime')}>
                {strings.finalStopTime}
              </button>
            )}
          </>
        )}

        {f.stage === 'review' && <FinalReview state={state} socket={socket} />}

        {f.stage === 'answer' && (
          <>
            <div className="q-cat">{f.category}</div>
            <p className="final-question-small">{f.question}</p>
            <div className="final-fasit">
              <span className="final-fasit-label">{strings.finalFasit}</span>
              <span className="final-fasit-text">{f.answer}</span>
            </div>
            <button
              className="btn btn-gold btn-lg"
              onClick={() => socket.emit('host:finalNext')}
              autoFocus
            >
              {strings.finalToResults}
            </button>
          </>
        )}
      </section>
    </main>
  );
}

function FinalReview({ state, socket }) {
  const f = state.final;
  const players = state.players;
  const id = f.order[f.current];
  const pi = players.findIndex((p) => p.id === id);
  const player = players[pi];
  const result = f.results[id];
  const text = (f.answers[id] || '').trim();
  const isLast = f.current === f.order.length - 1;

  function judge(r) {
    if (r === 'incorrect') playWrongSound();
    else playCorrectSound();
    socket.emit('host:finalJudge', { result: r });
  }

  return (
    <>
      <ol className="final-order" aria-label={strings.finalOrderHint}>
        {f.order.map((oid, n) => {
          const i = players.findIndex((p) => p.id === oid);
          const r = f.results[oid];
          return (
            <li
              key={oid}
              className={`order-step pc-${i % 10} ${n === f.current ? 'is-current' : ''} ${r ? `is-${r}` : ''}`}
              aria-current={n === f.current ? 'step' : undefined}
            >
              <span className="roster-name">{players[i].name}</span>
              {r && (
                <span className="roster-status">
                  {r === 'correct' ? strings.finalResultCorrect : strings.finalResultWrong}
                </span>
              )}
            </li>
          );
        })}
      </ol>

      <div className={`final-card pc-${pi % 10}`} key={id}>
        <div className="final-card-name">{player.name}</div>
        {f.currentShown ? (
          <div className={`final-card-answer ${text ? '' : 'is-empty'}`}>
            {text || strings.finalNoAnswer}
          </div>
        ) : (
          <div className="final-card-answer is-hidden">{strings.finalHidden}</div>
        )}
        {result && (
          <div className={`final-card-result is-${result}`} role="status">
            <span className="final-card-verdict">
              {result === 'correct' ? strings.finalResultCorrect : strings.finalResultWrong}
            </span>
            <span>
              {strings.finalWagered(formatPoints(f.wagers[id] || 0))} ·{' '}
              {strings.finalNowHas(formatPoints(player.score))}
            </span>
          </div>
        )}
      </div>

      <div className="final-actions">
        {!f.currentShown && (
          <button
            className="btn btn-gold btn-lg"
            onClick={() => socket.emit('host:finalShowAnswer')}
            autoFocus
          >
            {strings.finalRevealOf(player.name)}
          </button>
        )}
        {f.currentShown && !result && (
          <div className="resolve-buttons">
            <button className="btn btn-correct btn-lg" onClick={() => judge('correct')} autoFocus>
              {strings.finalResultCorrect}
            </button>
            <button className="btn btn-wrong btn-lg" onClick={() => judge('incorrect')}>
              {strings.finalResultWrong}
            </button>
          </div>
        )}
        {result && (
          <button
            className="btn btn-gold btn-lg"
            onClick={() => socket.emit('host:finalNext')}
            autoFocus
          >
            {isLast ? strings.finalShowFasit : strings.finalNextPlayer}
          </button>
        )}
      </div>
    </>
  );
}
