import { AppConfig, DEFAULT_CONFIG, DEFAULT_ENDPOINTS } from './types';

const CONFIG_KEY = 'vsro_app_config';
export const AREA_MODES_KEY = 'vsro_area_modes';

function isValidApiBase(url: unknown): boolean {
  if (typeof url !== 'string' || !url.trim()) return false;
  return url.startsWith('/api') || url.startsWith('http');
}

export function loadConfig(): AppConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const apiBaseUrl = isValidApiBase(parsed.apiBaseUrl) ? parsed.apiBaseUrl : DEFAULT_CONFIG.apiBaseUrl;
      return {
        ...DEFAULT_CONFIG,
        ...parsed,
        apiBaseUrl,
        endpoints: { ...DEFAULT_ENDPOINTS, ...(parsed.endpoints ?? {}) },
      };
    }
  } catch (e) {
    console.error('[appConfig] Failed to parse stored config, using defaults', e);
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
