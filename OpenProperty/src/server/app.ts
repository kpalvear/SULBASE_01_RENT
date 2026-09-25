import { factory } from "./factory";
import { authMiddleware, dbMiddleware } from "./middleware";
import { mountHealthRoutes } from "./routes/health";
import { registerApiRoutes } from "./routes/register";

const app = factory.createApp();

app.use("*", dbMiddleware);
app.use("*", authMiddleware);
registerApiRoutes(app);
mountHealthRoutes(app);

export type AppType = typeof app;
export default app;
