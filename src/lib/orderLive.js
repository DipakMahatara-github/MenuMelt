import { API_BASE } from "../config";
import { getAccessToken } from "./auth";
import { getCustomerSessionId } from "./customerSession";

export const SERVICE_STATUS_FLOW = ["pending", "preparing", "ready", "served"];

export const SERVICE_STATUS_LABELS = {
  pending: "Pending",
  preparing: "Preparing",
  ready: "Ready",
  served: "Served",
};

function getSocketBaseUrl() {
  const base = API_BASE ? new URL(API_BASE, window.location.origin) : new URL(window.location.origin);
  const protocol = base.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${base.host}`;
}

export function upsertOrder(list, order) {
  if (!order?.id) return list;
  const next = [order, ...list.filter((item) => item.id !== order.id)];
  next.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  return next;
}

export function subscribeToOrderStream({ audience, onEvent, onStateChange }) {
  const buildSearch = () => {
    const params = new URLSearchParams();
    if (audience === "staff") {
      const accessToken = getAccessToken();
      if (!accessToken) return null;
      params.set("access_token", accessToken);
      return params.toString();
    }
    if (audience === "customer") {
      const tableToken = sessionStorage.getItem("table_token");
      const sessionId = getCustomerSessionId();
      if (!tableToken || !sessionId) return null;
      params.set("table_token", tableToken);
      params.set("session_id", sessionId);
      return params.toString();
    }
    return null;
  };

  if (!buildSearch()) return () => {};

  let socket = null;
  let reconnectTimer = null;
  let closed = false;
  let reconnectDelay = 1200;

  const connect = () => {
    if (closed) return;
    onStateChange?.("connecting");

    const url = new URL("/ws/orders/stream/", getSocketBaseUrl());
    const search = buildSearch();
    if (!search) {
      onStateChange?.("error");
      return;
    }
    url.search = search;
    socket = new WebSocket(url.toString());

    socket.onopen = () => {
      reconnectDelay = 1200;
      onStateChange?.("connected");
    };

    socket.onmessage = (message) => {
      try {
        const payload = JSON.parse(message.data);
        if (payload?.type === "connection.ready") {
          onStateChange?.("connected");
          return;
        }
        if (payload?.type === "pong") return;
        onEvent?.(payload);
      } catch (error) {
        console.error("Could not parse order socket message.", error);
      }
    };

    socket.onerror = () => {
      onStateChange?.("error");
    };

    socket.onclose = () => {
      socket = null;
      if (closed) return;
      onStateChange?.("reconnecting");
      reconnectTimer = window.setTimeout(connect, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 1.6, 8000);
    };
  };

  connect();

  return () => {
    closed = true;
    if (reconnectTimer) {
      window.clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (socket && socket.readyState < WebSocket.CLOSING) {
      socket.close();
    }
  };
}
