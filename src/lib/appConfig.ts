import { AppConfig, DEFAULT_CONFIG, DEFAULT_ENDPOINTS } from './types';

const CONFIG_KEY = 'vsro_app_config';
export const AREA_MODES_KEY = 'vsro_area_modes';

export function loadConfig(): AppConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_CONFIG,
        ...parsed,
        endpoints: { ...DEFAULT_ENDPOINTS, ...(parsed.endpoints ?? {}) },
      };
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_CONFIG };
}

export function saveConfig(config: AppConfig): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

export function updateConfig(partial: Partial<AppConfig>): AppConfig {
  const current = loadConfig();
  const updated: AppConfig = {
    ...current,
    ...partial,
    endpoints: { ...current.endpoints, ...(partial.endpoints ?? {}) },
  };
  saveConfig(updated);
  return updated;
}
