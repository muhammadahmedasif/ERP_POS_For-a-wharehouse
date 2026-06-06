const TOKEN_KEY = "token";
const USER_KEY = "user";
export const AUTH_INVALID_EVENT = "auth:invalid";

type StoredUser = Record<string, unknown> | null;

function decodeBase64Url(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  return atob(padded);
}

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): StoredUser {
  const user = localStorage.getItem(USER_KEY);
  if (!user) return null;

  try {
    return JSON.parse(user);
  } catch {
    return null;
  }
}

export function isTokenUsable(token = getStoredToken()) {
  if (!token) return false;

  const parts = token.split(".");
  if (parts.length !== 3) return false;

  try {
    const payload = JSON.parse(decodeBase64Url(parts[1]));
    return typeof payload.exp !== "number" || payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

export function setStoredAuth(token: string, user: unknown) {
  if (!isTokenUsable(token)) {
    clearStoredAuth();
    throw new Error("Invalid login token received from server");
  }

  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearStoredAuth(dispatchInvalidEvent = false) {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);

  if (dispatchInvalidEvent) {
    window.dispatchEvent(new Event(AUTH_INVALID_EVENT));
  }
}

export function getInitialStoredUser() {
  if (!isTokenUsable()) {
    clearStoredAuth();
    return null;
  }

  const user = getStoredUser();
  if (!user) {
    clearStoredAuth();
    return null;
  }

  return user;
}
