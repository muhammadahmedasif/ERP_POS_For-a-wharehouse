import { clearStoredAuth, getStoredToken } from "./authStorage";

const originalFetch = window.fetch.bind(window);

window.fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  const isApiRequest = url.startsWith("/api/") || url.includes(`${window.location.origin}/api/`);
  const isAuthRequest = url.includes("/api/auth/");
  const token = getStoredToken();

  if (!isApiRequest || isAuthRequest || !token) {
    return originalFetch(input, init);
  }

  const headers = new Headers(init.headers);
  if (!headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await originalFetch(input, { ...init, headers });

  if (response.status === 401) {
    clearStoredAuth(true);
  }

  return response;
};
