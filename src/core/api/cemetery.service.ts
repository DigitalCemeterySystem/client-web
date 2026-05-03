import { apiClient } from '@/core/api/http-client';
import type { CemeteryRequest, CemeteryResponse } from '@/types';

/**
 * Сервис для работы с кладбищами.
 * Здесь остаются только HTTP-запросы к /api/cemeteries.
 */
export const cemeteryService = {
  getAll: async (): Promise<CemeteryResponse[]> => {
    const { data } = await apiClient.get<CemeteryResponse[]>('/cemeteries');
    return data;
  },

  getById: async (id: number): Promise<CemeteryResponse> => {
    const { data } = await apiClient.get<CemeteryResponse>(`/cemeteries/${id}`);
    return data;
  },

  create: async (request: CemeteryRequest): Promise<CemeteryResponse> => {
    const { data } = await apiClient.post<CemeteryResponse>('/cemeteries', request);
    return data;
  },

  update: async (id: number, request: CemeteryRequest): Promise<CemeteryResponse> => {
    const { data } = await apiClient.put<CemeteryResponse>(`/cemeteries/${id}`, request);
    return data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/cemeteries/${id}`);
  },
};
