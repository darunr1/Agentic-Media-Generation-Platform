import { loadEnv } from "@contentforge/shared";
import {
  generationHandlers,
  mediaHandlers,
  publishingHandlers,
  startQueueService,
} from "@contentforge/workflows";
loadEnv();
startQueueService("worker", Number(process.env.WORKER_PORT ?? 3001), {
  ...generationHandlers,
  ...mediaHandlers,
  ...publishingHandlers,
});
