import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

import { expect, it } from "vitest";

const require = createRequire(import.meta.url);

it.each([0, 1])("preserves test exit code %i despite the database shutdown hook", (code) => {
  const setupUrl = new URL("./global-setup.ts", import.meta.url).href;
  const child = spawnSync(
    process.execPath,
    [
      "--import",
      require.resolve("tsx"),
      "--input-type=module",
      "-e",
      `import ${JSON.stringify(setupUrl)}; process.exitCode = ${code};`,
    ],
    { encoding: "utf8", timeout: 10_000 },
  );
  expect(child.error).toBeUndefined();
  expect(child.stderr).toBe("");
  expect(child.status).toBe(code);
});
