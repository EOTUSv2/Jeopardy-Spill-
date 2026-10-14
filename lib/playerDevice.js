import { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';

export function vibrate(pattern) {
  if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(pattern);
}

// The browser bar takes the player's colour too, so the whole phone is theirs.
export function useBrowserTint(myIndex) {
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    const original = meta.getAttribute('content');
    if (myIndex >= 0) {
      const colour = getComputedStyle(document.documentElement)
        .getPropertyValue(`--p-${myIndex % 10}`)
        .trim();
      if (colour) meta.setAttribute('content', colour);
    }
    return () => meta.setAttribute('content', original);
  }, [myIndex]);
}

// A stable id per phone and game, so a player who reloads or loses the
// connection comes back as the same player.
export function getClientId(prefix) {
  if (typeof window === 'undefined') return null;
  const key = `${prefix}_playerId`;
  let id = localStorage.getItem(key);
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(key, id);
  }
  return id;
}

// Keep the phone screen awake while playing, so the player is not dropped
// from the game when the display locks. Silently skipped where unsupported.
export function useWakeLock(active) {
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !navigator.wakeLock) return;
    let lock = null;
    let cancelled = false;
    const acquire = async () => {
      try {
        lock = await navigator.wakeLock.request('screen');
        if (cancelled && lock) lock.release();
      } catch (e) {
        // denied (e.g. low battery); not essential
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') acquire();
    };
    acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      if (lock) lock.release().catch(() => {});
    };
  }, [active]);
}

// Connection and join flow shared by every game's phone page. `namespace`
// is the game's Socket.IO namespace ('' for Jeopardy), `prefix` keeps each
// game's saved code and name apart.
export function usePlayerSession(namespace, prefix) {
  const [state, setState] = useState(null);
  const [joined, setJoined] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const socketRef = useRef(null);
  const clientIdRef = useRef(null);

  useWakeLock(joined);

  useEffect(() => {
    clientIdRef.current = getClientId(prefix);
    const savedCode = sessionStorage.getItem(`${prefix}_code`);
    const savedName = sessionStorage.getItem(`${prefix}_name`);
    if (savedCode) setCode(savedCode);
    if (savedName) setName(savedName);

    const socket = io(namespace || undefined);
    socketRef.current = socket;
    socket.on('state:player', (s) => setState(s));

    if (savedCode && savedName) {
      socket.on('connect', () => tryJoin(savedCode, savedName, true));
    }

    return () => socket.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function tryJoin(codeVal, nameVal, silent) {
    socketRef.current.emit(
      'player:join',
      { code: codeVal.trim().toUpperCase(), name: nameVal, clientId: clientIdRef.current },
      (res) => {
        if (res && res.error) {
          if (!silent) setError(res.error);
        } else {
          setJoined(true);
          setError('');
          sessionStorage.setItem(`${prefix}_code`, codeVal.trim().toUpperCase());
          sessionStorage.setItem(`${prefix}_name`, nameVal);
        }
      }
    );
  }

  function submit(e) {
    e.preventDefault();
    if (!code.trim() || !name.trim()) return;
    tryJoin(code, name, false);
  }

  return { state, socket: socketRef.current, joined, code, setCode, name, setName, error, submit };
}
