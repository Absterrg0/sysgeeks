import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTypescript,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  globalIgnores([".next/**", ".open-next/**", ".wrangler/**", "cloudflare-env.d.ts", "videos/**", ".agents/**", ".claude/**", "out/**", "build/**", "next-env.d.ts", "docs/**"]),
]);

export default eslintConfig;
