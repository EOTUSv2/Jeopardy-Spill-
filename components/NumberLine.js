import { formatNumber } from '../lib/numbers';
import { strings } from '../lib/strings';

const LANES = 3;
const MIN_GAP = 4.5; // percent of the line between two pins in the same lane

// The reveal on the TV: every guess is a pin in its player's colour on one
// shared line. When `answer` is set, the gold marker drops in and the
// closest pins are marked. Pins that would overlap move up a lane.
export default function NumberLine({ guesses, players, answer, winnerIds = [], unit }) {
  const values = guesses.map((g) => g.value);
  if (answer !== null && answer !== undefined) values.push(answer);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (!values.length) {
    min = 0;
    max = 1;
  }
  if (min === max) {
    min -= Math.abs(min) * 0.1 || 1;
    max += Math.abs(max) * 0.1 || 1;
  }
  const allPositive = min >= 0;
  const pad = (max - min) * 0.06;
  min -= pad;
  max += pad;
  // Don't invent negative numbers at the left end when nobody went below 0.
  if (allPositive && min < 0) min = 0;
  const pos = (v) => ((v - min) / (max - min)) * 100;

  const laneEnds = Array(LANES).fill(-Infinity);
  const pins = [...guesses]
    .sort((a, b) => a.value - b.value)
    .map((g, order) => {
      const p = pos(g.value);
      let lane = laneEnds.findIndex((end) => p - end >= MIN_GAP);
      if (lane === -1) lane = LANES - 1;
      laneEnds[lane] = p;
      const index = players.findIndex((pl) => pl.id === g.playerId);
      return { ...g, p, lane, order, index, player: players[index] };
    });

  // Only reserve height for the lanes actually used.
  const usedLanes = pins.reduce((m, pin) => Math.max(m, pin.lane + 1), 1);
  // Whole numbers at the ends unless the range itself is small.
  const endValue = (v) => (max - min > 20 ? Math.round(v) : Math.round(v * 100) / 100);

  return (
    <div className="nl" style={{ '--lanes': usedLanes }}>
      <div className="nl-field">
        {pins.map((pin) => (
          <span
            key={pin.playerId}
            className={`nl-pin pc-${pin.index % 10} ${winnerIds.includes(pin.playerId) ? 'is-winner' : ''}`}
            style={{ left: `${pin.p}%`, '--lane': pin.lane, '--d': `${pin.order * 90}ms` }}
            title={`${pin.player ? pin.player.name : ''}: ${formatNumber(pin.value)}`}
          >
            {pin.player ? pin.player.name.charAt(0).toUpperCase() : '?'}
          </span>
        ))}
        {answer !== null && answer !== undefined && (
          <span className="nl-answer" style={{ left: `${pos(answer)}%` }}>
            <span className="nl-answer-label">
              {strings.nvAnswer}: {formatNumber(answer)} {unit}
            </span>
          </span>
        )}
      </div>
      <div className="nl-track" aria-hidden="true" />
      <div className="nl-ends" aria-hidden="true">
        <span>{formatNumber(endValue(min))}</span>
        <span>{formatNumber(endValue(max))}</span>
      </div>
    </div>
  );
}
