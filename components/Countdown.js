export default function Countdown({ remaining, total }) {
  if (remaining === null) return null;
  return (
    <div className={`countdown ${remaining <= 5 ? 'countdown-urgent' : ''}`}>
      <span className="countdown-num">{remaining}</span>
      <span className="countdown-track">
        <span className="countdown-fill" style={{ transform: `scaleX(${remaining / total})` }} />
      </span>
    </div>
  );
}
