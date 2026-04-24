import { defineConfig } from "eslint/config";

export default defineConfig(
  {
    ignores: [".expo/**", "expo-plugins/**", "dist/**", "node_modules/**"],
  },
);
