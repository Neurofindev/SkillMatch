import { useEffect } from 'react';

const suffix = 'SkillMatch';

export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = `${title} — ${suffix}`;
  }, [title]);
}
