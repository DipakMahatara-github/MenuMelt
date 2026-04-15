const CART_KEY = "menumelt_cart";

export function buildCartLineKey(itemId, selectedOptionIds = []) {
  const normalized = [...new Set((selectedOptionIds || []).map(Number).filter(Boolean))].sort((a, b) => a - b);
  return `${itemId}::${normalized.join(",")}`;
}

export function loadCart() {
  try {
    const raw = sessionStorage.getItem(CART_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data
      .map((line) => ({
        ...line,
        selectedOptionIds: Array.isArray(line?.selectedOptionIds) ? line.selectedOptionIds.map(Number).filter(Boolean) : [],
        selectedOptions: Array.isArray(line?.selectedOptions) ? line.selectedOptions : [],
      }))
      .filter((line) => line && line.id != null && line.lineKey);
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
