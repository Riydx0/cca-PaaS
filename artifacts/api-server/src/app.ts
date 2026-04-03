import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "@workspace/db";
import router from "./routes";
import configRouter from "./routes/config";
import setupRouter from "./routes/setup";
import authRouter from "./routes/auth";
import { logger } from "./lib/logger";

const PgSession = connectPg(session);

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.set("trust proxy", 1);
app.use(cors({ credentials: true, origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const sessionSecret = process.env["SESSION_SECRET"];
if (!sessionSecret) {
  logger.warn("SESSION_SECRET not set — using fallback. Set SESSION_SECRET in production.");
}

app.use(
  session({
    name: "ccapaas.sid",
    store: new PgSession({
      pool,
      tableName: "user_sessions",
      createTableIfMissing: true,
    }),
    secret: sessionSecret ?? "changeme-set-SESSION_SECRET-in-env",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env["COOKIE_SECURE"] === "true",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  }),
);

app.use("/api", configRouter);
app.use("/api", setupRouter);
app.use("/api", authRouter);

app.use("/api", router);

export default app;
