import type { ExecutionContext, ScheduledController } from "@cloudflare/workers-types";
import app from "./app";
import type { WorkerBindings } from "./env";
import { runScheduledAlerts } from "./notifications/run-scheduled";
import { handlePublicRequest } from "./public/handle";

export type { AppType } from "./app";

export default {
  async fetch(request: Request, env: WorkerBindings, ctx: ExecutionContext): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path === "/api" || path.startsWith("/api/")) {
      return app.fetch(request, env, ctx);
    }
    return handlePublicRequest(request, env);
  },
  async scheduled(
    _controller: ScheduledController,
    env: WorkerBindings,
    _ctx: ExecutionContext,
  ): Promise<void> {
    await runScheduledAlerts(env);
  },
};
