import { baseConfig } from "@contentforge/config/eslint";

export default [
  ...baseConfig,
  { ignores: ["dist/**", "src/generated/**"] },
  {
    // CLI scripts where stdout progress messages are the intended UX, not
    // stray debug logging.
    files: ["prisma/seed.ts", "scripts/**/*.ts"],
    rules: { "no-console": "off" },
  },
];
