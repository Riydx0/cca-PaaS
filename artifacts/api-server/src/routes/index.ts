import { Router, type IRouter } from "express";
import healthRouter from "./health";
import servicesRouter from "./services";
import ordersRouter from "./orders";
import statsRouter from "./stats";
import adminRouter from "./admin/index";
import configRouter from "./config";
import setupRouter from "./setup";

const router: IRouter = Router();

router.use(healthRouter);
router.use(configRouter);
router.use(setupRouter);
router.use("/services", servicesRouter);
router.use("/orders", ordersRouter);
router.use("/stats", statsRouter);
router.use("/admin", adminRouter);

export default router;
