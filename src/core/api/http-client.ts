import axios, { AxiosInstance, AxiosResponse } from 'axios';

/**
 * Базовый HTTP-клиент.
 * В браузере запросы идут на относительный путь /api и обрабатываются Next.js.
 * На сервере используется URL API Gateway из переменных окружения.
 */
const createApiClient = (): AxiosInstance => {
  const baseURL =
    typeof window === 'undefined'
      ? `${process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/api`
      : '/api';

  const instance = axios.create({
    baseURL,
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: 10_000,
  });

  // Здесь можно будет добавить заголовок авторизации, если браузерным запросам на запись потребуется bearer-токен.
  instance.interceptors.request.use(
    (config) => {
      // Сейчас веб-авторизация использует HttpOnly cookies и Next.js Route Handlers.
      // const token = getToken();
      // if (token) config.headers.Authorization = `Bearer ${token}`;
      return config;
    },
    (error) => Promise.reject(error)
  );

  // Централизованная обработка ошибок API.
  instance.interceptors.response.use(
    (response: AxiosResponse) => response,
    (error) => {
      if (error.response?.status === 404) {
        console.error('[API] Ресурс не найден:', error.config?.url);
      } else if (error.response?.status >= 500) {
        console.error('[API] Ошибка сервера:', error.response?.data);
      }
      return Promise.reject(error);
    }
  );

  return instance;
};

export const apiClient = createApiClient();
