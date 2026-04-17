import { Router } from "express";
import { requireSuperAdmin } from "../../middlewares/requireRole";
import { db } from "@workspace/db";
import {
  providersTable,
  cloudServicesTable,
  subscriptionPlansTable,
  subscriptionPlanFeaturesTable,
} from "@workspace/db/schema";
import { eq, inArray } from "drizzle-orm";

const router = Router();

const PLAN_SEED = [
  {
    slug: "basic",
    name: "Basic",
    description: "Basic Cloudron access for small teams",
    sortOrder: 1,
    features: [
      { featureKey: "view_cloudron", enabled: true },
      { featureKey: "view_apps", enabled: true },
      { featureKey: "install_apps", enabled: false },
      { featureKey: "restart_apps", enabled: false },
      { featureKey: "uninstall_apps", enabled: false },
      { featureKey: "stop_apps", enabled: false },
      { featureKey: "start_apps", enabled: false },
      { featureKey: "view_app_store", enabled: false },
      { featureKey: "view_mail", enabled: true },
      { featureKey: "create_mailboxes", enabled: false },
      { featureKey: "edit_mailboxes", enabled: false },
      { featureKey: "delete_mailboxes", enabled: false },
      { featureKey: "max_apps", enabled: true, limitValue: 3 },
      { featureKey: "max_mailboxes", enabled: true, limitValue: 2 },
      { featureKey: "max_cloudron_instances", enabled: true, limitValue: 1 },
    ],
  },
  {
    slug: "pro",
    name: "Pro",
    description: "Full Cloudron access for growing teams",
    sortOrder: 2,
    features: [
      { featureKey: "view_cloudron", enabled: true },
      { featureKey: "view_apps", enabled: true },
      { featureKey: "install_apps", enabled: true },
      { featureKey: "restart_apps", enabled: true },
      { featureKey: "uninstall_apps", enabled: true },
      { featureKey: "stop_apps", enabled: true },
      { featureKey: "start_apps", enabled: true },
      { featureKey: "view_app_store", enabled: true },
      { featureKey: "view_mail", enabled: true },
      { featureKey: "create_mailboxes", enabled: true },
      { featureKey: "edit_mailboxes", enabled: true },
      { featureKey: "delete_mailboxes", enabled: false },
      { featureKey: "max_apps", enabled: true, limitValue: 10 },
      { featureKey: "max_mailboxes", enabled: true, limitValue: 10 },
      { featureKey: "max_cloudron_instances", enabled: true, limitValue: 1 },
    ],
  },
  {
    slug: "enterprise",
    name: "Enterprise",
    description: "Unlimited Cloudron access for large organizations",
    sortOrder: 3,
    features: [
      { featureKey: "view_cloudron", enabled: true },
      { featureKey: "view_apps", enabled: true },
      { featureKey: "install_apps", enabled: true },
      { featureKey: "restart_apps", enabled: true },
      { featureKey: "uninstall_apps", enabled: true },
      { featureKey: "stop_apps", enabled: true },
      { featureKey: "start_apps", enabled: true },
      { featureKey: "view_app_store", enabled: true },
      { featureKey: "view_mail", enabled: true },
      { featureKey: "create_mailboxes", enabled: true },
      { featureKey: "edit_mailboxes", enabled: true },
      { featureKey: "delete_mailboxes", enabled: true },
      { featureKey: "max_apps", enabled: false },
      { featureKey: "max_mailboxes", enabled: false },
      { featureKey: "max_cloudron_instances", enabled: true, limitValue: 5 },
    ],
  },
];

router.post("/seed", requireSuperAdmin, async (_req, res) => {
  try {
    const [existingProvider] = await db.select().from(providersTable).where(eq(providersTable.code, "contabo"));
    if (!existingProvider) {
      await db.insert(providersTable).values({ name: "Contabo", code: "contabo", active: true });
    }

    const existingVpsStarter = await db
      .select({ id: cloudServicesTable.id })
      .from(cloudServicesTable)
      .where(eq(cloudServicesTable.name, "VPS Starter"));

    if (existingVpsStarter.length === 0) {
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
    }

    for (const planDef of PLAN_SEED) {
      const existing = await db
        .select({ id: subscriptionPlansTable.id })
        .from(subscriptionPlansTable)
        .where(eq(subscriptionPlansTable.slug, planDef.slug));

      let planId: number;
      if (existing.length > 0) {
        planId = existing[0].id;
      } else {
        const [inserted] = await db
          .insert(subscriptionPlansTable)
          .values({
            name: planDef.name,
            slug: planDef.slug,
            description: planDef.description,
            isActive: true,
            sortOrder: planDef.sortOrder,
            updatedAt: new Date(),
          })
          .returning({ id: subscriptionPlansTable.id });
        planId = inserted.id;
      }

      const existingFeatureKeys = await db
        .select({ featureKey: subscriptionPlanFeaturesTable.featureKey })
        .from(subscriptionPlanFeaturesTable)
        .where(eq(subscriptionPlanFeaturesTable.planId, planId));

      const existingKeys = new Set(existingFeatureKeys.map((f) => f.featureKey));

      const toInsert = planDef.features.filter((f) => !existingKeys.has(f.featureKey));
      if (toInsert.length > 0) {
        await db.insert(subscriptionPlanFeaturesTable).values(
          toInsert.map((f) => ({
            planId,
            featureKey: f.featureKey,
            enabled: f.enabled,
            limitValue: f.limitValue ?? null,
          }))
        );
      }
    }

    res.json({ success: true, message: "Seed data applied (providers + VPS Starter/Pro + subscription plans)" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to seed data" });
  }
});

export default router;
