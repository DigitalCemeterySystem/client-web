import axios, { AxiosInstance, AxiosResponse } from 'axios';

/**
 * Базовый HTTP-клиент. Все запросы направляются на API Gateway.
 * В браузере используем относительный путь /api (проксируется next.config),
 * в SSR-контексте — полный URL из переменной окружения.
 */
const createApiClient = (): AxiosInstance => {
  const baseURL =
    typeof window === 'undefined'
      ? `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/api`
      : '/api';

  const instance = axios.create({
    baseURL,
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: 10_000,
  });

  // Request interceptor — место для добавления токена авторизации в будущем
  instance.interceptors.request.use(
    (config) => {
      // Web-auth now uses HttpOnly cookies and Next route handlers.
      // Add an Authorization header here later if browser-side write flows need it.
      // const token = getToken();
      // if (token) config.headers.Authorization = `Bearer ${token}`;
      return config;
    },
    (error) => Promise.reject(error)
  );

  // Response interceptor — централизованная обработка ошибок
  instance.interceptors.response.use(
    (response: AxiosResponse) => response,
    (error) => {
      if (error.response?.status === 404) {
        console.error('[API] Resource not found:', error.config?.url);
      } else if (error.response?.status >= 500) {
        console.error('[API] Server error:', error.response?.data);
      }
      return Promise.reject(error);
    }
  );

  return instance;
};

export const apiClient = createApiClient();
