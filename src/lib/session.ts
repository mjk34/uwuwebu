const NS = "uwuversity";

export const SessionKeys = {
  introPlayed: `${NS}:introPlayed`,
  bootPlayed: `${NS}:bootPlayed`,
} as const;

export const LocalKeys = {
  mockSession: `${NS}:mockSession`,
  muted: `${NS}:muted`,
} as const;

const isBrowser = () => typeof window !== "undefined";

export function readSession(key: string): string | null {
  if (!isBrowser()) return null;
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeSession(key: string, value: string): void {
  if (!isBrowser()) return;
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // quota / private mode — swallow
  }
}

export function readLocal(key: string): string | null {
  if (!isBrowser()) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeLocal(key: string, value: string): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // swallow
  }
}

export function clearLocal(key: string): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // swallow
  }
}

export function hasMockSession(): boolean {
  return readLocal(LocalKeys.mockSession) === "1";
}

export function setMockSession(on: boolean): void {
  if (on) writeLocal(LocalKeys.mockSession, "1");
  else clearLocal(LocalKeys.mockSession);
  if (isBrowser()) {
    window.dispatchEvent(new CustomEvent("uwuversity:session-change"));
  }
}

export function isMuted(): boolean {
  const raw = readLocal(LocalKeys.muted);
  if (raw === null) return true; // default muted
  return raw === "1";
}

export function setMuted(on: boolean): void {
  writeLocal(LocalKeys.muted, on ? "1" : "0");
  if (isBrowser()) {
    window.dispatchEvent(new CustomEvent("uwuversity:mute-change"));
  }
}
