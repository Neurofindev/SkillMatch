export type AccountCapability = 'find_missions' | 'publish_missions';

export function hasCapability(
  capabilities: readonly AccountCapability[],
  expected: AccountCapability,
): boolean {
  return capabilities.includes(expected);
}
