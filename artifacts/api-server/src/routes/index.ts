import { Router, type IRouter } from "express";
import healthRouter from "./health";
import servicesRouter from "./services";
import ordersRouter from "./orders";
import statsRouter from "./stats";
import adminRouter from "./admin/index";
import billingRouter from "./billing";
import pricingRouter from "./pricing";
import subscriptionRouter from "./subscription";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/services", servicesRouter);
router.use("/orders", ordersRouter);
router.use("/stats", statsRouter);
router.use("/billing", billingRouter);
router.use("/pricing", pricingRouter);
router.use("/subscription", subscriptionRouter);
router.use("/admin", adminRouter);

export default router;
