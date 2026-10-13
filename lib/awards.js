// Awards for the end of the evening. Each one is only given when the game
// produced a real number for it, so nothing is ever made up.
const { strings, formatPoints } = require('./strings');

function seconds(ms) {
  return `${(ms / 1000).toFixed(1).replace('.', ',')} s`;
}

function best(players, value, better) {
  let winner = null;
  players.forEach((p) => {
    const v = value(p);
    if (v === null || v === undefined) return;
    if (!winner || better(v, value(winner))) winner = p;
  });
  return winner;
}

function computeAwards(players) {
  const withStats = players.filter((p) => p.stats);
  const awards = [];

  const fastest = best(withStats, (p) => p.stats.fastestMs, (a, b) => a < b);
  if (fastest) {
    awards.push({
      id: 'fastest',
      title: strings.awardFastest,
      playerId: fastest.id,
      value: seconds(fastest.stats.fastestMs),
    });
  }

  const mostCorrect = best(
    withStats,
    (p) => (p.stats.correct > 0 ? p.stats.correct : null),
    (a, b) => a > b
  );
  if (mostCorrect) {
    awards.push({
      id: 'correct',
      title: strings.awardMostCorrect,
      playerId: mostCorrect.id,
      value: strings.awardCorrectCount(mostCorrect.stats.correct),
    });
  }

  const boldest = best(
    withStats,
    (p) => (p.stats.bestDailyDouble > 0 ? p.stats.bestDailyDouble : null),
    (a, b) => a > b
  );
  if (boldest) {
    awards.push({
      id: 'boldest',
      title: strings.awardBoldest,
      playerId: boldest.id,
      value: formatPoints(boldest.stats.bestDailyDouble),
    });
  }

  return awards;
}

module.exports = { computeAwards, seconds };
