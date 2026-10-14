import { strings, formatPoints } from '../lib/strings';
import { useScoreChange, formatDelta } from '../lib/useScoreChange';

// Header scoreboard on the TV: one chip per player, counting up or down with
// a "+500" / "−300" tag when the score changes.
export default function Scoreboard({ players, ringedPlayerId }) {
  return (
    <div className="scoreboard">
      {players.map((p, i) => (
        <ScoreChip key={p.id} player={p} index={i} ringed={p.id === ringedPlayerId} />
      ))}
    </div>
  );
}

function ScoreChip({ player, index, ringed }) {
  const { display, delta } = useScoreChange(player.score);
  const tone = delta ? (delta.value > 0 ? 'gain' : 'loss') : '';
  return (
    <div
      className={`score-chip pc-${index % 10} ${player.connected ? '' : 'offline'} ${ringed ? 'buzzed-ring' : ''}`}
    >
      {delta && <span key={`f${delta.id}`} className={`chip-flash ${tone}`} aria-hidden="true" />}
      <span className="score-name">{player.name}</span>
      <span className="score-val">{formatPoints(display)}</span>
      {!player.connected && <span className="score-offline">{strings.offline}</span>}
      {delta && (
        <span key={delta.id} className={`score-delta ${tone}`}>
          {formatDelta(delta.value)}
        </span>
      )}
    </div>
  );
}
