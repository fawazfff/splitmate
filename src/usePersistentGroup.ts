import { useCallback, useEffect, useState } from 'react';
import { fetchGroup, loadLocalGroup, persistGroup } from './groupStore';
import { getDemoGroup } from './settlement';
import type { Group } from './types';

export function usePersistentGroup(id: string) {
  const isDemo = id === 'demo';
  const [group, setGroup] = useState<Group | undefined>(() =>
    isDemo ? getDemoGroup() : loadLocalGroup(id),
  );
  const [loading, setLoading] = useState(!isDemo && !group);
  const [error, setError] = useState('');

  useEffect(() => {
    setError('');
    if (isDemo) {
      setGroup(getDemoGroup());
      setLoading(false);
      return;
    }
    let active = true;
    const cached = loadLocalGroup(id);
    setGroup(cached);
    setLoading(true);
    fetchGroup(id)
      .then((saved) => {
        if (active) setGroup(saved);
      })
      .catch((reason: Error) => {
        if (active) setError(reason.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, isDemo]);

  const updateGroup = useCallback(
    async (next: Group) => {
      setGroup(next);
      setError('');
      if (isDemo) return next;
      try {
        const saved = await persistGroup(next);
        setGroup(saved);
        return saved;
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Group sync failed.');
        throw reason;
      }
    },
    [isDemo],
  );

  return { group, loading, error, updateGroup, isDemo };
}
