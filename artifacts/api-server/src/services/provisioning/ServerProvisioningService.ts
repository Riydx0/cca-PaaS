import { db } from "@workspace/db";
import { serverOrdersTable, providersTable, serviceInstancesTable, cloudServicesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { contaboProvider, ContaboProvider } from "../providers/ContaboProvider";

type ProviderCode = "contabo";

const providers: Record<ProviderCode, ContaboProvider> = {
  contabo: contaboProvider,
};

function getProvider(code: string): ContaboProvider | null {
  return providers[code as ProviderCode] ?? null;
}

export class ServerProvisioningService {
  async provision(orderId: number): Promise<void> {
    const [orderRow] = await db
      .select({
        order: serverOrdersTable,
        provider: providersTable,
        service: cloudServicesTable,
      })
      .from(serverOrdersTable)
      .leftJoin(providersTable, eq(serverOrdersTable.providerId, providersTable.id))
      .leftJoin(cloudServicesTable, eq(serverOrdersTable.cloudServiceId, cloudServicesTable.id))
      .where(eq(serverOrdersTable.id, orderId));

    if (!orderRow) {
      console.error(`[ServerProvisioningService] Order ${orderId} not found`);
      return;
    }

    const providerCode = orderRow.provider?.code ?? "contabo";
    const provider = getProvider(providerCode);

    if (!provider) {
      console.error(`[ServerProvisioningService] Unknown provider: ${providerCode}`);
      await db
        .update(serverOrdersTable)
        .set({ provisioningStatus: "failed" })
        .where(eq(serverOrdersTable.id, orderId));
      return;
    }

    await db
      .update(serverOrdersTable)
      .set({ provisioningStatus: "provisioning" })
      .where(eq(serverOrdersTable.id, orderId));

    try {
      const svc = orderRow.service;
      const instance = await provider.createServer(orderId, {
        name: `Server #${orderId}`,
        cpu: svc?.cpu ?? 2,
        ramGb: svc?.ramGb ?? 4,
        storageGb: svc?.storageGb ?? 100,
        storageType: svc?.storageType ?? "SSD",
        region: orderRow.order.requestedRegion,
      });

      await db
        .update(serverOrdersTable)
        .set({ externalId: instance.externalId, provisioningStatus: "active" })
        .where(eq(serverOrdersTable.id, orderId));

      const [existing] = await db
        .select({ id: serviceInstancesTable.id })
        .from(serviceInstancesTable)
        .where(eq(serviceInstancesTable.orderId, orderId))
        .limit(1);

      if (!existing) {
        await db.insert(serviceInstancesTable).values({
          orderId,
          userId: orderRow.order.userId,
          cloudServiceId: orderRow.order.cloudServiceId,
          providerId: orderRow.order.providerId ?? orderRow.provider?.id ?? null,
          externalId: instance.externalId,
          serviceType: svc?.serviceType ?? "server",
          provisioningStatus: "active",
          runningStatus: "running",
          region: orderRow.order.requestedRegion,
          cpu: svc?.cpu ?? null,
          ramGb: svc?.ramGb ?? null,
          storageGb: svc?.storageGb ?? null,
          bandwidthTb: svc?.bandwidthTb ? String(svc.bandwidthTb) : null,
        });
        console.log(`[ServerProvisioningService] Service instance created for order ${orderId}`);
      }
    } catch (err) {
      console.error(`[ServerProvisioningService] Failed to provision order ${orderId}:`, err);
      await db
        .update(serverOrdersTable)
        .set({ provisioningStatus: "failed" })
        .where(eq(serverOrdersTable.id, orderId));
    }
  }

  // TODO: Deprecated — use ServiceInstanceService.performAction() via POST /api/my-services/:id/start|stop|reboot
  async performAction(
    orderId: number,
    action: "start" | "stop" | "reboot",
    userId: string
  ): Promise<{ success: boolean; message: string }> {
    const [row] = await db
      .select({ instance: serviceInstancesTable, provider: providersTable })
      .from(serviceInstancesTable)
      .leftJoin(providersTable, eq(serviceInstancesTable.providerId, providersTable.id))
      .where(eq(serviceInstancesTable.orderId, orderId));

    if (row && row.instance.userId === userId) {
      const { serviceInstanceService } = await import("../ServiceInstanceService");
      return serviceInstanceService.performAction(row.instance.id, action, userId);
    }

    const [orderRow] = await db
      .select({ order: serverOrdersTable, provider: providersTable })
      .from(serverOrdersTable)
      .leftJoin(providersTable, eq(serverOrdersTable.providerId, providersTable.id))
      .where(eq(serverOrdersTable.id, orderId));

    if (!orderRow || orderRow.order.userId !== userId) {
      return { success: false, message: "Order not found" };
    }

    const providerCode = orderRow.provider?.code ?? "contabo";
    const provider = getProvider(providerCode);
    if (!provider) return { success: false, message: "Provider not found" };

    const externalId = orderRow.order.externalId ?? `mock-${orderId}`;

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
      const statusMap: Record<typeof action, string> = {
        start: "active",
        stop: "stopped",
        reboot: "active",
      };
      await db
        .update(serverOrdersTable)
        .set({ provisioningStatus: statusMap[action] })
        .where(eq(serverOrdersTable.id, orderId));
    }

    return { success: result.success, message: result.message };
  }
}

export const serverProvisioningService = new ServerProvisioningService();
