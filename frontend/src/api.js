import axios from "axios";

export const TOKEN_KEY = "studytrack_token";

function resolveApiBaseUrl() {
  const raw = import.meta.env.VITE_API_URL?.trim();
  if (!raw) return "/api";
  const clean = raw.replace(/\/+$/, "");
  return clean.endsWith("/api") ? clean : `${clean}/api`;
}

const api = axios.create({
  baseURL: resolveApiBaseUrl()
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
