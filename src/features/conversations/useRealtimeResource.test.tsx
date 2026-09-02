import { act, render, screen } from '@testing-library/react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useRealtimeResource } from '@/features/conversations/useRealtimeResource';
import type { Database } from '@/types/database.generated';

describe('useRealtimeResource', () => {
  it('filtre une seule ressource et nettoie le canal au changement puis au démontage', async () => {
    let databaseCallback: (() => void) | undefined;
    const firstChannel = {
      on: vi.fn(
        (_kind: string, options: { filter: string }, callback: () => void) => {
          expect(options.filter).toBe('conversation_id=eq.conversation-1');
          databaseCallback = callback;
          return firstChannel;
        },
      ),
      subscribe: vi.fn((callback: (status: string) => void) => {
        callback('SUBSCRIBED');
        return firstChannel;
      }),
    };
    const secondChannel = {
      on: vi.fn(() => secondChannel),
      subscribe: vi.fn((callback: (status: string) => void) => {
        callback('SUBSCRIBED');
        return secondChannel;
      }),
    };
    const channel = vi
      .fn()
      .mockReturnValueOnce(firstChannel)
      .mockReturnValueOnce(secondChannel);
    const removeChannel = vi.fn().mockResolvedValue('ok');
    const client = {
      channel,
      removeChannel,
    } as unknown as SupabaseClient<Database>;

    function Harness({ scope }: { scope: string }) {
      const [events, setEvents] = useState(0);
      const state = useRealtimeResource({
        client,
        filter: `conversation_id=eq.${scope}`,
        onChange: () => setEvents((count) => count + 1),
        scope,
        table: 'messages',
      });
      return (
        <span>
          {state}:{events}
        </span>
      );
    }

    const view = render(<Harness scope="conversation-1" />);
    expect(await screen.findByText('subscribed:0')).toBeInTheDocument();
    act(() => databaseCallback?.());
    expect(screen.getByText('subscribed:1')).toBeInTheDocument();

    view.rerender(<Harness scope="conversation-2" />);
    expect(removeChannel).toHaveBeenCalledWith(firstChannel);
    view.unmount();
    expect(removeChannel).toHaveBeenCalledWith(secondChannel);
    expect(removeChannel).toHaveBeenCalledTimes(2);
  });
});
