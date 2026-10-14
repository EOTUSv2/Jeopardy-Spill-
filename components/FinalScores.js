import { strings, formatPoints } from '../lib/strings';

// Last place is revealed first and the winner last, about 2.4 s in total.
function revealDelay(count, rank) {
  const step = Math.min(520, 2400 / Math.max(1, count - 1));
  return 500 + (count - 1 - rank) * step;
}

export default function FinalScores({ players, awards = [] }) {
  const sorted = players
    .map((p, i) => ({ p, i }))
    .sort((a, b) => b.p.score - a.p.score);
  // The awards arrive after the winner's band has filled in.
  const awardsAt = revealDelay(sorted.length, 0) + 1100;
  return (
    <main className="center-page">
      <h1>{strings.finalResults}</h1>
      <ol className="final-list">
        {sorted.map(({ p, i }, rank) => (
          <li
            key={p.id}
            className={`pc-${i % 10}`}
            style={{ '--d': `${revealDelay(sorted.length, rank)}ms` }}
          >
            <span className="final-name">{p.name}</span>
            <span className="final-score">{formatPoints(p.score)}</span>
          </li>
        ))}
      </ol>
      {awards.length > 0 && (
        <section className="awards" aria-label={strings.awardsTitle}>
          <h2 className="awards-title" style={{ '--d': `${awardsAt}ms` }}>
            {strings.awardsTitle}
          </h2>
          <ul className="award-list">
            {awards.map((a, n) => {
              const i = players.findIndex((p) => p.id === a.playerId);
              return (
                <li
                  key={a.id}
                  className={`award pc-${i % 10}`}
                  style={{ '--d': `${awardsAt + 250 + n * 220}ms` }}
                >
                  <span className="award-title">{a.title}</span>
                  <span className="award-name">{players[i].name}</span>
                  <span className="award-value">{a.value}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}
