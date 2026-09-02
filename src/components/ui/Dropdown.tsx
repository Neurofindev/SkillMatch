import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Check } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

export interface DropdownItem {
  disabled?: boolean;
  label: string;
  onSelect: () => void;
  selected?: boolean;
}

export interface DropdownProps {
  align?: 'start' | 'center' | 'end';
  items: readonly DropdownItem[];
  label: string;
  trigger: ReactNode;
}

export function Dropdown({
  align = 'end',
  items,
  label,
  trigger,
}: DropdownProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild aria-label={label}>
        {trigger}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align={align}
          className="dropdown-content"
          collisionPadding={12}
          sideOffset={8}
        >
          {items.map((item) => (
            <DropdownMenu.Item
              className={cn('dropdown-item', item.selected && 'is-selected')}
              {...(item.disabled !== undefined
                ? { disabled: item.disabled }
                : {})}
              key={item.label}
              onSelect={item.onSelect}
            >
              <span>{item.label}</span>
              {item.selected ? <Check aria-hidden="true" size={16} /> : null}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
