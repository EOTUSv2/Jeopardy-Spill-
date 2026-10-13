const fs = require('fs');
const path = require('path');

const QUESTIONS_PER_CATEGORY = 5;
const CATEGORIES_PER_BOARD = 6;
const MIN_CATEGORIES = CATEGORIES_PER_BOARD * 2;
const BASE_VALUES = [100, 200, 300, 400, 500];
// Daily Doubles never sit in the two top rows, so someone has usually
// answered correctly (and so "owns" the board) before one turns up.
const DAILY_DOUBLE_ROWS = [2, 3, 4];

function loadQuestionBank() {
  const filename = 'questions.json';
  const filePath = path.join(process.cwd(), filename);
  const raw = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(raw);
  const categories = data.categories || [];

  const valid = categories.filter(
    (c) =>
      c &&
      typeof c.name === 'string' &&
      c.name.trim() &&
      Array.isArray(c.questions) &&
      c.questions.length === QUESTIONS_PER_CATEGORY &&
      c.questions.every(
        (tier) => Array.isArray(tier) && tier.length > 0 && tier.every((q) => q && q.q && q.a)
      )
  );

  if (valid.length < MIN_CATEGORIES) {
    throw new Error(
      `${filename} trenger minst ${MIN_CATEGORIES} gyldige kategorier med noyaktig ${QUESTIONS_PER_CATEGORY} sporsmal hver (q + a). Fant kun ${valid.length} gyldige av ${categories.length} totalt.`
    );
  }
  return valid;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildBoard(categories, multiplier) {
  return {
    multiplier,
    categories: categories.map((c) => ({
      name: c.name,
      hint: c.hint || '',
      cells: c.questions.map((tier, i) => {
        const q = pickRandom(tier);
        return {
          value: BASE_VALUES[i] * multiplier,
          used: false,
          question: q.q,
          answer: q.a,
          dailyDouble: false,
        };
      }),
    })),
  };
}

function placeDailyDoubles(board, count) {
  const columns = shuffle(board.categories.map((_, i) => i)).slice(0, count);
  columns.forEach((ci) => {
    board.categories[ci].cells[pickRandom(DAILY_DOUBLE_ROWS)].dailyDouble = true;
  });
}

// The final question is a top-tier question from a category that is not on
// either board. With exactly 12 categories in the bank there is none left, so
// fall back to an unused alternative from a board category.
function pickFinal(bank, chosen) {
  const unused = bank.filter((c) => !chosen.includes(c));
  if (unused.length > 0) {
    const cat = pickRandom(unused);
    const q = pickRandom(cat.questions[QUESTIONS_PER_CATEGORY - 1]);
    return { category: cat.name, question: q.q, answer: q.a };
  }
  const cat = pickRandom(chosen);
  const q = pickRandom(cat.questions[QUESTIONS_PER_CATEGORY - 1]);
  return { category: cat.name, question: q.q, answer: q.a };
}

function buildGameBoards() {
  const bank = loadQuestionBank();
  const chosen = shuffle(bank).slice(0, MIN_CATEGORIES);
  const board1Cats = chosen.slice(0, CATEGORIES_PER_BOARD);
  const board2Cats = chosen.slice(CATEGORIES_PER_BOARD, CATEGORIES_PER_BOARD * 2);
  const boards = [buildBoard(board1Cats, 1), buildBoard(board2Cats, 2)];
  placeDailyDoubles(boards[0], 1);
  placeDailyDoubles(boards[1], 2);
  return { boards, final: pickFinal(bank, chosen) };
}

module.exports = { buildGameBoards };
