import { clearAuth, getAccessToken, getRefreshToken, setAuthTokens } from "./auth";
import { API_BASE } from "../config";

let refreshPromise = null;

const refreshAccessToken = async () => {
  const refresh = getRefreshToken();
  if (!refresh) return null;

  const res = await fetch(`${API_BASE}/api/auth/token/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  });

  if (!res.ok) return null;

  const data = await res.json();
  if (!data.access) return null;

  setAuthTokens({ access: data.access });
  return data.access;
};

const getFreshAccessToken = async () => {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
};

export const authFetch = async (url, options = {}) => {
  const headers = {
    ...(options.headers || {}),
  };

  const token = getAccessToken();
  const tableToken = sessionStorage.getItem("table_token");

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (tableToken) {
    headers["X-Table-Token"] = tableToken;
  }

  let response = await fetch(url, { ...options, headers });

  if (response.status !== 401) {
    return response;
  }

  const newAccess = await getFreshAccessToken();
  if (!newAccess) {
    clearAuth();
    if (window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
    return response;
  }

  const retryHeaders = {
    ...(options.headers || {}),
    Authorization: `Bearer ${newAccess}`,
  };
  if (tableToken) {
    retryHeaders["X-Table-Token"] = tableToken;
  }

  response = await fetch(url, { ...options, headers: retryHeaders });
  return response;
};

export { API_BASE };
