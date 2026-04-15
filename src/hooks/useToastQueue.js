import { useCallback, useEffect, useState } from "react";

export function useToastQueue(duration = 3200) {
  const [toasts, setToasts] = useState([]);

  const pushToast = useCallback((tone, text) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((current) => [...current, { id, tone, text }]);
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  useEffect(() => {
    if (!toasts.length) return undefined;
    const nextToastId = toasts[0].id;
    const timer = window.setTimeout(() => {
      removeToast(nextToastId);
    }, duration);
    return () => window.clearTimeout(timer);
  }, [duration, removeToast, toasts]);

  return {
    toasts,
    pushToast,
    removeToast,
  };
}
