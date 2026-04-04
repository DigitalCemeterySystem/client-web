'use client';

import { useState, useEffect, useCallback } from 'react';
import { cemeteryService } from '@/core/api/cemetery.service';
import type { CemeteryResponse, CemeteryRequest } from '@/types';

export function useCemeteries() {
  const [cemeteries, setCemeteries] = useState<CemeteryResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await cemeteryService.getAll();
      setCemeteries(data);
    } catch {
      setError('Не удалось загрузить список кладбищ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const create = async (request: CemeteryRequest): Promise<CemeteryResponse> => {
    const created = await cemeteryService.create(request);
    setCemeteries((prev) => [...prev, created]);
    return created;
  };

  const update = async (id: number, request: CemeteryRequest): Promise<CemeteryResponse> => {
    const updated = await cemeteryService.update(id, request);
    setCemeteries((prev) => prev.map((c) => (c.id === id ? updated : c)));
    return updated;
  };

  const remove = async (id: number): Promise<void> => {
    await cemeteryService.delete(id);
    setCemeteries((prev) => prev.filter((c) => c.id !== id));
  };

  return { cemeteries, loading, error, refetch: fetchAll, create, update, remove };
}

export function useCemetery(id: number | null) {
  const [cemetery, setCemetery] = useState<CemeteryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id === null) return;
    setLoading(true);
    setError(null);
    cemeteryService
      .getById(id)
      .then(setCemetery)
      .catch(() => setError('Не удалось загрузить данные кладбища'))
      .finally(() => setLoading(false));
  }, [id]);

  return { cemetery, loading, error };
}
