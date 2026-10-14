import { useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import io from 'socket.io-client';
import { strings } from '../../lib/strings';
import { useCountdown } from '../../lib/useCountdown';
import { formatNumber } from '../../lib/numbers';
import HostHeader from '../../components/HostHeader';
import Lobby from '../../components/Lobby';
import Countdown from '../../components/Countdown';
import FinalScores from '../../components/FinalScores';
import NumberLine from '../../components/NumberLine';

const GUESS_SECONDS = 30;

export default function NaermestHost() {
  const [state, setState] = useState(null);
  const [denied, setDenied] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    const socket = io('/naermest');
    socketRef.current = socket;
    socket.on('connect', () => socket.emit('host:hello', (s) => s && setState(s)));
    socket.on('host:denied', () => setDenied(true));
    socket.on('state:host', (s) => setState(s));
    return () => socket.disconnect();
  }, []);

  const head = (
    <Head>
      <title>{strings.nvTitleHost}</title>
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
  const newGame = () => socket.emit('host:new', (s) => setState(s));

  if (state.error) {
    return (
      <main className="center-page">
        {head}
        <h1 className="page-heading">{strings.bankErrorTitle}</h1>
        <p className="hint">{state.error}</p>
        <button className="btn btn-gold" onClick={newGame}>
          {strings.tryAgain}
        </button>
      </main>
    );
  }

  return (
    <div className="host-page">
      {head}
      <HostHeader code={state.code} players={state.players} onNewGame={newGame} />
      {state.status === 'lobby' && (
        <Lobby state={state} onStart={() => socket.emit('host:start')} />
      )}
      {state.status === 'playing' && <Round state={state} socket={socket} />}
      {state.status === 'finished' && <FinalScores players={state.players} />}
    </div>
  );
}

function Round({ state, socket }) {
  const remaining = useCountdown(state.deadline, state.serverTime);
  const players = state.players;
  const guessList = state.guesses
    ? Object.entries(state.guesses).map(([playerId, value]) => ({ playerId, value }))
    : [];
  // Players who dropped out are not waited for.
  const active = players.filter((p) => p.connected);
  const allAnswered = active.length > 0 && active.every((p) => state.submittedIds.includes(p.id));
  const winners = state.results ? state.results.filter((r) => r.place === 0).map((r) => r.playerId) : [];
  const isLast = state.round === state.rounds - 1;

  return (
    <main className="final-stage">
      <h1 className="visually-hidden">{strings.nvName}</h1>
      <section
        className={`question-panel nv-panel ${state.stage === 'question' ? '' : 'nv-reveal'}`}
        key={`${state.round}-${state.stage}`}
      >
        <div className="panel-stage">
          <div className="q-cat">{strings.nvRound(state.round + 1, state.rounds)}</div>
          <h2 className="q-text">{state.question}</h2>

          {state.stage === 'question' && (
            <>
              <p className="nv-unit">{strings.nvUnitHint(state.unit)}</p>
              <Countdown remaining={remaining} total={GUESS_SECONDS} />
              <ul className="final-roster">
                {players.map((p, i) => {
                  const done = state.submittedIds.includes(p.id);
                  return (
                    <li
                      key={p.id}
                      className={`roster-chip pc-${i % 10} ${done ? 'is-done' : ''} ${p.connected ? '' : 'offline'}`}
                    >
                      <span className="roster-name">{p.name}</span>
                      <span className="roster-status">
                        {done ? strings.nvAnswered : p.connected ? strings.nvThinking : strings.offline}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {state.stage !== 'question' && (
            <NumberLine
              guesses={guessList}
              players={players}
              answer={state.answer}
              winnerIds={winners}
              unit={state.unit}
            />
          )}

          {state.stage === 'guesses' && (
            <>
              <p className="nv-unit">{strings.nvWhoClosest}</p>
              <ul className="nv-guess-list">
                {[...guessList]
                  .sort((a, b) => a.value - b.value)
                  .map((g) => {
                    const i = players.findIndex((p) => p.id === g.playerId);
                    return (
                      <li key={g.playerId} className={`nv-guess pc-${i % 10}`}>
                        <span className="nv-guess-name">{players[i] && players[i].name}</span>
                        <span className="nv-guess-value">{formatNumber(g.value)}</span>
                      </li>
                    );
                  })}
              </ul>
              {guessList.length === 0 && <p className="nv-unit">{strings.nvNoGuesses}</p>}
            </>
          )}

          {state.stage === 'answer' && <Results state={state} />}
        </div>

        <div className="panel-controls">
          <div className="panel-secondary">
            {state.stage !== 'question' && (
              <span className="nv-round-note">{strings.nvRound(state.round + 1, state.rounds)}</span>
            )}
          </div>
          <div className="panel-primary">
            {state.stage === 'question' &&
              (allAnswered ? (
                <button className="btn btn-gold" onClick={() => socket.emit('host:stopTime')} autoFocus>
                  {strings.nvAllAnswered}
                </button>
              ) : (
                <button className="btn btn-small" onClick={() => socket.emit('host:stopTime')}>
                  {strings.nvStopTime}
                </button>
              ))}
            {state.stage === 'guesses' && (
              <button className="btn btn-gold" onClick={() => socket.emit('host:reveal')} autoFocus>
                {strings.nvShowAnswer}
              </button>
            )}
            {state.stage === 'answer' && (
              <button className="btn btn-gold" onClick={() => socket.emit('host:next')} autoFocus>
                {isLast ? strings.nvToResults : strings.nvNext}
              </button>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function Results({ state }) {
  const players = state.players;
  if (!state.results.length) return <p className="nv-unit">{strings.nvNoGuesses}</p>;
  // Long lists fill two columns, top to bottom, so ten players still fit.
  const rows = state.results.length > 5 ? Math.ceil(state.results.length / 2) : state.results.length;
  return (
    <ol
      className={`nv-results ${state.results.length > 5 ? 'nv-results-two' : ''}`}
      style={{ gridTemplateRows: `repeat(${rows}, auto)` }}
    >
      {state.results.map((r, n) => {
        const i = players.findIndex((p) => p.id === r.playerId);
        return (
          <li
            key={r.playerId}
            className={`nv-result pc-${i % 10} ${r.place === 0 ? 'is-first' : ''}`}
            style={{ '--d': `${700 + n * 120}ms` }}
          >
            <span className="nv-result-place">{strings.nvPlace(r.place + 1)}</span>
            <span className="nv-result-name">{players[i] && players[i].name}</span>
            <span className="nv-result-guess">
              {formatNumber(r.value)}
              <span className="nv-result-diff">
                {r.exact ? strings.nvExact : strings.nvOffBy(formatNumber(r.distance))}
              </span>
            </span>
            <span className="nv-result-points">{r.points > 0 ? strings.nvPoints(r.points) : ''}</span>
          </li>
        );
      })}
    </ol>
  );
}
