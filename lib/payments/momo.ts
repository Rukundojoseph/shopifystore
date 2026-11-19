import "server-only";

// MTN MoMo Open API — Collections product.
// Docs: https://momodeveloper.mtn.co.rw
//
// All credentials come from the server environment and are intentionally blank
// in .env.example. Nothing here is ever sent to the browser.

export type MomoConfig = {
  baseUrl: string;
  subscriptionKey: string;
  apiUser: string;
  apiKey: string;
  targetEnvironment: string;
  callbackUrl: string | null;
  currency: string;
  environment: "sandbox" | "production";
};

export function momoConfig(): MomoConfig | null {
  const e = process.env;
  const baseUrl = e.MTN_MOMO_BASE_URL?.trim();
  const subscriptionKey = e.MTN_MOMO_COLLECTION_SUBSCRIPTION_KEY?.trim();
  const apiUser = e.MTN_MOMO_API_USER?.trim();
  const apiKey = e.MTN_MOMO_API_KEY?.trim();
  const environment = e.MTN_MOMO_ENVIRONMENT === "production" ? "production" : "sandbox";
  const targetEnvironment = e.MTN_MOMO_TARGET_ENVIRONMENT?.trim() || (environment === "sandbox" ? "sandbox" : "");
  if (!baseUrl || !subscriptionKey || !apiUser || !apiKey || !targetEnvironment) return null;
  return {
    baseUrl: baseUrl.replace(/\/$/, ""),
    subscriptionKey,
    apiUser,
    apiKey,
    targetEnvironment,
    callbackUrl: e.MTN_MOMO_CALLBACK_URL?.trim() || null,
    currency: e.MTN_MOMO_CURRENCY?.trim() || "RWF",
    environment,
  };
}

/** Dev-only stand-in used while MTN credentials are blank. Never active in production. */
export function simulatorEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.MOMO_DEV_SIMULATOR === "true" && !momoConfig();
}

export function momoAvailable(): { available: boolean; mode: "live" | "simulator" | "off" } {
  if (momoConfig()) return { available: true, mode: "live" };
  if (simulatorEnabled()) return { available: true, mode: "simulator" };
  return { available: false, mode: "off" };
}

export class MomoError extends Error {
  constructor(message: string, public status?: number, public body?: unknown) {
    super(message);
  }
}

// ─── Access token (cached until shortly before expiry) ─────────────────────

let tokenCache: { token: string; expiresAt: number } | null = null;

async function accessToken(cfg: MomoConfig): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.token;
  const res = await fetch(`${cfg.baseUrl}/collection/token/`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${cfg.apiUser}:${cfg.apiKey}`).toString("base64"),
      "Ocp-Apim-Subscription-Key": cfg.subscriptionKey,
    },
    cache: "no-store",
  });
  if (!res.ok) throw new MomoError(`MTN token request failed (${res.status})`, res.status, await safeJson(res));
  const data = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

// ─── Request to Pay ────────────────────────────────────────────────────────

export type RequestToPayInput = {
  referenceId: string; // UUID v4, becomes X-Reference-Id; used to query status later
  externalId: string; // our payment id, echoed back by MTN
  amount: number;
  payerMsisdn: string; // 2507XXXXXXXX
  payerMessage: string;
  payeeNote: string;
  callbackUrl?: string | null;
};

/**
 * Submits a payment request. MTN answers 202 Accepted — this only means the
 * request was queued. The payment is NOT complete until the status endpoint
 * (or a verified callback) reports SUCCESSFUL.
 */
export async function requestToPay(input: RequestToPayInput): Promise<void> {
  const cfg = momoConfig();
  if (!cfg) throw new MomoError("MTN MoMo is not configured");
  const token = await accessToken(cfg);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "X-Reference-Id": input.referenceId,
    "X-Target-Environment": cfg.targetEnvironment,
    "Ocp-Apim-Subscription-Key": cfg.subscriptionKey,
    "Content-Type": "application/json",
  };
  if (input.callbackUrl) headers["X-Callback-Url"] = input.callbackUrl;

  const res = await fetch(`${cfg.baseUrl}/collection/v1_0/requesttopay`, {
    method: "POST",
    headers,
    cache: "no-store",
    body: JSON.stringify({
      amount: String(input.amount),
      currency: cfg.currency,
      externalId: input.externalId,
      payer: { partyIdType: "MSISDN", partyId: input.payerMsisdn },
      payerMessage: input.payerMessage.slice(0, 160),
      payeeNote: input.payeeNote.slice(0, 160),
    }),
  });
  if (res.status !== 202) throw new MomoError(`MTN requesttopay rejected (${res.status})`, res.status, await safeJson(res));
}

export type MomoRemoteStatus = {
  status: "PENDING" | "SUCCESSFUL" | "FAILED" | string;
  financialTransactionId?: string;
  reason?: string | { code?: string; message?: string };
  amount?: string;
  currency?: string;
  externalId?: string;
};

export async function getRequestToPayStatus(referenceId: string): Promise<MomoRemoteStatus | null> {
  const cfg = momoConfig();
  if (!cfg) throw new MomoError("MTN MoMo is not configured");
  const token = await accessToken(cfg);
  const res = await fetch(`${cfg.baseUrl}/collection/v1_0/requesttopay/${referenceId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Target-Environment": cfg.targetEnvironment,
      "Ocp-Apim-Subscription-Key": cfg.subscriptionKey,
    },
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new MomoError(`MTN status request failed (${res.status})`, res.status, await safeJson(res));
  return (await res.json()) as MomoRemoteStatus;
}

/** Maps MTN's status vocabulary onto ours. */
export function mapRemoteStatus(remote: MomoRemoteStatus): "processing" | "successful" | "failed" | "expired" | "cancelled" {
  const s = String(remote.status).toUpperCase();
  if (s === "SUCCESSFUL") return "successful";
  if (s === "PENDING") return "processing";
  const reason = typeof remote.reason === "string" ? remote.reason : remote.reason?.code ?? "";
  if (/EXPIRED|TIMEOUT/i.test(reason)) return "expired";
  if (/REJECT|CANCEL/i.test(reason)) return "cancelled";
  return "failed";
}

export function reasonText(remote: MomoRemoteStatus): string | null {
  if (!remote.reason) return null;
  return typeof remote.reason === "string" ? remote.reason : remote.reason.message ?? remote.reason.code ?? null;
}
