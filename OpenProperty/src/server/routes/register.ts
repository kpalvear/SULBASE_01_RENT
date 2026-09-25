import { mountAuthRoutes } from "./auth";
import { mountPropertiesRoutes } from "./properties";
import { mountUnitsRoutes } from "./units";
import { mountTenantsRoutes } from "./tenants";
import { mountLeasesRoutes } from "./leases";
import { mountRentRoutes } from "./rent";
import { mountVendorsRoutes } from "./vendors";
import { mountWorkOrdersRoutes } from "./work-orders";
import { mountApplicationsRoutes } from "./applications";
import { mountDashboardRoutes } from "./dashboard";
import { mountSettingsRoutes } from "./settings";

import type { Hono } from "hono";
import type { AppEnv } from "../env";

export function registerApiRoutes(app: Hono<AppEnv>) {
  mountAuthRoutes(app);
  mountPropertiesRoutes(app);
  mountUnitsRoutes(app);
  mountTenantsRoutes(app);
  mountLeasesRoutes(app);
  mountRentRoutes(app);
  mountVendorsRoutes(app);
  mountWorkOrdersRoutes(app);
  mountApplicationsRoutes(app);
  mountDashboardRoutes(app);
  mountSettingsRoutes(app);
}
