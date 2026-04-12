import { db } from "@workspace/db";
import { serviceInstancesTable, cloudServicesTable, providersTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import { contaboProvider, ContaboProvider } from "./providers/ContaboProvider";

type ProviderCode = "contabo";
const providers: Record<ProviderCode, ContaboProvider> = { contabo: contaboProvider };

function getProvider(code: string): ContaboProvider | null {
  return providers[code as ProviderCode] ?? null;
}

/** Shape of a joined row returned by all instance queries. */
type InstanceRow = {
  instance: InferSelectModel<typeof serviceInstancesTable>;
  service: InferSelectModel<typeof cloudServicesTable> | null;
  provider: InferSelectModel<typeof providersTable> | null;
};

function formatInstance(row: InstanceRow) {
  return {
    ...row.instance,
    cloudService: row.service
      ? {
          ...row.service,
          bandwidthTb: Number(row.service.bandwidthTb),
          priceMonthly: Number(row.service.priceMonthly),
        }
      : null,
    provider: row.provider ?? null,
  };
}

export class ServiceInstanceService {
  async listForUser(userId: string) {
    const rows = await db
      .select({
        instance: serviceInstancesTable,
        service: cloudServicesTable,
        provider: providersTable,
      })
      .from(serviceInstancesTable)
      .leftJoin(cloudServicesTable, eq(serviceInstancesTable.cloudServiceId, cloudServicesTable.id))
      .leftJoin(providersTable, eq(serviceInstancesTable.providerId, providersTable.id))
      .where(eq(serviceInstancesTable.userId, userId));

    return rows.map(formatInstance);
  }

  async getForUser(id: number, userId: string) {
    const [row] = await db
      .select({
        instance: serviceInstancesTable,
        service: cloudServicesTable,
        provider: providersTable,
      })
      .from(serviceInstancesTable)
      .leftJoin(cloudServicesTable, eq(serviceInstancesTable.cloudServiceId, cloudServicesTable.id))
      .leftJoin(providersTable, eq(serviceInstancesTable.providerId, providersTable.id))
      .where(and(eq(serviceInstancesTable.id, id), eq(serviceInstancesTable.userId, userId)));

    return row ? formatInstance(row) : null;
  }

  async listAll() {
    const rows = await db
      .select({
        instance: serviceInstancesTable,
        service: cloudServicesTable,
        provider: providersTable,
      })
      .from(serviceInstancesTable)
      .leftJoin(cloudServicesTable, eq(serviceInstancesTable.cloudServiceId, cloudServicesTable.id))
      .leftJoin(providersTable, eq(serviceInstancesTable.providerId, providersTable.id));

    return rows.map(formatInstance);
  }

  async getById(id: number) {
    const [row] = await db
      .select({
        instance: serviceInstancesTable,
        service: cloudServicesTable,
        provider: providersTable,
      })
      .from(serviceInstancesTable)
      .leftJoin(cloudServicesTable, eq(serviceInstancesTable.cloudServiceId, cloudServicesTable.id))
      .leftJoin(providersTable, eq(serviceInstancesTable.providerId, providersTable.id))
      .where(eq(serviceInstancesTable.id, id));

    return row ? formatInstance(row) : null;
  }

  async performAction(
    instanceId: number,
    action: "start" | "stop" | "reboot",
    userId: string,
    isAdmin = false
  ): Promise<{ success: boolean; message: string }> {
    const [row] = await db
      .select({ instance: serviceInstancesTable, provider: providersTable })
      .from(serviceInstancesTable)
      .leftJoin(providersTable, eq(serviceInstancesTable.providerId, providersTable.id))
      .where(eq(serviceInstancesTable.id, instanceId));

    if (!row) return { success: false, message: "Service instance not found" };
    if (!isAdmin && row.instance.userId !== userId) {
      return { success: false, message: "Service instance not found" };
    }

    const providerCode = row.provider?.code ?? "contabo";
    const provider = getProvider(providerCode);
    if (!provider) return { success: false, message: "Provider not found" };

    const externalId = row.instance.externalId ?? `mock-${instanceId}`;

    let result;
    switch (action) {
      case "start":
        result = await provider.startServer(externalId);
        break;
      case "stop":
        result = await provider.stopServer(externalId);
        break;
      case "reboot":
        result = await provider.restartServer(externalId);
        break;
      default:
        return { success: false, message: "Invalid action" };
    }

    if (result.success) {
      const runningStatusMap: Record<typeof action, string> = {
        start: "running",
        stop: "stopped",
        reboot: "running",
      };
      await db
        .update(serviceInstancesTable)
        .set({
          runningStatus: runningStatusMap[action],
          updatedAt: new Date(),
        })
        .where(eq(serviceInstancesTable.id, instanceId));
    }

    return { success: result.success, message: result.message };
  }
}

export const serviceInstanceService = new ServiceInstanceService();
