'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { burialService } from '@/core/api/burial.service';
import type { BurialResponse, BurialRequest } from '@/types';

export function useBurials(cemeteryId?: number | null) {
  const [burials, setBurials] = useState<BurialResponse[]>([]);
  const [loading, setLoading] = useState(cemeteryId !== null);
  const [error, setError] = useState<string | null>(null);
  const requestSeqRef = useRef(0);

  const fetchAll = useCallback(async () => {
    const requestSeq = ++requestSeqRef.current;
    try {
      setLoading(true);
      setError(null);
      const data = await burialService.getAll(cemeteryId);
      if (requestSeq !== requestSeqRef.current) return;
      setBurials(data);
    } catch {
      if (requestSeq !== requestSeqRef.current) return;
      setError('Не удалось загрузить список захоронений');
    } finally {
      if (requestSeq !== requestSeqRef.current) return;
      setLoading(false);
    }
  }, [cemeteryId]);

  useEffect(() => {
    requestSeqRef.current += 1;

    if (cemeteryId === null) {
      setBurials([]);
      setError(null);
      setLoading(false);
      return;
    }

    if (cemeteryId !== undefined) {
      setBurials([]);
    }

    fetchAll();
  }, [fetchAll, cemeteryId]);

  const create = async (request: BurialRequest): Promise<BurialResponse> => {
    const created = await burialService.create(request);
    setBurials((prev) => [...prev, created]);
    return created;
  };

  const update = async (id: number, request: BurialRequest): Promise<BurialResponse> => {
    const updated = await burialService.update(id, request);
    setBurials((prev) => prev.map((b) => (b.id === id ? updated : b)));
    return updated;
  };

  const remove = async (id: number): Promise<void> => {
    await burialService.delete(id);
    setBurials((prev) => prev.filter((b) => b.id !== id));
  };

  return { burials, loading, error, refetch: fetchAll, create, update, remove };
}

export function useBurialSearch() {
  const [results, setResults] = useState<BurialResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const search = useCallback(async (name: string) => {
    if (!name.trim()) {
      setResults([]);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      setQuery(name);
      const data = await burialService.searchByName(name);
      setResults(data);
    } catch {
      setError('Ошибка при поиске');
    } finally {
      setLoading(false);
    }
  }, []);

  const findNearby = useCallback(async (lat: number, lon: number, radius?: number) => {
    try {
      setLoading(true);
      setError(null);
      const data = await burialService.findNearby(lat, lon, radius);
      setResults(data);
    } catch {
      setError('Ошибка при поиске рядом');
    } finally {
      setLoading(false);
    }
  }, []);

  return { results, loading, error, query, search, findNearby };
}
