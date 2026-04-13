export const ACCESS_TOKEN_KEY = "access";
export const REFRESH_TOKEN_KEY = "refresh";
// Backward compatibility for older login flow.
export const LEGACY_TOKEN_KEY = "token";
export const ROLE_KEY = "role";
export const RESTAURANT_KEY = "restaurant";
export const NAME_KEY = "name";
export const RESTAURANT_ACTIVE_KEY = "restaurant_active";
export const SUBSCRIPTION_STATUS_KEY = "subscription_status";

const sessionGet = (key) => sessionStorage.getItem(key);
const localGet = (key) => localStorage.getItem(key);
const sessionSet = (key, value) => sessionStorage.setItem(key, value);
const localSet = (key, value) => localStorage.setItem(key, value);
const clearKey = (key) => {
  sessionStorage.removeItem(key);
  localStorage.removeItem(key);
};

export const getAccessToken = () =>
  sessionGet(ACCESS_TOKEN_KEY) ||
  localGet(ACCESS_TOKEN_KEY) ||
  sessionGet(LEGACY_TOKEN_KEY) ||
  localGet(LEGACY_TOKEN_KEY);

export const getRefreshToken = () =>
  sessionGet(REFRESH_TOKEN_KEY) || localGet(REFRESH_TOKEN_KEY);

export const getUserRole = () => sessionGet(ROLE_KEY) || localGet(ROLE_KEY);
export const getRestaurantName = () => sessionGet(RESTAURANT_KEY) || localGet(RESTAURANT_KEY) || "";
export const getRestaurantActive = () =>
  (sessionGet(RESTAURANT_ACTIVE_KEY) || localGet(RESTAURANT_ACTIVE_KEY) || "") === "true";
export const getSubscriptionStatus = () =>
  sessionGet(SUBSCRIPTION_STATUS_KEY) || localGet(SUBSCRIPTION_STATUS_KEY) || "inactive";

export const setAuthTokens = ({ access, refresh }) => {
  if (access) {
    // Keep auth tab-scoped to avoid cross-tab user leakage.
    sessionSet(ACCESS_TOKEN_KEY, access);
    sessionSet(LEGACY_TOKEN_KEY, access);

    // Maintain compatibility while migrating existing sessions.
    localSet(ACCESS_TOKEN_KEY, access);
    localSet(LEGACY_TOKEN_KEY, access);
  }
  if (refresh) {
    sessionSet(REFRESH_TOKEN_KEY, refresh);
    localSet(REFRESH_TOKEN_KEY, refresh);
  }
};

export const setUserSession = ({ role, restaurant, name, restaurant_active, subscription_status }) => {
  if (role) {
    sessionSet(ROLE_KEY, role);
    localSet(ROLE_KEY, role);
  }
  if (restaurant) {
    sessionSet(RESTAURANT_KEY, restaurant);
    localSet(RESTAURANT_KEY, restaurant);
  }
  if (name) {
    sessionSet(NAME_KEY, name);
    localSet(NAME_KEY, name);
  }
  if (typeof restaurant_active === "boolean") {
    sessionSet(RESTAURANT_ACTIVE_KEY, String(restaurant_active));
    localSet(RESTAURANT_ACTIVE_KEY, String(restaurant_active));
  }
  if (subscription_status) {
    sessionSet(SUBSCRIPTION_STATUS_KEY, subscription_status);
    localSet(SUBSCRIPTION_STATUS_KEY, subscription_status);
  }
};

export const clearAuth = () => {
  [
    ACCESS_TOKEN_KEY,
    REFRESH_TOKEN_KEY,
    LEGACY_TOKEN_KEY,
    ROLE_KEY,
    RESTAURANT_KEY,
    NAME_KEY,
    RESTAURANT_ACTIVE_KEY,
    SUBSCRIPTION_STATUS_KEY,
  ].forEach(clearKey);
};
