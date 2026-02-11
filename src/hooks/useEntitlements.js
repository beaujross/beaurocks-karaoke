import { useCallback, useEffect, useMemo, useState } from 'react';
import { getMyEntitlements } from '../lib/firebase';
import { hasCapability } from '../billing/capabilities';

export default function useEntitlements({ enabled = true } = {}) {
  const [entitlements, setEntitlements] = useState(null);
  const [loading, setLoading] = useState(!!enabled);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!enabled) return null;
    setLoading(true);
    setError('');
    try {
      const data = await getMyEntitlements();
      setEntitlements(data || null);
      return data || null;
    } catch (err) {
      setError(err?.message || 'Could not load entitlements');
      return null;
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      setEntitlements(null);
      return;
    }
    refresh();
  }, [enabled, refresh]);

  const capabilities = useMemo(() => entitlements?.capabilities || {}, [entitlements]);
  const can = useCallback((capability) => hasCapability(capabilities, capability), [capabilities]);

  return useMemo(() => ({
    entitlements,
    capabilities,
    loading,
    error,
    refresh,
    can,
  }), [entitlements, capabilities, loading, error, refresh, can]);
}
