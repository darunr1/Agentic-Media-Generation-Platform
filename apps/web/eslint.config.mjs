import { FlatCompat } from "@eslint/eslintrc";
import prettierConfig from "eslint-config-prettier";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

// eslint-config-next already bundles the react/react-hooks/import/jsx-a11y
// plugins with Next-specific tuning. Layering packages/config's hand-rolled
// `baseConfig` on top would re-register several of those same plugins under
// the same names and ESLint's flat config throws on that
// ("Cannot redefine plugin '<name>'"), so apps/web relies on Next's own
// bundle (core-web-vitals + typescript) instead of the shared base.
const config = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  prettierConfig,
  {
    rules: {
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
  { ignores: [".next/**", "next-env.d.ts", "playwright-report/**", "test-results/**"] },
];
export default config;
