import { useEffect, useRef } from 'react';

export function useActiveThrottle(cb: () => void, activeMs: number, idleMs: number): void {
  const cbRef = useRef(cb);
  cbRef.current = cb;

  useEffect(() => {
    let timer = 0;
    let idle = false;

    const run = () => {
      if (document.hidden) return;
      cbRef.current();
    };

    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(run, idle ? idleMs : activeMs);
    };

    const onVisibility = () => {
      if (document.hidden) {
        window.clearTimeout(timer);
        return;
      }
      idle = false;
      run();
      schedule();
    };

    const onFocus = () => {
      idle = false;
      schedule();
    };

    const onBlur = () => {
      idle = true;
      schedule();
    };

    window.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);
    schedule();

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
    };
  }, [activeMs, idleMs]);
}
