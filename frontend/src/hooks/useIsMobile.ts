import { useEffect, useState } from 'react';

export function useIsMobile(maxWidthPx = 767) {
  const query = `(max-width: ${maxWidthPx}px)`;
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [query]);
  return isMobile;
}
