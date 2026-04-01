import { Router, type IRouter } from "express";
import healthRouter from "./health";
import servicesRouter from "./services";
import ordersRouter from "./orders";
import statsRouter from "./stats";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/services", servicesRouter);
router.use("/orders", ordersRouter);
router.use("/stats", statsRouter);

export default router;
