import { useState } from 'react';
import Link from 'next/link';
import { strings } from '../lib/strings';
import Scoreboard from './Scoreboard';

// The TV's top bar in every game: join code, the Spillkveld logo back to the
// menu, game-specific actions, "new game" with a confirm step, and the
// scoreboard underneath.
export default function HostHeader({ code, players, ringedPlayerId, onNewGame, children }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <header className="host-header">
      <div className="code-box">
        {strings.code} <span>{code}</span>
      </div>
      <Link href="/" className="home-link" aria-label={strings.homeAria}>
        {strings.siteName}
      </Link>
      <Scoreboard players={players} ringedPlayerId={ringedPlayerId} />
      <div className="header-actions">
        {children}
        {confirming ? (
          <div className="confirm-row" role="group" aria-label={strings.confirmNewGame}>
            <span>{strings.confirmNewGame}</span>
            <button
              className="btn btn-wrong btn-compact"
              onClick={() => {
                setConfirming(false);
                onNewGame();
              }}
            >
              {strings.confirmYes}
            </button>
            <button className="btn btn-small" onClick={() => setConfirming(false)} autoFocus>
              {strings.confirmCancel}
            </button>
          </div>
        ) : (
          <button className="btn btn-small" onClick={() => setConfirming(true)}>
            {strings.newGame}
          </button>
        )}
      </div>
    </header>
  );
}
