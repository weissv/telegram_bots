import { useEffect, useMemo, useState } from 'react';

declare global {
  interface Window {
    Telegram?: {
      WebApp: any;
    };
  }
}

export function useTelegram() {
  const [isReady, setIsReady] = useState(false);

  const tg = useMemo(() => {
    return typeof window !== 'undefined' ? window.Telegram?.WebApp : null;
  }, []);

  useEffect(() => {
    if (tg) {
      tg.ready();
      tg.expand?.();
      setIsReady(true);
    }
  }, [tg]);

  const user = useMemo(() => {
    return tg?.initDataUnsafe?.user || null;
  }, [tg]);

  const initData = useMemo(() => {
    return tg?.initData || '';
  }, [tg]);

  const haptic = useMemo(
    () => ({
      impact: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' = 'medium') => {
        tg?.HapticFeedback?.impactOccurred(style);
      },
      notification: (type: 'error' | 'success' | 'warning' = 'success') => {
        tg?.HapticFeedback?.notificationOccurred(type);
      },
      selection: () => {
        tg?.HapticFeedback?.selectionChanged();
      },
    }),
    [tg]
  );

  const close = () => tg?.close();

  return {
    tg,
    user,
    initData,
    isReady,
    haptic,
    close,
  };
}
