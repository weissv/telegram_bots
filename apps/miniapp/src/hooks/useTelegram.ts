import { useEffect, useMemo, useState, useCallback } from 'react';

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
      try {
        tg.ready?.();
        tg.expand?.();
        tg.enableClosingConfirmation?.();
        if (tg.setHeaderColor) tg.setHeaderColor('secondary_bg_color');
        if (tg.setBackgroundColor) tg.setBackgroundColor('bg_color');
      } catch (e) {
        console.warn('Telegram WebApp init notice:', e);
      }
      setIsReady(true);
    }
  }, [tg]);

  const user = useMemo(() => {
    return tg?.initDataUnsafe?.user || null;
  }, [tg]);

  const initData = useMemo(() => {
    return tg?.initData || '';
  }, [tg]);

  const colorScheme = useMemo(() => {
    return tg?.colorScheme || 'dark';
  }, [tg]);

  const themeParams = useMemo(() => {
    return tg?.themeParams || {};
  }, [tg]);

  const isInsideTelegram = useMemo(() => {
    return Boolean(tg && (tg.initData || tg.initDataUnsafe?.user));
  }, [tg]);

  const haptic = useMemo(
    () => ({
      impact: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' = 'medium') => {
        try {
          tg?.HapticFeedback?.impactOccurred(style);
        } catch {}
      },
      notification: (type: 'error' | 'success' | 'warning' = 'success') => {
        try {
          tg?.HapticFeedback?.notificationOccurred(type);
        } catch {}
      },
      selection: () => {
        try {
          tg?.HapticFeedback?.selectionChanged();
        } catch {}
      },
    }),
    [tg]
  );

  const setHeaderColor = useCallback((color: string) => {
    try {
      tg?.setHeaderColor?.(color);
    } catch {}
  }, [tg]);

  const setBackgroundColor = useCallback((color: string) => {
    try {
      tg?.setBackgroundColor?.(color);
    } catch {}
  }, [tg]);

  // Native Telegram MainButton controls
  const mainButton = useMemo(() => {
    return {
      show: (text?: string) => {
        if (!tg?.MainButton) return;
        if (text) tg.MainButton.setText(text);
        tg.MainButton.show();
      },
      hide: () => {
        try {
          tg?.MainButton?.hide();
        } catch {}
      },
      setText: (text: string) => {
        try {
          tg?.MainButton?.setText(text);
        } catch {}
      },
      showProgress: (leaveActive = false) => {
        try {
          tg?.MainButton?.showProgress(leaveActive);
        } catch {}
      },
      hideProgress: () => {
        try {
          tg?.MainButton?.hideProgress();
        } catch {}
      },
      enable: () => {
        try {
          tg?.MainButton?.enable();
        } catch {}
      },
      disable: () => {
        try {
          tg?.MainButton?.disable();
        } catch {}
      },
      onClick: (fn: () => void) => {
        try {
          tg?.MainButton?.onClick(fn);
        } catch {}
      },
      offClick: (fn: () => void) => {
        try {
          tg?.MainButton?.offClick(fn);
        } catch {}
      },
      setParams: (params: {
        text?: string;
        color?: string;
        text_color?: string;
        is_active?: boolean;
        is_visible?: boolean;
      }) => {
        try {
          tg?.MainButton?.setParams(params);
        } catch {}
      },
      isVisible: Boolean(tg?.MainButton?.isVisible),
    };
  }, [tg]);

  // Native Telegram BackButton controls
  const backButton = useMemo(() => {
    return {
      show: () => {
        try {
          tg?.BackButton?.show();
        } catch {}
      },
      hide: () => {
        try {
          tg?.BackButton?.hide();
        } catch {}
      },
      onClick: (fn: () => void) => {
        try {
          tg?.BackButton?.onClick(fn);
        } catch {}
      },
      offClick: (fn: () => void) => {
        try {
          tg?.BackButton?.offClick(fn);
        } catch {}
      },
      isVisible: Boolean(tg?.BackButton?.isVisible),
    };
  }, [tg]);

  const close = useCallback(() => {
    try {
      tg?.close?.();
    } catch {}
  }, [tg]);

  const openLink = useCallback((url: string) => {
    if (tg?.openLink) {
      tg.openLink(url);
    } else {
      window.open(url, '_blank');
    }
  }, [tg]);

  const showAlert = useCallback((message: string) => {
    if (tg?.showAlert) {
      tg.showAlert(message);
    } else {
      alert(message);
    }
  }, [tg]);

  return {
    tg,
    user,
    initData,
    isReady,
    colorScheme,
    themeParams,
    isInsideTelegram,
    haptic,
    setHeaderColor,
    setBackgroundColor,
    mainButton,
    backButton,
    close,
    openLink,
    showAlert,
  };
}
