const SESSION_KEY = "session_id";
const RESTAURANT_NAME_KEY = "customer_restaurant_name";

/** Anonymous browser session for QR ordering (no login). */
export function ensureCustomerSession() {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function getCustomerSessionId() {
  return sessionStorage.getItem(SESSION_KEY) || "";
}

/** Cached from menu API for checkout / cart headers. */
export function setCustomerRestaurantName(name) {
  if (name && typeof name === "string") {
    sessionStorage.setItem(RESTAURANT_NAME_KEY, name.trim());
  }
}

export function getCustomerRestaurantName() {
  return sessionStorage.getItem(RESTAURANT_NAME_KEY) || "";
}
