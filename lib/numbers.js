// Norwegian number formatting and lenient parsing for guesses:
// "8 849", "24,5", "-273,15" and "8849" all work.
const formatter = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 2 });

export function formatNumber(n) {
  return formatter.format(n);
}

export function parseNumber(text) {
  const cleaned = String(text)
    .trim()
    .replace(/[\s  ]/g, '')
    .replace(/[−–]/g, '-')
    .replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}
