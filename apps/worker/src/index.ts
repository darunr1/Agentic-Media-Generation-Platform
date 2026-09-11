import { createServer } from "node:http";

import { createLogger } from "@contentforge/shared";
import { LocalTaskQueueProvider, retryDelayMs } from "@contentforge/workflows";

const logger = createLogger({ name: "worker" });
const queue = new LocalTaskQueueProvider();
let draining = false;
async function drain() {
  if (draining) return;
  draining = true;
  try {
    for (let task = await queue.reserve(); task; task = await queue.reserve()) {
      if (task.attempt >= task.maxAttempts) {
        await queue.deadLetter(task.id, "Maximum attempts exceeded");
        continue;
      }
      try {
        logger.info({ taskId: task.id, type: task.type, attempt: task.attempt }, "Processing task");
        await queue.acknowledge(task.id);
      } catch (error) {
        const next = new Date(Date.now() + retryDelayMs(task.attempt));
        logger.warn({ taskId: task.id, err: error, next }, "Task will retry");
        await queue.retry(task.id, next);
      }
    }
  } finally {
    draining = false;
  }
}
const port = Number(process.env.WORKER_PORT ?? 3001);
const server = createServer(async (req, res) => {
  const healthy = await queue.healthCheck();
  res.setHeader("content-type", "application/json");
  if (req.url === "/healthz") {
    res.end(JSON.stringify({ status: "ok", service: "worker" }));
    return;
  }
  if (req.url === "/readyz") {
    res.statusCode = healthy ? 200 : 503;
    res.end(JSON.stringify({ ready: healthy }));
    return;
  }
  res.statusCode = 404;
  res.end(JSON.stringify({ error: "not_found" }));
});
server.listen(port, "0.0.0.0", () => logger.info({ port }, "Worker health server started"));
const timer = setInterval(() => void drain(), 1000);
timer.unref();
process.on("SIGTERM", () => server.close(() => process.exit(0)));
