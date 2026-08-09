import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Standard Vite + React config. Nothing custom here.
export default defineConfig({
  plugins: [react()],
});
