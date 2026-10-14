// A small, self-drawn Jeopardy scene for the game menu. It rests as a still
// board and plays when the card is hovered or focused (and on touch screens):
// a cell is picked and turns over to Daily Double, a phone buzzes, and the
// points rise. Pure CSS, so it works offline on the local network.
const VALUES = [200, 400, 600, 800];
const COLUMNS = 6;
const PICKED = { col: 3, row: 2 };

export default function JeopardyPreview() {
  return (
    <div className="jp-scene" aria-hidden="true">
      <div className="jp-board">
        {Array.from({ length: COLUMNS }).map((_, col) => (
          <div className="jp-col" key={col}>
            <span className="jp-head" />
            {VALUES.map((v, row) =>
              col === PICKED.col && row === PICKED.row ? (
                <span className="jp-cell jp-picked" key={v}>
                  <span className="jp-face jp-front">{v}</span>
                  <span className="jp-face jp-back">
                    Daily
                    <br />
                    Double
                  </span>
                </span>
              ) : (
                <span className="jp-cell" key={v} style={{ '--i': col + row }}>
                  {v}
                </span>
              )
            )}
          </div>
        ))}
      </div>
      <div className="jp-phone">
        <span className="jp-buzz">BUZZ</span>
      </div>
      <span className="jp-points">+1000</span>
    </div>
  );
}
