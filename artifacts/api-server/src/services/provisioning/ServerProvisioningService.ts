import { db } from "@workspace/db";
import { serverOrdersTable, providersTable } from "@workspace/db/schema";
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
    const [order] = await db
      .select({ order: serverOrdersTable, provider: providersTable })
      .from(serverOrdersTable)
      .leftJoin(providersTable, eq(serverOrdersTable.providerId, providersTable.id))
      .where(eq(serverOrdersTable.id, orderId));

    if (!order) {
      console.error(`[ServerProvisioningService] Order ${orderId} not found`);
      return;
    }

    const providerCode = order.provider?.code ?? "contabo";
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
      const instance = await provider.createServer(orderId, {
        name: `Server #${orderId}`,
        cpu: 2,
        ramGb: 4,
        storageGb: 100,
        storageType: "SSD",
        region: order.order.requestedRegion,
      });

      await db
        .update(serverOrdersTable)
        .set({
          externalId: instance.externalId,
          provisioningStatus: "active",
        })
        .where(eq(serverOrdersTable.id, orderId));
    } catch (err) {
      console.error(`[ServerProvisioningService] Failed to provision order ${orderId}:`, err);
      await db
        .update(serverOrdersTable)
        .set({ provisioningStatus: "failed" })
        .where(eq(serverOrdersTable.id, orderId));
    }
  }

  async performAction(
    orderId: number,
    action: "start" | "stop" | "reboot",
    userId: string
  ): Promise<{ success: boolean; message: string }> {
    const [row] = await db
      .select({ order: serverOrdersTable, provider: providersTable })
      .from(serverOrdersTable)
      .leftJoin(providersTable, eq(serverOrdersTable.providerId, providersTable.id))
      .where(eq(serverOrdersTable.id, orderId));

    if (!row || row.order.userId !== userId) {
      return { success: false, message: "Order not found" };
    }

    const providerCode = row.provider?.code ?? "contabo";
    const provider = getProvider(providerCode);

    if (!provider) {
      return { success: false, message: "Provider not found" };
    }

    const externalId = row.order.externalId ?? `mock-${orderId}`;

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

    return { success: result.success, message: result.message };
  }
}

export const serverProvisioningService = new ServerProvisioningService();
