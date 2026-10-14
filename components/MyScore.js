import { formatPoints } from '../lib/strings';
import { useScoreChange, formatDelta } from '../lib/useScoreChange';

// The player's own name and score at the top of the phone.
export default function MyScore({ me }) {
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
