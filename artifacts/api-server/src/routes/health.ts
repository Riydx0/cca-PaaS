import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

/**
 * GET /api/healthz
 * Basic liveness check. Also surfaces Cloudron configuration state so
 * operators can verify the integration is wired up without needing to log in.
 *
 * Cloudron connectivity (live API reachability) is tested via:
 *   GET /api/cloudron/test  — requires admin authentication
 */
router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });

  const cloudronEnabled = process.env.CLOUDRON_ENABLED === "true";
  const cloudronConfigured =
    cloudronEnabled &&
    Boolean(process.env.CLOUDRON_BASE_URL) &&
    Boolean(process.env.CLOUDRON_API_TOKEN);

  res.json({
    ...data,
    cloudron: {
      enabled: cloudronEnabled,
      configured: cloudronConfigured,
      testEndpoint: "/api/cloudron/test",
    },
  });
});

export default router;
