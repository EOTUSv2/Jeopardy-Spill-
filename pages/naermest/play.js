import { useEffect, useState } from 'react';
import Head from 'next/head';
import { strings, formatPoints } from '../../lib/strings';
import { useCountdown } from '../../lib/useCountdown';
import { formatNumber, parseNumber } from '../../lib/numbers';
import { useBrowserTint, usePlayerSession, vibrate } from '../../lib/playerDevice';
import MyScore from '../../components/MyScore';
import JoinScreen from '../../components/JoinScreen';

export default function NaermestPlay() {
  const session = usePlayerSession('/naermest', 'naermest');

  if (!session.joined) return <JoinScreen title={strings.nvTitlePlay} session={session} />;
  if (!session.state) {
    return (
      <div className="center-page">
        <Head>
          <title>{strings.nvTitlePlay}</title>
        </Head>
        {strings.connecting}
      </div>
    );
  }
  return <PlayerView state={session.state} socket={session.socket} />;
}

function PlayerView({ state, socket }) {
  const myIndex = state.players.findIndex((p) => state.me && p.id === state.me.id);
  const tint = myIndex >= 0 ? `player-tinted pc-${myIndex % 10}` : '';
  useBrowserTint(myIndex);

  const myResult =
    state.results && state.me ? state.results.find((r) => r.playerId === state.me.id) : null;
  const gotPoints = !!(myResult && myResult.points > 0);
  useEffect(() => {
    if (gotPoints) vibrate([60, 40, 160]);
  }, [gotPoints]);

  if (state.status === 'lobby') {
    return (
      <main className={`center-page ${tint}`}>
        <Head>
          <title>{strings.nvTitlePlay}</title>
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

  if (state.status === 'finished') {
    const sorted = [...state.players].sort((a, b) => b.score - a.score);
    const rank = sorted.findIndex((p) => state.me && p.id === state.me.id) + 1;
    return (
      <main className={`center-page ${tint}`}>
        <Head>
          <title>{strings.nvTitlePlay}</title>
        </Head>
        <h1>{strings.finished}</h1>
        <p className="hint">
          {strings.finishedResult(rank, formatPoints(state.me ? state.me.score : 0))}
        </p>
      </main>
    );
  }

  return (
    <main className={`player-game ${tint}`}>
      <Head>
        <title>{strings.nvTitlePlay}</title>
      </Head>
      <MyScore me={state.me} />
      <div className="final-phone-cat">{strings.nvRound(state.round + 1, state.rounds)}</div>
      <p className="final-phone-question">{state.question}</p>

      {state.stage === 'question' && (
        <GuessForm key={state.round} state={state} socket={socket} />
      )}

      {state.stage === 'guesses' && (
        <>
          <p className="final-phone-locked">
            {state.myGuess === null
              ? strings.nvNoGuess
              : strings.nvYourGuess(`${formatNumber(state.myGuess)} ${state.unit}`)}
          </p>
          <p className="status-text">{strings.nvWaitingAnswer}</p>
        </>
      )}

      {state.stage === 'answer' && (
        <>
          <p className="final-phone-fasit">
            {strings.nvAnswer}: {formatNumber(state.answer)} {state.unit}
          </p>
          <p className="status-text" aria-live="polite">
            {!myResult
              ? strings.nvNoGuess
              : myResult.exact
                ? strings.nvYourExact(myResult.points)
                : strings.nvYourResult(
                    myResult.place + 1,
                    strings.nvOffBy(formatNumber(myResult.distance)),
                    myResult.points
                  )}
          </p>
          <p className="wager-hint">{strings.nvWaitingNext}</p>
        </>
      )}
    </main>
  );
}

function GuessForm({ state, socket }) {
  const remaining = useCountdown(state.deadline, state.serverTime);
  const [text, setText] = useState(state.myGuess === null ? '' : formatNumber(state.myGuess));
  const [sentValue, setSentValue] = useState(state.mySubmitted ? state.myGuess : null);
  const [invalid, setInvalid] = useState(false);
  const timeUp = remaining === 0;
  const value = parseNumber(text);

  // Drafts are saved while typing, so a guess still counts if the phone
  // drops or the player never presses send.
  useEffect(() => {
    if (value === null) return;
    const id = setTimeout(() => socket.emit('player:guess', { value, submit: false }), 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function send(e) {
    e.preventDefault();
    if (timeUp) return;
    if (value === null) {
      setInvalid(true);
      return;
    }
    socket.emit('player:guess', { value, submit: true });
    setSentValue(value);
  }

  const sent = sentValue !== null;
  const changed = sent && value !== sentValue;
  let hint = '';
  if (timeUp) hint = strings.nvTimeUp;
  else if (invalid && value === null) hint = strings.nvNotANumber;
  else if (sent && !changed) hint = strings.nvSentHint;

  return (
    <>
      {remaining !== null && (
        <div className={`countdown ${remaining <= 5 ? 'countdown-urgent' : ''}`}>
          <span className="countdown-num">{remaining}</span>
        </div>
      )}
      <form className="join-form final-form" onSubmit={send}>
        <label className="nv-input-wrap">
          <input
            className="input nv-input"
            placeholder={strings.nvGuessPlaceholder}
            aria-label={`${strings.nvGuessPlaceholder} (${state.unit})`}
            aria-invalid={invalid && value === null}
            value={text}
            inputMode="decimal"
            autoComplete="off"
            disabled={timeUp}
            onChange={(e) => {
              setText(e.target.value);
              setInvalid(false);
            }}
            autoFocus
          />
          <span className="nv-input-unit">{state.unit}</span>
        </label>
        <button className="btn btn-gold btn-lg" type="submit" disabled={timeUp || (sent && !changed)}>
          {changed ? strings.nvSendAgain : strings.nvSend}
        </button>
        <p className="wager-hint" aria-live="polite">
          {hint}
        </p>
      </form>
    </>
  );
}
