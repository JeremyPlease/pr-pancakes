import { useState, useCallback, useRef } from 'react';
import { fetchAttention } from './attention';

export const useAttention = (token, onTokenExpired) => {
  const [state, setState] = useState({ data: null, loading: false, error: null, refreshedAt: null });
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current || !token) return;
    inFlight.current = true;
    setState(prev => ({ ...prev, loading: true }));
    try {
      const data = await fetchAttention(token);
      setState({ data, loading: false, error: null, refreshedAt: new Date() });
    } catch (error) {
      console.error('Error fetching Short Stack:', error);
      if (error.status === 401) onTokenExpired();
      setState(prev => ({ ...prev, loading: false, error: error.message }));
    } finally {
      inFlight.current = false;
    }
  }, [token, onTokenExpired]);

  return { ...state, refresh };
};
