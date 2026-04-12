export interface ServerSpec {
  name: string;
  cpu: number;
  ramGb: number;
  storageGb: number;
  storageType: string;
  region: string;
  osType?: string;
}

export interface ServerInstance {
  externalId: string;
  status: "pending" | "provisioning" | "active" | "failed" | "stopped";
  ipAddress?: string;
  region: string;
  spec: ServerSpec;
  createdAt: string;
}

export interface ServerAction {
  success: boolean;
  message: string;
  status: ServerInstance["status"];
}

export class ContaboProvider {
  readonly code = "contabo";

  async createServer(orderId: number, spec: ServerSpec): Promise<ServerInstance> {
    const externalId = `contabo-${orderId}-${Date.now()}`;
    return {
      externalId,
      status: "pending",
      region: spec.region,
      spec,
      createdAt: new Date().toISOString(),
    };
  }

  async getServer(externalId: string): Promise<ServerInstance | null> {
    return {
      externalId,
      status: "active",
      ipAddress: "0.0.0.0",
      region: "eu-de",
      spec: {
        name: "VPS Server",
        cpu: 2,
        ramGb: 4,
        storageGb: 100,
        storageType: "SSD",
        region: "eu-de",
      },
      createdAt: new Date().toISOString(),
    };
  }

  async listServers(): Promise<ServerInstance[]> {
    return [];
  }

  async startServer(externalId: string): Promise<ServerAction> {
    console.log(`[ContaboProvider] startServer(${externalId}) — mock`);
    return { success: true, message: "Server start requested", status: "active" };
  }

  async stopServer(externalId: string): Promise<ServerAction> {
    console.log(`[ContaboProvider] stopServer(${externalId}) — mock`);
    return { success: true, message: "Server stop requested", status: "stopped" };
  }

  async restartServer(externalId: string): Promise<ServerAction> {
    console.log(`[ContaboProvider] restartServer(${externalId}) — mock`);
    return { success: true, message: "Server restart requested", status: "active" };
  }
}

export const contaboProvider = new ContaboProvider();
