// Menu preview for "Nærmest vinner": guesses land as coloured pins on a
// number line, the gold answer drops in, and the closest pin scores.
// Still until the card is hovered or focused (plays on touch screens).
const PINS = [
  { left: 18, lane: 0, colour: 1, letter: 'K' },
  { left: 41, lane: 0, colour: 2, letter: 'S' },
  { left: 57, lane: 1, colour: 0, letter: 'O', winner: true },
  { left: 78, lane: 0, colour: 4, letter: 'M' },
];

export default function NaermestPreview() {
  return (
    <div className="nv-scene" aria-hidden="true">
      <span className="nv-scene-question" />
      <span className="nv-scene-question nv-scene-question-short" />
      <div className="nv-scene-line">
        {PINS.map((pin, i) => (
          <span
            key={pin.letter}
            className={`nv-scene-pin pc-${pin.colour} ${pin.winner ? 'is-winner' : ''}`}
            style={{ left: `${pin.left}%`, '--lane': pin.lane, '--i': i }}
          >
            {pin.letter}
          </span>
        ))}
        <span className="nv-scene-answer" style={{ left: '61%' }} />
        <span className="nv-scene-points" style={{ left: '57%' }}>
          +3
        </span>
        <span className="nv-scene-track" />
      </div>
    </div>
  );
}
