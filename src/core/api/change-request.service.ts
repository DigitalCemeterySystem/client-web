import axios from 'axios';
import type { BurialChangeDraftRequest, ChangeRequestResponse } from '@/types';

const CHANGE_REQUEST_PROXY_BASE = '/internal-api/change-requests';
const changeRequestClient = axios.create({
  baseURL: CHANGE_REQUEST_PROXY_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10_000,
});

type ErrorLike = {
  response?: {
    data?: unknown;
  };
  message?: string;
};

function extractMessageFromObject(value: unknown) {
  if (!value || typeof value !== 'object') return null;

  const data = value as {
    message?: unknown;
    error?: unknown;
    detail?: unknown;
    description?: unknown;
  };

  const candidates = [data.message, data.error, data.detail, data.description];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate;
    }
  }

  return null;
}

function toMessage(error: unknown, fallback: string) {
  const responseData = (error as ErrorLike)?.response?.data;

  if (typeof responseData === 'string') {
    const trimmed = responseData.trim();
    if (!trimmed) return fallback;

    try {
      const parsed = JSON.parse(trimmed);
      const parsedMessage = extractMessageFromObject(parsed);
      if (parsedMessage) {
        return parsedMessage;
      }
    } catch {
      return trimmed;
    }

    return trimmed;
  }

  const responseMessage = extractMessageFromObject(responseData);
  if (responseMessage) {
    return responseMessage;
  }

  const genericMessage = (error as ErrorLike)?.message;
  if (typeof genericMessage === 'string' && genericMessage.trim()) {
    return genericMessage;
  }

  return fallback;
}

export const changeRequestService = {
  async getMy(): Promise<ChangeRequestResponse[]> {
    try {
      const { data } = await changeRequestClient.get<ChangeRequestResponse[]>('/my');
      return data;
    } catch (error) {
      throw new Error(toMessage(error, 'Не удалось загрузить ваши заявки.'));
    }
  },

  async getAll(): Promise<ChangeRequestResponse[]> {
    try {
      const { data } = await changeRequestClient.get<ChangeRequestResponse[]>('');
      return data;
    } catch (error) {
      throw new Error(toMessage(error, 'Не удалось загрузить список заявок.'));
    }
  },

  async submitBurialEdit(burialId: number, request: BurialChangeDraftRequest): Promise<ChangeRequestResponse> {
    try {
      const { data } = await changeRequestClient.post<ChangeRequestResponse>(`/burials/${burialId}/edit`, request);
      return data;
    } catch (error) {
      throw new Error(toMessage(error, 'Не удалось сохранить заявку на редактирование.'));
    }
  },

  async createBurialAddition(request: BurialChangeDraftRequest): Promise<ChangeRequestResponse> {
    try {
      const { data } = await changeRequestClient.post<ChangeRequestResponse>('/burials/add', request);
      return data;
    } catch (error) {
      throw new Error(toMessage(error, 'Не удалось создать заявку на добавление.'));
    }
  },

  async updateOwnDraft(requestId: number, request: BurialChangeDraftRequest): Promise<ChangeRequestResponse> {
    try {
      const { data } = await changeRequestClient.put<ChangeRequestResponse>(`/${requestId}/draft`, request);
      return data;
    } catch (error) {
      throw new Error(toMessage(error, 'Не удалось обновить черновик заявки.'));
    }
  },

  async approve(requestId: number): Promise<ChangeRequestResponse> {
    try {
      const { data } = await changeRequestClient.post<ChangeRequestResponse>(`/${requestId}/approve`);
      return data;
    } catch (error) {
      throw new Error(toMessage(error, 'Не удалось одобрить заявку.'));
    }
  },

  async reject(requestId: number, reason: string): Promise<ChangeRequestResponse> {
    try {
      const { data } = await changeRequestClient.post<ChangeRequestResponse>(`/${requestId}/reject`, { reason });
      return data;
    } catch (error) {
      throw new Error(toMessage(error, 'Не удалось отклонить заявку.'));
    }
  },
};
