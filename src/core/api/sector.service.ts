import { apiClient } from '@/core/api/http-client';
import type { SectorRequest, SectorResponse } from '@/types';

export const sectorService = {
  getAll: async (cemeteryId?: number): Promise<SectorResponse[]> => {
    const params = cemeteryId ? { cemeteryId } : {};
    const { data } = await apiClient.get<SectorResponse[]>('/sectors', { params });
    return data;
  },

  getById: async (id: number): Promise<SectorResponse> => {
    const { data } = await apiClient.get<SectorResponse>(`/sectors/${id}`);
    return data;
  },

  create: async (request: SectorRequest): Promise<SectorResponse> => {
    const { data } = await apiClient.post<SectorResponse>('/sectors', request);
    return data;
  },

  update: async (id: number, request: SectorRequest): Promise<SectorResponse> => {
    const { data } = await apiClient.put<SectorResponse>(`/sectors/${id}`, request);
    return data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/sectors/${id}`);
  },
};
