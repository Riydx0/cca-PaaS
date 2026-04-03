import { randomBytes } from "crypto";
import { logger } from "./lib/logger";
import { db, pool } from "@workspace/db";
import { settingsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

async function ensureSessionTable(): Promise<void> {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "user_sessions" (
        "sid" varchar NOT NULL COLLATE "default",
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL,
        CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE
      ) WITH (OIDS=FALSE);
      CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "user_sessions" ("expire");
    `);
  } catch {
    logger.warn("Could not ensure user_sessions table exists");
  }
}

async function ensureSetupToken(): Promise<void> {
  try {
    const rows = await db
      .select()
      .from(settingsTable)
      .where(eq(settingsTable.key, "SETUP_COMPLETE"));

    const setupComplete = rows.length > 0 && rows[0].value === "true";
    if (setupComplete) return;

    const tokenRows = await db
      .select()
      .from(settingsTable)
      .where(eq(settingsTable.key, "SETUP_TOKEN"));

    let token: string;
    if (tokenRows.length > 0 && tokenRows[0].value) {
      token = tokenRows[0].value;
    } else {
      token = randomBytes(16).toString("hex");
      await db
        .insert(settingsTable)
        .values({ key: "SETUP_TOKEN", value: token })
        .onConflictDoUpdate({
          target: settingsTable.key,
          set: { value: token },
        });
    }

    logger.info("=".repeat(60));
    logger.info("cca-PaaS FIRST-RUN SETUP");
    logger.info("Open your browser and navigate to: /setup");
    logger.info(`Setup Token: ${token}`);
    logger.info("Keep this token — you will need it to complete setup.");
    logger.info("=".repeat(60));
  } catch {
    logger.warn("Could not generate/load setup token");
  }
}

await ensureSessionTable();
await ensureSetupToken();

const { default: app } = await import("./app.js");

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
