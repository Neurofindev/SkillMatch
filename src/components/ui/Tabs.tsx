import * as TabsPrimitive from '@radix-ui/react-tabs';
import type { ReactNode } from 'react';

export interface TabItem {
  content: ReactNode;
  label: string;
  value: string;
}

export interface TabsProps {
  defaultValue?: string;
  items: readonly TabItem[];
  label: string;
  value?: string;
  onValueChange?: (value: string) => void;
}

export function Tabs({
  defaultValue,
  items,
  label,
  onValueChange,
  value,
}: TabsProps) {
  const fallbackValue = items[0]?.value ?? '';
  return (
    <TabsPrimitive.Root
      defaultValue={defaultValue ?? fallbackValue}
      {...(onValueChange ? { onValueChange } : {})}
      {...(value !== undefined ? { value } : {})}
    >
      <TabsPrimitive.List aria-label={label} className="tabs-list">
        {items.map((item) => (
          <TabsPrimitive.Trigger
            className="tabs-trigger"
            key={item.value}
            value={item.value}
          >
            {item.label}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
      {items.map((item) => (
        <TabsPrimitive.Content
          className="tabs-content"
          key={item.value}
          value={item.value}
        >
          {item.content}
        </TabsPrimitive.Content>
      ))}
    </TabsPrimitive.Root>
  );
}
