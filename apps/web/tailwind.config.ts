import type { Config } from "tailwindcss";

import sharedPreset from "@contentforge/config/tailwind";

const config: Config = {
  darkMode: "class",
  presets: [sharedPreset],
  content: ["./src/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"],
};

export default config;
