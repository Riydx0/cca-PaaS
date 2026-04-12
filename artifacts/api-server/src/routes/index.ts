import { Router, type IRouter } from "express";
import healthRouter from "./health";
import catalogRouter from "./catalog";
import servicesRouter from "./services";
import myServicesRouter from "./my-services";
import ordersRouter from "./orders";
import statsRouter from "./stats";
import adminRouter from "./admin/index";
import billingRouter from "./billing";
import pricingRouter from "./pricing";
import subscriptionRouter from "./subscription";

const router: IRouter = Router();

router.use(healthRouter);

// Public service catalog (cloud_services table)
router.use("/catalog", catalogRouter);

// User service instances — primary endpoint (service_instances table)
router.use("/services", servicesRouter);

// Deprecated alias — kept for backward compatibility, remove after migration
router.use("/my-services", myServicesRouter);

router.use("/orders", ordersRouter);
router.use("/stats", statsRouter);
router.use("/billing", billingRouter);
router.use("/pricing", pricingRouter);
router.use("/subscription", subscriptionRouter);
router.use("/admin", adminRouter);

export default router;
