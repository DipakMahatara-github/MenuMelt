/** Turn DRF error payloads into a single readable string. */
export function formatApiError(data) {
  if (data == null || typeof data !== "object") {
    return "Something went wrong. Please try again.";
  }
  if (typeof data.error === "string" && data.error.trim()) {
    return data.error.trim();
  }
  const d = data.detail;
  if (typeof d === "string" && d.trim()) {
    return d.trim();
  }
  if (Array.isArray(d)) {
    return d.map((x) => String(x)).join(" ");
  }
  if (d && typeof d === "object") {
    const parts = [];
    for (const v of Object.values(d)) {
      if (Array.isArray(v)) {
        parts.push(...v.map((x) => String(x)));
      } else if (v != null) {
        parts.push(String(v));
      }
    }
    if (parts.length) return parts.join(" ");
  }
  return "Could not complete the request. Please try again.";
}
