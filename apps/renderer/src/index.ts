import { loadEnv } from "@contentforge/shared";
import { renderHandlers, startQueueService } from "@contentforge/workflows";
loadEnv();
startQueueService("renderer", Number(process.env.RENDERER_PORT ?? 3002), { ...renderHandlers });
