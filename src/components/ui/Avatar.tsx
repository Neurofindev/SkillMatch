import { useState } from 'react';

import { cn } from '@/lib/cn';

export interface AvatarProps {
  className?: string;
  name: string;
  size?: 'sm' | 'md' | 'lg';
  src?: string;
}

export function Avatar({ className, name, size = 'md', src }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

  return (
    <span className={cn('avatar', `avatar-${size}`, className)}>
      {src && !failed ? (
        <img
          src={src}
          alt={`Photo de ${name}`}
          onError={() => setFailed(true)}
        />
      ) : (
        <span aria-label={name}>{initials || '?'}</span>
      )}
    </span>
  );
}
