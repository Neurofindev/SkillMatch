import type { LucideIcon } from 'lucide-react';

export interface NavigationItem {
  label: string;
  to: string;
  icon?: LucideIcon;
  end?: boolean;
}
