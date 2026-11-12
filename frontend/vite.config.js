import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev proxy keeps the browser talking to one origin; no secrets live here.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { "/api": "http://localhost:8000" },
  },
});
