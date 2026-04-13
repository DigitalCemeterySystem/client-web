'use client';

import { useCallback, useEffect, useState } from 'react';
import { AUTH_CHANGED_EVENT, authService } from '@/core/api/auth.service';
import type { UserProfileResponse } from '@/types';

export function useCurrentUser() {
  const [user, setUser] = useState<UserProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    try {
      const profile = await authService.getMe();
      setUser(profile);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
    const handleAuthChange = () => {
      setLoading(true);
      loadUser();
    };

    window.addEventListener(AUTH_CHANGED_EVENT, handleAuthChange);
    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, handleAuthChange);
    };
  }, [loadUser]);

  return { user, loading, refresh: loadUser };
}
