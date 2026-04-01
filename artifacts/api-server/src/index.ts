import { randomBytes } from "crypto";
import { logger } from "./lib/logger";
import { db } from "@workspace/db";
import { settingsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

async function loadSettingsFromDb(): Promise<void> {
  try {
    const rows = await db
      .select()
      .from(settingsTable)
      .where(eq(settingsTable.key, "CLERK_SECRET_KEY"));

    if (rows.length > 0 && rows[0].value) {
      process.env["CLERK_SECRET_KEY"] = rows[0].value;
      logger.info("Loaded CLERK_SECRET_KEY from database settings");
    } else {
      logger.warn(
        "CLERK_SECRET_KEY not in database — setup wizard not yet completed",
      );
    }
  } catch {
    logger.warn(
      "Could not query settings table (first run or table not yet created)",
    );
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

// Load CLERK_SECRET_KEY from DB BEFORE app.ts is evaluated.
// Static ESM imports are hoisted and evaluated immediately, so we use a
// top-level await here to ensure process.env is set before clerkMiddleware()
// in app.ts has a chance to read it.
await loadSettingsFromDb();
await ensureSetupToken();

// Dynamic import defers app.ts evaluation until after the await above.
// This guarantees clerkMiddleware() initializes with the DB-loaded key.
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
