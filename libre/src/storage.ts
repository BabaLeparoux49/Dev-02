import { DEFAULT_STATE } from "./types";
import type { AppState } from "./types";

const KEY = "libre-finance-v1";

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    const parsed = JSON.parse(raw) as AppState;
    return {
      profile: { ...DEFAULT_STATE.profile, ...parsed.profile },
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
    };
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}

export function saveState(state: AppState): void {
  localStorage.setItem(KEY, JSON.stringify(state));
}
