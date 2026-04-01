import { logger } from "./lib/logger";
import { db } from "@workspace/db";
import { settingsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import app from "./app";

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

await loadSettingsFromDb();

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
