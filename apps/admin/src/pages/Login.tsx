import React, { useState } from 'react';
import { apiRequest, setAuthToken } from '../api/client.js';
import { Store, ArrowRight, Lock, Mail } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: () => void;
}

export function Login({ onLoginSuccess }: LoginProps) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('demo_merchant@telegram-commerce.local');
  const [password, setPassword] = useState('password123');
  const [storeName, setStoreName] = useState('Apex Streetwear');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const endpoint = isRegister ? '/api/v1/admin/auth/register' : '/api/v1/admin/auth/login';
      const payload = isRegister ? { email, password, storeName } : { email, password };

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
      <div className="w-full max-w-sm rounded-md border border-line bg-paper p-6 shadow-sm space-y-6">
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
              ? 'Создайте аккаунт и запустите продажи в Telegram.'
              : 'Управление каталогом, заказами и Telegram-ботом.'}
          </p>
        </div>

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
                placeholder="Apex Streetwear"
                className="input"
              />
            </div>
          )}

          <div>
            <label className="label">Электронная почта</label>
            <input
              type="email"
              required
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="input font-mono"
            />
          </div>

          <div className="pt-2">
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
