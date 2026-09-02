import { useEffect, useRef, useState } from 'react';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database.generated';

export type RealtimeState = 'connecting' | 'fallback' | 'subscribed';

interface RealtimeResourceOptions {
  client: SupabaseClient<Database> | null;
  filter: string;
  onChange: () => void;
  scope: string;
  table: 'messages' | 'notifications';
}

export function useRealtimeResource({
  client,
  filter,
  onChange,
  scope,
  table,
}: RealtimeResourceOptions): RealtimeState {
  const callbackRef = useRef(onChange);
  const [state, setState] = useState<RealtimeState>('connecting');

  useEffect(() => {
    callbackRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!client || !filter) {
      queueMicrotask(() => setState('fallback'));
      return;
    }
    let active = true;
    const channel: RealtimeChannel = client
      .channel(`skillmatch:${table}:${scope}`)
      .on(
        'postgres_changes',
        { event: '*', filter, schema: 'public', table },
        () => callbackRef.current(),
      )
      .subscribe((status) => {
        if (!active) return;
        setState(status === 'SUBSCRIBED' ? 'subscribed' : 'fallback');
      });

    return () => {
      active = false;
      void client.removeChannel(channel);
    };
  }, [client, filter, scope, table]);

  return state;
}
