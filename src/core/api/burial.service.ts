import { apiClient } from '@/core/api/http-client';
import type { BurialRequest, BurialResponse } from '@/types';

export const burialService = {
  getAll: async (cemeteryId?: number | null): Promise<BurialResponse[]> => {
    const { data } = await apiClient.get<BurialResponse[]>('/burials', {
      params: cemeteryId == null ? undefined : { cemeteryId },
    });
    return data;
  },

  getById: async (id: number): Promise<BurialResponse> => {
    const { data } = await apiClient.get<BurialResponse>(`/burials/${id}`);
    return data;
  },

  searchByName: async (name: string): Promise<BurialResponse[]> => {
    const { data } = await apiClient.get<BurialResponse[]>('/burials/search', {
      params: { name },
    });
    return data;
  },

  findNearby: async (lat: number, lon: number, radius = 100): Promise<BurialResponse[]> => {
    const { data } = await apiClient.get<BurialResponse[]>('/burials/nearby', {
      params: { lat, lon, radius },
    });
    return data;
  },

  create: async (request: BurialRequest): Promise<BurialResponse> => {
    const { data } = await apiClient.post<BurialResponse>('/burials', request);
    return data;
  },

  update: async (id: number, request: BurialRequest): Promise<BurialResponse> => {
    const { data } = await apiClient.put<BurialResponse>(`/burials/${id}`, request);
    return data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/burials/${id}`);
  },
};
