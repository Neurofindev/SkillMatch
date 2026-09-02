export type WorkMode = 'local' | 'remote' | 'hybrid';

const workModeLabels: Record<WorkMode, string> = {
  local: 'Sur place',
  remote: 'À distance',
  hybrid: 'Hybride',
};

export function formatWorkMode(mode: WorkMode): string {
  return workModeLabels[mode];
}
