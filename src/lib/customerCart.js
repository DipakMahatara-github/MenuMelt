const CART_KEY = "menumelt_cart";

export function loadCart() {
  try {
    const raw = sessionStorage.getItem(CART_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export function saveCart(lines) {
  sessionStorage.setItem(CART_KEY, JSON.stringify(lines));
}

export function clearCart() {
  sessionStorage.removeItem(CART_KEY);
}
