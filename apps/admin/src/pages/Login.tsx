import React, { useEffect, useState } from 'react';
import { API_BASE, apiRequest, setAuthToken } from '../api/client.js';
import { Store, ArrowRight, Bot, ExternalLink, Info } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: () => void;
}

export function Login({ onLoginSuccess }: LoginProps) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [storeName, setStoreName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoInfo, setDemoInfo] = useState<{
    enabled: boolean;
    email?: string;
    password?: string;
  } | null>(null);

  useEffect(() => {
    let active = true;
    const envDemo = import.meta.env.VITE_ALLOW_DEMO_LOGIN === 'true';

    fetch(`${API_BASE}/health`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active) return;
        if (data?.allowDemoLogin === true || envDemo) {
          setDemoInfo({
            enabled: true,
            email: data?.demoEmail || import.meta.env.VITE_DEMO_EMAIL,
            password: data?.demoPassword || import.meta.env.VITE_DEMO_PASSWORD,
          });
        }
      })
      .catch(() => {
        if (active && envDemo) {
          setDemoInfo({
            enabled: true,
            email: import.meta.env.VITE_DEMO_EMAIL,
            password: import.meta.env.VITE_DEMO_PASSWORD,
          });
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const endpoint = isRegister ? '/api/v1/admin/auth/register' : '/api/v1/admin/auth/login';
      const payload = isRegister
        ? { email: email.trim(), password, storeName: storeName.trim() }
        : { email: email.trim(), password };

      const data = await apiRequest<{ token?: string }>(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (data.token) {
        setAuthToken(data.token);
        onLoginSuccess();
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка аутентификации');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-subtle/40 flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-md border border-line bg-paper p-6 shadow-sm space-y-5">
        {/* Brand / Header */}
        <div className="space-y-1.5">
          <div className="w-8 h-8 rounded-md bg-ink text-paper flex items-center justify-center mb-3">
            <Store className="w-4 h-4" />
          </div>
          <h1>
            {isRegister ? 'Регистрация магазина' : 'Вход в личный кабинет'}
          </h1>
          <p className="hint">
            {isRegister
              ? 'Создайте аккаунт магазина для настройки каталога, бота и оплаты.'
              : 'Управление каталогом, заказами и Telegram-ботом.'}
          </p>
        </div>

        {demoInfo?.enabled && !isRegister && (
          <div className="p-3 rounded-md bg-subtle/70 border border-line text-xs text-muted space-y-1.5">
            <div className="flex items-center gap-1.5 font-medium text-ink">
              <Info className="w-3.5 h-3.5 shrink-0" />
              <span>Доступен тестовый демо-режим</span>
            </div>
            {demoInfo.email && demoInfo.password ? (
              <button
                type="button"
                onClick={() => {
                  setEmail(demoInfo.email || '');
                  setPassword(demoInfo.password || '');
                  setError(null);
                }}
                className="link font-medium"
              >
                Подставить данные демо-аккаунта
              </button>
            ) : (
              <p>Введите учётные данные мерчанта или демо-пользователя.</p>
            )}
          </div>
        )}

        {error && (
          <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {isRegister && (
            <div>
              <label className="label">Название магазина</label>
              <input
                type="text"
                required
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="Например: Apex Streetwear"
                className="input"
              />
            </div>
          )}

          <div>
            <label className="label">Электронная почта</label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="merchant@example.com"
              className="input"
            />
          </div>

          <div>
            <label className="label">Пароль</label>
            <input
              type="password"
              required
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="input font-mono"
            />
          </div>

          <div className="pt-1">
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full"
            >
              <span>{isLoading ? 'Проверка…' : isRegister ? 'Зарегистрироваться' : 'Войти в панель'}</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>
          </div>
        </form>

        {/* Telegram Access / Password Recovery */}
        <div className="p-3 rounded-md bg-subtle/50 border border-line text-xs space-y-1.5">
          <div className="flex items-center gap-1.5 font-medium text-ink">
            <Bot className="w-3.5 h-3.5 shrink-0 text-muted" />
            <span>Забыли пароль или создавали магазин в боте?</span>
          </div>
          <p className="text-muted leading-relaxed">
            Отправьте команду <code className="px-1 py-0.5 rounded bg-paper border border-line font-mono">/login</code> или <code className="px-1 py-0.5 rounded bg-paper border border-line font-mono">/resetpassword</code> боту в Telegram для восстановления доступа.
          </p>
          <a
            href="https://t.me/miraiedu_bot?start=login"
            target="_blank"
            rel="noreferrer"
            className="link inline-flex items-center gap-1 font-medium"
          >
            <span>Открыть @miraiedu_bot</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        <div className="pt-3 border-t border-line text-center text-xs text-muted">
          {isRegister ? (
            <p>
              Уже есть аккаунт?{' '}
              <button
                type="button"
                onClick={() => {
                  setIsRegister(false);
                  setError(null);
                }}
                className="link font-medium"
              >
                Войти
              </button>
            </p>
          ) : (
            <p>
              Нет аккаунта магазина?{' '}
              <button
                type="button"
                onClick={() => {
                  setIsRegister(true);
                  setError(null);
                }}
                className="link font-medium"
              >
                Зарегистрировать магазин
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
