import { defineConfig, globalIgnores } from "eslint/config";
import { FlatCompat } from "@eslint/eslintrc";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

export default defineConfig([
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Existing modules pre-date the ESLint 9 migration. Keep their debt
      // visible while allowing lint to operate as a repeatable quality gate.
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-require-imports": "warn",
      "@next/next/no-assign-module-variable": "warn",
      "react/no-unescaped-entities": "warn"
    }
  },
  globalIgnores([".next/**", "node_modules/**", "output/**", "outputs/**", "tmp/**", "supabase/.temp/**", "next-env.d.ts"])
]);
