import { useEffect, useMemo, useState } from 'react';

// Seconds left until `deadline` (server epoch ms), or null when there is none.
// `serverTime` is the server's clock at the moment the state was sent; it lets
// phones with a slightly wrong clock still show the same countdown as the host.
export function useCountdown(deadline, serverTime) {
  const [now, setNow] = useState(Date.now());
  const skew = useMemo(() => (serverTime ? serverTime - Date.now() : 0), [serverTime]);

  useEffect(() => {
    if (!deadline) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [deadline]);

  if (!deadline) return null;
  return Math.max(0, Math.ceil((deadline - (now + skew)) / 1000));
}
