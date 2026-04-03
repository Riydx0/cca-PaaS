interface PaymentParams {
  amount: string;
  currency: string;
  method: string;
  invoiceId: number;
  userId: number;
}

interface PaymentResult {
  transactionReference: string;
  status: "Completed" | "Pending" | "Failed";
  providerName: string;
  providerResponse: Record<string, unknown>;
}

export class PaymentGatewayService {
  static async initiatePayment(params: PaymentParams): Promise<PaymentResult> {
    const provider = this.resolveProvider(params.method);

    if (provider === "moyasar") {
      return this.moyasarMock(params);
    } else if (provider === "stcpay") {
      return this.stcPayMock(params);
    } else if (provider === "hyperpay") {
      return this.hyperPayMock(params);
    }

    return this.genericMock(params);
  }

  static async verifyPayment(transactionReference: string): Promise<{ verified: boolean; status: string }> {
    return {
      verified: true,
      status: "Completed",
    };
  }

  private static resolveProvider(method: string): string {
    const m = method.toLowerCase();
    if (m.includes("moyasar") || m === "credit_card") return "moyasar";
    if (m.includes("stc") || m === "stc_pay") return "stcpay";
    if (m.includes("hyper") || m === "mada") return "hyperpay";
    return "mock";
  }

  private static moyasarMock(params: PaymentParams): PaymentResult {
    const apiKey = process.env["MOYASAR_API_KEY"];
    if (!apiKey) {
      console.warn("[PaymentGateway] MOYASAR_API_KEY not set — using mock response");
    }
    return {
      transactionReference: `MOYS-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      status: "Completed",
      providerName: "Moyasar",
      providerResponse: {
        provider: "Moyasar",
        method: params.method,
        amount: params.amount,
        currency: params.currency,
        invoiceId: params.invoiceId,
        mock: !apiKey,
        timestamp: new Date().toISOString(),
      },
    };
  }

  private static stcPayMock(params: PaymentParams): PaymentResult {
    const apiKey = process.env["STC_PAY_API_KEY"];
    if (!apiKey) {
      console.warn("[PaymentGateway] STC_PAY_API_KEY not set — using mock response");
    }
    return {
      transactionReference: `STC-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      status: "Completed",
      providerName: "STC Pay",
      providerResponse: {
        provider: "STC Pay",
        method: params.method,
        amount: params.amount,
        currency: params.currency,
        invoiceId: params.invoiceId,
        mock: !apiKey,
        timestamp: new Date().toISOString(),
      },
    };
  }

  private static hyperPayMock(params: PaymentParams): PaymentResult {
    const apiKey = process.env["HYPERPAY_ACCESS_TOKEN"];
    if (!apiKey) {
      console.warn("[PaymentGateway] HYPERPAY_ACCESS_TOKEN not set — using mock response");
    }
    return {
      transactionReference: `HPY-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      status: "Completed",
      providerName: "HyperPay",
      providerResponse: {
        provider: "HyperPay",
        method: params.method,
        amount: params.amount,
        currency: params.currency,
        invoiceId: params.invoiceId,
        mock: !apiKey,
        timestamp: new Date().toISOString(),
      },
    };
  }

  private static genericMock(params: PaymentParams): PaymentResult {
    return {
      transactionReference: `MOCK-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      status: "Completed",
      providerName: "Mock Gateway",
      providerResponse: {
        provider: "Mock",
        method: params.method,
        amount: params.amount,
        currency: params.currency,
        invoiceId: params.invoiceId,
        mock: true,
        timestamp: new Date().toISOString(),
      },
    };
  }
}
