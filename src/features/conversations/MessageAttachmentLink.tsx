import { useQuery } from '@tanstack/react-query';
import { Download, FileWarning } from 'lucide-react';

import { getMessageAttachmentUrl } from '@/features/conversations/attachments';
import { getSupabaseClient } from '@/lib/supabase/client';

export function MessageAttachmentLink({
  name,
  path,
  sizeBytes,
}: {
  name: string;
  path: string;
  sizeBytes: number;
}) {
  const client = getSupabaseClient();
  const signedUrlQuery = useQuery({
    enabled: Boolean(client && path),
    queryFn: () => getMessageAttachmentUrl(client!, path),
    queryKey: ['message-attachment', path],
    staleTime: 8 * 60 * 1000,
  });

  if (signedUrlQuery.isError) {
    return (
      <span className="message-attachment-error" role="status">
        <FileWarning aria-hidden="true" size={16} /> Pièce jointe indisponible
      </span>
    );
  }
  return (
    <a
      aria-busy={signedUrlQuery.isLoading || undefined}
      className="message-attachment-link"
      href={signedUrlQuery.data}
      rel="noreferrer"
      target="_blank"
    >
      <Download aria-hidden="true" size={16} />
      <span>
        {name} ·{' '}
        {(sizeBytes / 1024).toLocaleString('fr-FR', {
          maximumFractionDigits: 0,
        })}{' '}
        Ko
      </span>
    </a>
  );
}
