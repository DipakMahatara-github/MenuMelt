// Public entry is ngrok → Vite only. Leave VITE_API_BASE empty so the browser
// calls same-origin /api and /media; Vite proxies those to Django (vite.config.js).
export const API_BASE = import.meta.env.VITE_API_BASE ?? "";
