import type {
  ChangePasswordRequest,
  LoginRequest,
  RegisterRequest,
  UpdateProfileRequest,
  UserProfileResponse,
  WebSessionResponse,
} from '@/types';

export class ApiClientError extends Error {
  status: number;
  fieldErrors?: Record<string, string>;

  constructor(message: string, status: number, fieldErrors?: Record<string, string>) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) {
    throw new ApiClientError(data.message || 'Request failed', response.status, data.fieldErrors);
  }
  return data as T;
}

export const authService = {
  async register(payload: RegisterRequest): Promise<{ message: string }> {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return parseResponse(response);
  },

  async login(payload: LoginRequest): Promise<WebSessionResponse> {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return parseResponse(response);
  },

  async logout(): Promise<{ message: string }> {
    const response = await fetch('/api/auth/logout', {
      method: 'POST',
    });
    return parseResponse(response);
  },

  async getMe(): Promise<UserProfileResponse> {
    const response = await fetch('/api/auth/me', { cache: 'no-store' });
    return parseResponse(response);
  },

  async updateMe(payload: UpdateProfileRequest): Promise<UserProfileResponse> {
    const response = await fetch('/api/auth/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return parseResponse(response);
  },

  async changePassword(payload: ChangePasswordRequest): Promise<{ message: string }> {
    const response = await fetch('/api/auth/password', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return parseResponse(response);
  },

  async verifyEmail(token: string): Promise<{ message: string }> {
    const response = await fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`, {
      cache: 'no-store',
    });
    return parseResponse(response);
  },

  async resendVerification(email: string): Promise<{ message: string }> {
    const response = await fetch('/api/auth/resend-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    return parseResponse(response);
  },
};
