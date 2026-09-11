import { resolve } from "node:path";

import { renderGradientVideo } from "@contentforge/media";
const output = resolve(
  process.env.LOCAL_STORAGE_DIR ?? resolve(import.meta.dirname, "../../../.local-storage"),
  "demo",
  "contentforge-demo.mp4",
);
const result = await renderGradientVideo({
  outputPath: output,
  width: 720,
  height: 1280,
  durationSeconds: 18,
  title: "Taste coffee better",
  subtitle: "Aroma · acidity · finish",
  primaryColor: "#111827",
  accentColor: "#7C3AED",
});
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
