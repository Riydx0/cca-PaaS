import { randomBytes } from "crypto";
import { logger } from "./lib/logger";
import { db, pool } from "@workspace/db";
import { settingsTable, providersTable, cloudServicesTable } from "@workspace/db/schema";
import { eq, ilike } from "drizzle-orm";

async function ensureSessionTable(): Promise<void> {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "user_sessions" (
        "sid" varchar NOT NULL,
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL,
        PRIMARY KEY ("sid")
      )
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "user_sessions" ("expire")
    `);
  } catch (err: any) {
    logger.warn({ err: err?.message }, "Could not ensure user_sessions table exists");
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

async function ensureDefaultSeedData(): Promise<void> {
  try {
    const [existingProvider] = await db
      .select({ id: providersTable.id })
      .from(providersTable)
      .where(eq(providersTable.code, "contabo"))
      .limit(1);

    if (!existingProvider) {
      await db.insert(providersTable).values({ name: "Contabo", code: "contabo", active: true });
      logger.info("Seeded default provider: Contabo");
    }

    const [existingVps] = await db
      .select({ id: cloudServicesTable.id })
      .from(cloudServicesTable)
      .where(ilike(cloudServicesTable.name, "VPS Starter"))
      .limit(1);

    if (!existingVps) {
      await db.insert(cloudServicesTable).values([
        {
          serviceType: "server",
          provider: "Contabo",
          name: "VPS Starter",
          cpu: 2,
          ramGb: 4,
          storageGb: 100,
          storageType: "SSD",
          bandwidthTb: "2.00",
          priceMonthly: "4.99",
          region: "EU Germany",
          isActive: true,
        },
        {
          serviceType: "server",
          provider: "Contabo",
          name: "VPS Pro",
          cpu: 4,
          ramGb: 8,
          storageGb: 200,
          storageType: "NVMe",
          bandwidthTb: "4.00",
          priceMonthly: "8.99",
          region: "EU Germany",
          isActive: true,
        },
      ]);
      logger.info("Seeded default VPS plans: VPS Starter, VPS Pro");
    }
  } catch (err: any) {
    logger.warn({ err: err?.message }, "Could not seed default data (non-fatal)");
  }
}

await ensureSessionTable();
await ensureSetupToken();
await ensureDefaultSeedData();

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
