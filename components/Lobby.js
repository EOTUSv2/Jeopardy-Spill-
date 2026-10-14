import { strings } from '../lib/strings';

// Shared lobby for every game: the join code dealt as board tiles, the seats,
// and the start button.
export default function Lobby({ state, onStart }) {
  return (
    <main className="center-page">
      <div className="lobby-join">
        <h1 className="page-heading">{strings.waitingForPlayers}</h1>
        <div className="join-code" role="img" aria-label={`${strings.code} ${state.code}`}>
          {state.code.split('').map((ch, i) => (
            <span key={i} className="join-code-tile" aria-hidden="true">
              {ch}
            </span>
          ))}
        </div>
        <p className="hint">{strings.joinInstructions(state.code)}</p>
      </div>
      <div className="player-slots">
        {Array.from({ length: state.maxPlayers }).map((_, i) => {
          const p = state.players[i];
          return (
            <div key={i} className={`player-slot pc-${i % 10} ${p ? 'filled' : ''}`}>
              {p ? p.name : strings.waitingForPlayerN(i + 1)}
            </div>
          );
        })}
      </div>
      <button
        className="btn btn-gold btn-lg"
        disabled={state.players.length === 0}
        onClick={onStart}
      >
        {strings.startGame(state.players.length, state.maxPlayers)}
      </button>
    </main>
  );
}
