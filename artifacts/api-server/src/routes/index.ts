import { Router, type IRouter } from "express";
import healthRouter from "./health";
import servicesRouter from "./services";
import ordersRouter from "./orders";
import statsRouter from "./stats";
import adminRouter from "./admin/index";

const router: IRouter = Router();

router.use(healthRouter);
// configRouter and setupRouter are mounted in app.ts before clerkMiddleware()
// so they remain reachable on first boot with no Clerk secret key configured.
router.use("/services", servicesRouter);
router.use("/orders", ordersRouter);
router.use("/stats", statsRouter);
router.use("/admin", adminRouter);

export default router;
