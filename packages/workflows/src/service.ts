import { createServer } from "node:http";

import { prisma } from "@contentforge/database";
import { createLogger } from "@contentforge/shared";

import { executeNextTask, type TaskRegistry } from "./executor";
import { PostgresTaskQueueProvider } from "./postgres-queue";
import { recordTaskFailure } from "./runtime";

export function startQueueService(name: string, port: number, registry: TaskRegistry) {
  if (!["postgres", "local"].includes(process.env.QUEUE_PROVIDER ?? "postgres"))
    throw new Error("Queue provider setup required; configure postgres");
  const logger = createLogger({ name }),
    queue = new PostgresTaskQueueProvider();
  const controller = new AbortController();
  let stopping = false,
    active: Promise<void> | undefined;
  const server = createServer((req, res) => {
    res.setHeader("content-type", "application/json");
    if (req.url === "/healthz") {
      res.end(JSON.stringify({ status: "ok", service: name }));
      return;
    }
    if (req.url === "/readyz") {
      void queue.healthCheck().then((healthy) => {
        res.statusCode = healthy && !stopping ? 200 : 503;
        res.end(JSON.stringify({ ready: healthy && !stopping }));
      });
      return;
    }
    res.statusCode = 404;
    res.end(JSON.stringify({ error: "not_found" }));
  });
  const drain = async () => {
    try {
      while (
        !stopping &&
        (await executeNextTask(queue, registry, {
          signal: controller.signal,
          onFailure: recordTaskFailure,
        }))
      ) {
        /* One task at a time per process. */
      }
    } catch (error) {
      logger.error({ service: name, err: error }, "Queue polling failed; will retry");
    }
  };
  const timer = setInterval(() => {
    if (!active && !stopping)
      active = drain().finally(() => {
        active = undefined;
      });
  }, 1000);
  server.listen(port, "0.0.0.0", () => logger.info({ port }, "Queue service started"));
  const stop = () => {
    if (stopping) return;
    stopping = true;
    clearInterval(timer);
    server.close();
    const deadline = setTimeout(() => controller.abort(), 25_000);
    void (active ?? Promise.resolve()).finally(async () => {
      clearTimeout(deadline);
      await prisma.$disconnect();
      logger.info("Queue service stopped");
    });
  };
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
  return { stop, server };
}
