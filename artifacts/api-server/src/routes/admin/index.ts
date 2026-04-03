import { Router } from "express";
import dashboardRouter from "./dashboard";
import usersRouter from "./users";
import ordersRouter from "./orders";
import servicesRouter from "./services";
import systemRouter from "./system";

const router = Router();

router.use("/dashboard", dashboardRouter);
router.use("/users", usersRouter);
router.use("/orders", ordersRouter);
router.use("/services", servicesRouter);
router.use("/system", systemRouter);

export default router;
