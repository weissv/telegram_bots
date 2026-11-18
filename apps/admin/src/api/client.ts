export const API_BASE =
  import.meta.env.VITE_API_URL ??
  (typeof window !== 'undefined' && window.location.port === '5174'
    ? 'http://localhost:3000'
    : '');

export function getAuthToken(): string | null {
  return localStorage.getItem('tg_merchant_token');
}

export function setAuthToken(token: string) {
  localStorage.setItem('tg_merchant_token', token);
}

export function clearAuthToken() {
  localStorage.removeItem('tg_merchant_token');
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    const isAuthEndpoint =
      endpoint.includes('/auth/login') || endpoint.includes('/auth/register');
    if (token && !isAuthEndpoint) {
      clearAuthToken();
      window.location.reload();
      throw new Error('Session expired');
    }
    const errData = await response.json().catch(() => ({ error: 'Неверный email или пароль' }));
    throw new Error(errData.error || 'Неверный email или пароль');
  }

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(errData.error || `HTTP Error ${response.status}`);
  }

  return response.json();
}
