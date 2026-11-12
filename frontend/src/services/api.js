
// All backend calls live here so components never build URLs themselves.
import { parseSSE } from "../utils/sse";

const UNREACHABLE = "Cannot reach the server. Is the backend running?";
const TOKEN_KEY = "chatsphere_access_token";

const API_BASE_URL = (
  import.meta.env.VITE_API_URL || ""
).replace(/\/$/, "");

// Authentication helpers
export const getStoredToken = () => sessionStorage.getItem(TOKEN_KEY);

export const setAuthToken = (token) => {
  sessionStorage.setItem(TOKEN_KEY, token);
};

export const clearAuthToken = () => {
  sessionStorage.removeItem(TOKEN_KEY);
};

function getHeaders(body, auth = true) {
  const headers = {};

  if (body) {
    headers["Content-Type"] = "application/json";
  }

  const token = auth ? getStoredToken() : null;

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

async function errorMessage(res) {
  try {
    const body = await res.json();
    if (typeof body.detail === "string") return body.detail;
    if (Array.isArray(body.detail)) return "That input isn't valid.";
  } catch {
    // fall through to the generic message
  }
  return `Request failed (${res.status}).`;
}

async function request(path, { method = "GET", body, auth = true } = {}) {
  let res;

  try {
    res = await fetch(`${API_BASE_URL}/api${path}`, {
      method,
      headers: getHeaders(body, auth),
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error(UNREACHABLE);
  }

  if (!res.ok) {
    if (res.status === 401 && auth) clearAuthToken();
    throw new Error(await errorMessage(res));
  }

  return res.status === 204 ? null : res.json();
}

// Authentication API
export const login = async (email, password) => {
  const data = await request("/auth/login", {
    method: "POST",
    body: { email, password },
    auth: false,
  });

  setAuthToken(data.access_token);
  return data;
};

export const register = async (username, email, password) => {
  const data = await request("/auth/register", {
    method: "POST",
    body: { username, email, password },
    auth: false,
  });

  setAuthToken(data.access_token);
  return data;
};

// POSTs and reads a Server-Sent Events stream.
async function streamSSE(
  path,
  body,
  { signal, onMeta, onToken, onDone, onError }
) {
  let res;

  try {
    res = await fetch(`${API_BASE_URL}/api${path}`, {
      method: "POST",
      headers: getHeaders(body),
      body: JSON.stringify(body ?? {}),
      signal,
    });
  } catch (err) {
    if (err.name === "AbortError") throw err;
    throw new Error(UNREACHABLE);
  }

  if (!res.ok) {
    if (res.status === 401) clearAuthToken();
    throw new Error(await errorMessage(res));
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const parsed = parseSSE(buffer);
      buffer = parsed.rest;

      for (const { event, data } of parsed.events) {
        if (event === "meta") onMeta?.(data);
        else if (event === "token") onToken?.(data.text);
        else if (event === "done") onDone?.(data);
        else if (event === "error") onError?.(data);
      }
    }
  } catch (err) {
    if (err.name === "AbortError") throw err;
    throw new Error("The connection was interrupted.");
  }
}

// Health
export const getHealth = () => request("/health", { auth: false });

// Conversations
export const listConversations = () => request("/conversations");
export const createConversation = () =>
  request("/conversations", { method: "POST" });
export const getConversation = (id) => request(`/conversations/${id}`);
export const renameConversation = (id, title) =>
  request(`/conversations/${id}`, { method: "PATCH", body: { title } });
export const deleteConversation = (id) =>
  request(`/conversations/${id}`, { method: "DELETE" });

// Chat
export const streamMessage = (id, content, handlers) =>
  streamSSE(`/conversations/${id}/stream`, { content }, handlers);

export const streamRegenerate = (id, handlers) =>
  streamSSE(`/conversations/${id}/regenerate`, {}, handlers);

// Memories
export const listMemories = () => request("/memories");
export const createMemory = (content, category) =>
  request("/memories", { method: "POST", body: { content, category } });
export const updateMemory = (id, patch) =>
  request(`/memories/${id}`, { method: "PATCH", body: patch });
export const deleteMemory = (id) =>
  request(`/memories/${id}`, { method: "DELETE" });
export const clearMemories = () =>
  request("/memories", { method: "DELETE" });

// Settings
export const getSettings = () => request("/settings");
export const updateSettings = (patch) =>
  request("/settings", { method: "PATCH", body: patch });