import { Router } from "express";
import dashboardRouter from "./dashboard";
import usersRouter from "./users";
import ordersRouter from "./orders";
import servicesRouter from "./services";
import systemRouter from "./system";
import billingRouter from "./billing";
import settingsRouter from "./settings";
import plansRouter from "./plans";
import subscriptionsRouter from "./subscriptions";
import providersRouter from "./providers";
import seedRouter from "./seed";
import serviceInstancesRouter from "./service-instances";
import cloudronAccessRouter from "./cloudron-access";
import cloudronAdminRouter from "./cloudron";

const router = Router();

router.use("/dashboard", dashboardRouter);
router.use("/users", usersRouter);
router.use("/users/:userId/cloudron-access", cloudronAccessRouter);
router.use("/orders", ordersRouter);
router.use("/services", servicesRouter);
router.use("/system", systemRouter);
router.use("/plans", plansRouter);
router.use("/subscriptions", subscriptionsRouter);
router.use("/providers", providersRouter);
router.use("/service-instances", serviceInstancesRouter);
router.use("/cloudron", cloudronAdminRouter);
router.use("/", seedRouter);
router.use("/", settingsRouter);
router.use("/", billingRouter);

export default router;
