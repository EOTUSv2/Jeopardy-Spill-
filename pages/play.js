import { useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import io from 'socket.io-client';
import { strings, formatPoints } from '../lib/strings';
import { useCountdown } from '../lib/useCountdown';
import { useScoreChange, formatDelta } from '../lib/useScoreChange';
import { computeAwards, seconds } from '../lib/awards';

function vibrate(pattern) {
  if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(pattern);
}

// The browser bar takes the player's colour too, so the whole phone is theirs.
function useBrowserTint(myIndex) {
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    const original = meta.getAttribute('content');
    if (myIndex >= 0) {
      const colour = getComputedStyle(document.documentElement)
        .getPropertyValue(`--p-${myIndex % 10}`)
        .trim();
      if (colour) meta.setAttribute('content', colour);
    }
    return () => meta.setAttribute('content', original);
  }, [myIndex]);
}

function getClientId() {
  if (typeof window === 'undefined') return null;
  let id = localStorage.getItem('jeopardy_playerId');
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem('jeopardy_playerId', id);
  }
  return id;
}

// Keep the phone screen awake while playing, so the player is not dropped
// from the game when the display locks. Silently skipped where unsupported.
function useWakeLock(active) {
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !navigator.wakeLock) return;
    let lock = null;
    let cancelled = false;
    const acquire = async () => {
      try {
        lock = await navigator.wakeLock.request('screen');
        if (cancelled && lock) lock.release();
      } catch (e) {
        // denied (e.g. low battery); not essential
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') acquire();
    };
    acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      if (lock) lock.release().catch(() => {});
    };
  }, [active]);
}

export default function Play() {
  const [state, setState] = useState(null);
  const [joined, setJoined] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const socketRef = useRef(null);
  const clientIdRef = useRef(null);

  useWakeLock(joined);

  useEffect(() => {
    clientIdRef.current = getClientId();
    const savedCode = sessionStorage.getItem('jeopardy_code');
    const savedName = sessionStorage.getItem('jeopardy_name');
    if (savedCode) setCode(savedCode);
    if (savedName) setName(savedName);

    const socket = io();
    socketRef.current = socket;
    socket.on('state:player', (s) => setState(s));

    if (savedCode && savedName) {
      socket.on('connect', () => tryJoin(savedCode, savedName, true));
    }

    return () => socket.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function tryJoin(codeVal, nameVal, silent) {
    const socket = socketRef.current;
    socket.emit(
      'player:join',
      { code: codeVal.trim().toUpperCase(), name: nameVal, clientId: clientIdRef.current },
      (res) => {
        if (res && res.error) {
          if (!silent) setError(res.error);
        } else {
          setJoined(true);
          setError('');
          sessionStorage.setItem('jeopardy_code', codeVal.trim().toUpperCase());
          sessionStorage.setItem('jeopardy_name', nameVal);
        }
      }
    );
  }

  function handleJoin(e) {
    e.preventDefault();
    if (!code.trim() || !name.trim()) return;
    tryJoin(code, name, false);
  }

  if (!joined) {
    return (
      <main className="center-page">
      <Head>
        <title>{strings.titlePlay}</title>
      </Head>
        <h1 className="title">{strings.joinTitle}</h1>
        <form onSubmit={handleJoin} className="join-form">
          <input
            className="input"
            placeholder={strings.codePlaceholder}
            aria-label={strings.codePlaceholder}
            value={code}
            maxLength={4}
            autoCapitalize="characters"
            autoComplete="off"
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
          <input
            className="input"
            placeholder={strings.namePlaceholder}
            aria-label={strings.namePlaceholder}
            value={name}
            maxLength={20}
            autoComplete="off"
            onChange={(e) => setName(e.target.value)}
          />
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          <button className="btn btn-gold btn-lg" type="submit">
            {strings.joinButton}
          </button>
        </form>
      </main>
    );
  }

  if (!state) {
    return (
      <div className="center-page">
      <Head>
        <title>{strings.titlePlay}</title>
      </Head>
        {strings.connecting}
      </div>
    );
  }

  return <PlayerGame state={state} socket={socketRef.current} />;
}

function PlayerGame({ state, socket }) {
  const oc = state.openCell;
  const remaining = useCountdown(oc && oc.deadline, state.serverTime);
  const myIndex = state.players.findIndex((p) => state.me && p.id === state.me.id);
  const tint = myIndex >= 0 ? `player-tinted pc-${myIndex % 10}` : '';
  useBrowserTint(myIndex);

  // The press itself only ticks; winning the race is a clear double pulse.
  const wonBuzz = !!(oc && oc.isMine && !oc.dailyDouble);
  useEffect(() => {
    if (wonBuzz) vibrate([60, 40, 160]);
  }, [wonBuzz]);

  if (state.status === 'lobby') {
    return (
      <main className={`center-page ${tint}`}>
      <Head>
        <title>{strings.titlePlay}</title>
      </Head>
        <h1 className="page-heading">{strings.youAreIn}</h1>
        <p className="hint">{strings.waitingHostStart}</p>
        <div className="player-slots">
          {state.players.map((p, i) => (
            <div
              key={p.id}
              className={`player-slot filled pc-${i % 10} ${state.me && p.id === state.me.id ? 'is-me' : ''}`}
            >
              {p.name}
              {state.me && p.id === state.me.id ? strings.youSuffix : ''}
            </div>
          ))}
        </div>
      </main>
    );
  }

  if (state.status === 'final' && state.final) {
    return <PlayerFinal state={state} socket={socket} />;
  }

  if (state.status === 'finished') {
    const sorted = [...state.players].sort((a, b) => b.score - a.score);
    const rank = sorted.findIndex((p) => state.me && p.id === state.me.id) + 1;
    return (
      <main className={`center-page ${tint}`}>
      <Head>
        <title>{strings.titlePlay}</title>
      </Head>
        <h1>{strings.finished}</h1>
        <p className="hint">
          {strings.finishedResult(rank, formatPoints(state.me ? state.me.score : 0))}
        </p>
        {computeAwards(state.players)
          .filter((a) => state.me && a.playerId === state.me.id)
          .map((a) => (
            <p key={a.id} className="my-award">
              {strings.youWonAward(a.title, a.value)}
            </p>
          ))}
      </main>
    );
  }

  let buzzDisabled = true;
  let statusText = strings.waitingHostOpen;

  const meId = state.me && state.me.id;
  const ddName = (oc && state.players.find((p) => p.id === oc.ddPlayerId) || {}).name || '';

  if (oc && oc.dailyDouble && oc.ddPlayerId === meId && oc.ddStage === 'wager' && oc.ddLimits) {
    const { min, max } = oc.ddLimits;
    const step = min;
    return (
      <PlayerShell state={state} myIndex={myIndex}>
        <h1 className="dd-phone-title">{strings.dailyDouble}</h1>
        <p className="status-text">{strings.ddYouGot}</p>
        <WagerControl
          key={`dd-${oc.category}-${oc.value}`}
          min={min}
          max={max}
          step={step}
          initial={min}
          hint={strings.ddYourWagerHint(formatPoints(min), formatPoints(max))}
          quick={[
            { label: strings.wagerMin, value: min },
            { label: strings.wagerHalf, value: Math.max(min, Math.floor(max / 2 / step) * step) },
            { label: strings.wagerMax, value: max },
          ]}
          onLock={(amount) => socket.emit('player:wager', { amount })}
        />
      </PlayerShell>
    );
  }

  if (oc && oc.dailyDouble) {
    const mine = oc.ddPlayerId === meId;
    let ddText = strings.ddHostPicking;
    if (oc.revealed) ddText = `${strings.answerPrefix} ${oc.answer}`;
    else if (mine && oc.wager !== null) ddText = strings.ddYouWagered(formatPoints(oc.wager));
    else if (oc.ddStage === 'wager') ddText = strings.ddOtherWagering(ddName);
    else if (oc.wager !== null) ddText = strings.ddOtherLocked(ddName, formatPoints(oc.wager));
    return (
      <PlayerShell state={state} myIndex={myIndex}>
        <h1 className="dd-phone-title">{strings.dailyDouble}</h1>
        <p className="status-text" aria-live="polite">
          {ddText}
        </p>
      </PlayerShell>
    );
  }

  if (oc) {
    if (oc.revealed) {
      statusText = `${strings.answerPrefix} ${oc.answer}`;
    } else if (oc.isMine) {
      statusText =
        oc.buzzMs !== null ? strings.youBuzzedIn(seconds(oc.buzzMs)) : strings.youBuzzed;
    } else if (oc.iBuzzedWrong) {
      statusText = strings.youBuzzedWrong;
    } else if (oc.buzzedPlayerId) {
      const other = state.players.find((p) => p.id === oc.buzzedPlayerId);
      statusText = strings.otherBuzzed(other ? other.name : '');
    } else {
      statusText = `${oc.category} · ${formatPoints(oc.value)}`;
      buzzDisabled = false;
    }
  }

  function handleBuzz() {
    vibrate(25);
    socket.emit('player:buzz');
  }

  return (
    <main
      className={`player-game buzz-layout ${myIndex >= 0 ? `player-tinted pc-${myIndex % 10}` : ''}`}
    >
      <Head>
        <title>{strings.titlePlay}</title>
      </Head>
      <MyScore me={state.me} />
      <div className="status-text" aria-live="polite">
        {statusText}
      </div>
      {remaining !== null && !buzzDisabled && (
        <div className={`countdown ${remaining <= 5 ? 'countdown-urgent' : ''}`}>
          <span className="countdown-num">{remaining}</span>
        </div>
      )}
      <button
        className={`buzz-button ${buzzDisabled ? 'disabled' : ''}`}
        disabled={buzzDisabled}
        onClick={handleBuzz}
      >
        BUZZ
      </button>
    </main>
  );
}

function PlayerShell({ state, myIndex, children }) {
  return (
    <main className={`player-game ${myIndex >= 0 ? `player-tinted pc-${myIndex % 10}` : ''}`}>
      <Head>
        <title>{strings.titlePlay}</title>
      </Head>
      <MyScore me={state.me} />
      {children}
    </main>
  );
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

// One big number with steppers and quick picks, so a wager takes two taps and
// no keyboard. The number itself is still an input for exact amounts.
function WagerControl({ min, max, step, initial, hint, quick, onLock }) {
  const [value, setValue] = useState(initial);
  const [draft, setDraft] = useState(String(initial));
  const [locking, setLocking] = useState(false);

  // A rejected wager never changes the state, so free the button again.
  useEffect(() => {
    if (!locking) return;
    const id = setTimeout(() => setLocking(false), 3000);
    return () => clearTimeout(id);
  }, [locking]);

  function set(n) {
    const v = clamp(Math.round(n), min, max);
    setValue(v);
    setDraft(String(v));
  }

  const parsed = Number(draft);
  const draftValid = draft.trim() !== '' && Number.isFinite(parsed) && parsed >= min && parsed <= max;

  function lock() {
    if (!draftValid || locking) return;
    setLocking(true);
    onLock(Math.round(parsed));
  }

  return (
    <div className="wager">
      <p className="wager-hint" id="wager-hint">
        {hint}
      </p>
      <div className="wager-dial">
        <button
          type="button"
          className="wager-step"
          onClick={() => set(value - step)}
          disabled={value <= min}
        >
          {strings.wagerLess}
        </button>
        <label className="wager-value">
          <span className="visually-hidden">{strings.wagerLabel}</span>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            className="wager-input"
            aria-describedby="wager-hint"
            aria-invalid={!draftValid}
            value={draft}
            onChange={(e) => {
              const d = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
              setDraft(d);
              if (d !== '') setValue(clamp(Number(d), min, max));
            }}
            onBlur={() => set(draft === '' ? min : Number(draft))}
          />
          <span className="wager-unit">{strings.wagerUnit}</span>
        </label>
        <button
          type="button"
          className="wager-step"
          onClick={() => set(value + step)}
          disabled={value >= max}
        >
          {strings.wagerMore}
        </button>
      </div>
      <div className="wager-quick">
        {quick.map((q) => (
          <button
            key={q.label}
            type="button"
            className={`wager-chip ${draftValid && parsed === q.value ? 'is-on' : ''}`}
            onClick={() => set(q.value)}
          >
            {q.label}
          </button>
        ))}
      </div>
      <button className="btn btn-gold btn-lg wager-lock" onClick={lock} disabled={!draftValid || locking}>
        {strings.wagerLock(formatPoints(draftValid ? Math.round(parsed) : value))}
      </button>
    </div>
  );
}

function PlayerFinal({ state, socket }) {
  const f = state.final;
  const myIndex = state.players.findIndex((p) => state.me && p.id === state.me.id);
  const score = state.me ? state.me.score : 0;

  if (!f.eligible) {
    return (
      <PlayerShell state={state} myIndex={myIndex}>
        <h1 className="dd-phone-title">{strings.final}</h1>
        <p className="status-text">{strings.finalYouSitOut}</p>
        {f.question && <p className="final-phone-question">{f.question}</p>}
        {f.answer && (
          <p className="final-phone-fasit">
            {strings.finalFasit}: {f.answer}
          </p>
        )}
      </PlayerShell>
    );
  }

  if (f.stage === 'wager') {
    return (
      <PlayerShell state={state} myIndex={myIndex}>
        <h1 className="dd-phone-title">{strings.final}</h1>
        <div className="final-phone-cat">{f.category}</div>
        {f.myWager === null ? (
          <WagerControl
            min={0}
            max={score}
            step={100}
            initial={0}
            hint={strings.finalYourWagerHint(formatPoints(score))}
            quick={[
              { label: strings.wagerNothing, value: 0 },
              { label: strings.wagerHalf, value: Math.floor(score / 2) },
              { label: strings.wagerAll, value: score },
            ]}
            onLock={(amount) => socket.emit('player:wager', { amount })}
          />
        ) : (
          <p className="status-text" aria-live="polite">
            {strings.finalYouWagered(formatPoints(f.myWager))}
          </p>
        )}
      </PlayerShell>
    );
  }

  if (f.stage === 'question') {
    return <FinalAnswerForm state={state} socket={socket} myIndex={myIndex} />;
  }

  const text = f.myAnswer.trim();
  return (
    <PlayerShell state={state} myIndex={myIndex}>
      <h1 className="dd-phone-title">{strings.final}</h1>
      <p className="final-phone-locked">
        {text ? strings.finalYourLocked(text) : strings.finalYourLockedEmpty}
      </p>
      <p className="status-text" aria-live="polite">
        {!f.myResult
          ? strings.finalWaitingReveal
          : f.myWager
            ? strings.finalYourResult(f.myResult === 'correct', formatPoints(f.myWager))
            : strings.finalYourResultNoWager(f.myResult === 'correct')}
      </p>
      {f.answer && (
        <p className="final-phone-fasit">
          {strings.finalFasit}: {f.answer}
        </p>
      )}
    </PlayerShell>
  );
}

function FinalAnswerForm({ state, socket, myIndex }) {
  const f = state.final;
  const remaining = useCountdown(f.deadline, state.serverTime);
  const [text, setText] = useState(f.myAnswer);
  const [sentText, setSentText] = useState(f.mySubmitted ? f.myAnswer : null);
  const timeUp = remaining === 0;

  // Save drafts as the player types, so a dropped phone keeps its answer.
  useEffect(() => {
    if (text === f.myAnswer) return;
    const id = setTimeout(() => socket.emit('player:finalAnswer', { text, submit: false }), 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  function send(e) {
    e.preventDefault();
    if (timeUp) return;
    socket.emit('player:finalAnswer', { text, submit: true });
    setSentText(text);
  }

  const sent = sentText !== null;
  const changed = sent && sentText !== text;

  return (
    <PlayerShell state={state} myIndex={myIndex}>
      <div className="final-phone-cat">{f.category}</div>
      <p className="final-phone-question">{f.question}</p>
      {remaining !== null && (
        <div className={`countdown ${remaining <= 5 ? 'countdown-urgent' : ''}`}>
          <span className="countdown-num">{remaining}</span>
        </div>
      )}
      <form className="join-form final-form" onSubmit={send}>
        <input
          className="input final-input"
          placeholder={strings.finalAnswerPlaceholder}
          aria-label={strings.finalAnswerPlaceholder}
          value={text}
          maxLength={60}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          disabled={timeUp}
          onChange={(e) => setText(e.target.value)}
          autoFocus
        />
        <button className="btn btn-gold btn-lg" type="submit" disabled={timeUp || (sent && !changed)}>
          {changed ? strings.finalSendAgain : strings.finalSend}
        </button>
        <p className="wager-hint" aria-live="polite">
          {timeUp ? strings.finalTimeUp : sent && !changed ? strings.finalSentHint : ''}
        </p>
      </form>
    </PlayerShell>
  );
}

function MyScore({ me }) {
  const { display, delta } = useScoreChange(me ? me.score : 0);
  return (
    <div className="my-score">
      {me ? me.name : ''} · {formatPoints(display)}
      {delta && (
        <span key={delta.id} className={`score-delta inline ${delta.value > 0 ? 'gain' : 'loss'}`}>
          {formatDelta(delta.value)}
        </span>
      )}
    </div>
  );
}
