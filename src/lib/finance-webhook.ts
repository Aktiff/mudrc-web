import { isPayStagingEventSlug } from "@/lib/pay-storage";

export const DEFAULT_FINANCE_WEBHOOK_URL = "https://fin.mudrc.sk/api/mudrc-sync.php";
export const DEFAULT_FINANCE_WEBHOOK_TIMEOUT_MS = 8000;

const VERCEL_REQUEST_CONTEXT_SYMBOL = Symbol.for("@vercel/request-context");
const DISABLED_WEBHOOK_VALUES = new Set(["off", "false", "0", "disabled"]);

export type FinanceWebhookReason =
  | "registration.create"
  | "registration.update"
  | "registration.delete"
  | "registration.cancel";

export type FinanceWebhookResult = {
  ok: boolean;
  skipped?: boolean;
  status?: number;
  reason?: string;
  error?: string;
};

type VercelRequestContext = {
  waitUntil?: (promise: Promise<unknown>) => void;
};

type GlobalWithVercelContext = typeof globalThis & {
  [VERCEL_REQUEST_CONTEXT_SYMBOL]?: {
    get?: () => VercelRequestContext | undefined;
  };
};

function stripEnvQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

export function resolveFinanceWebhookUrl(raw?: string): string | null {
  const cleaned = stripEnvQuotes(raw ?? "");
  if (!cleaned) return DEFAULT_FINANCE_WEBHOOK_URL;
  if (DISABLED_WEBHOOK_VALUES.has(cleaned.toLowerCase())) return null;

  try {
    const parsed = new URL(cleaned);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      console.warn("Finance sync webhook URL ignored (unsupported protocol):", parsed.protocol);
      return null;
    }
    return parsed.toString();
  } catch {
    console.warn("Finance sync webhook URL is invalid; skipping ping.");
    return null;
  }
}

function attachToVercelWaitUntil(promise: Promise<unknown>): boolean {
  try {
    const holder = (globalThis as GlobalWithVercelContext)[VERCEL_REQUEST_CONTEXT_SYMBOL];
    const ctx = holder?.get?.();
    if (ctx && typeof ctx.waitUntil === "function") {
      ctx.waitUntil(promise);
      return true;
    }
  } catch (error) {
    console.warn("Finance sync webhook waitUntil lookup failed:", error);
  }
  return false;
}

export async function sendFinanceSyncWebhook(
  reason: FinanceWebhookReason,
  options?: {
    token?: string;
    webhookUrl?: string;
    timeoutMs?: number;
    fetchImpl?: typeof fetch;
  }
): Promise<FinanceWebhookResult> {
  const token = stripEnvQuotes(options?.token ?? process.env.FINANCE_SYNC_TOKEN ?? "");
  if (!token) {
    return { ok: false, skipped: true, reason: "missing_token" };
  }

  const rawUrl =
    options?.webhookUrl !== undefined ? options.webhookUrl : process.env.FINANCE_WEBHOOK_URL;
  const url = resolveFinanceWebhookUrl(rawUrl);
  if (!url) {
    return { ok: false, skipped: true, reason: "disabled_or_invalid_url" };
  }

  const timeoutMs =
    typeof options?.timeoutMs === "number" && options.timeoutMs > 0
      ? options.timeoutMs
      : DEFAULT_FINANCE_WEBHOOK_TIMEOUT_MS;
  const fetchFn = options?.fetchImpl ?? fetch;

  try {
    const res = await fetchFn(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        source: "mudrc-web",
        reason,
        triggered_at: new Date().toISOString(),
      }),
      cache: "no-store",
      signal:
        typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
          ? AbortSignal.timeout(timeoutMs)
          : undefined,
    });

    const bodyText = await res.text().catch(() => "");
    if (!res.ok) {
      console.error("Finance sync webhook returned non-OK status:", {
        reason,
        status: res.status,
        detail: bodyText.slice(0, 300),
      });
      return { ok: false, status: res.status, error: `HTTP ${res.status}` };
    }

    console.info("Finance sync webhook triggered:", { reason, status: res.status });
    return { ok: true, status: res.status };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Finance sync webhook request failed:", { reason, error: message });
    return { ok: false, error: message };
  }
}

/**
 * Fire-and-forget ping to fin.mudrc.sk after a registration mutation.
 * Uses Vercel's waitUntil context when present so the serverless function stays
 * alive until the ping completes without slowing down the HTTP response.
 */
export function triggerFinanceSyncWebhook(
  reason: FinanceWebhookReason,
  options?: {
    eventSlug?: string;
    token?: string;
    webhookUrl?: string;
    timeoutMs?: number;
    fetchImpl?: typeof fetch;
  }
): void {
  if (options?.eventSlug && isPayStagingEventSlug(options.eventSlug)) {
    return;
  }

  const task = sendFinanceSyncWebhook(reason, options).catch((error) => {
    console.error("Finance sync webhook unexpected error:", {
      reason,
      error: error instanceof Error ? error.message : String(error),
    });
  });

  if (!attachToVercelWaitUntil(task)) {
    void task;
  }
}
