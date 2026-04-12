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

const router = Router();

router.use("/dashboard", dashboardRouter);
router.use("/users", usersRouter);
router.use("/orders", ordersRouter);
router.use("/services", servicesRouter);
router.use("/system", systemRouter);
router.use("/plans", plansRouter);
router.use("/subscriptions", subscriptionsRouter);
router.use("/", settingsRouter);
router.use("/", billingRouter);

export default router;
