import { type NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { db } from "@/lib/db";
import { CUSTOMER_STATUS_LABELS, type CustomerStatus } from "@/lib/constants";

export const dynamic = "force-dynamic";

/**
 * GET /api/whatsapp/webhook
 * Meta webhook verification handshake.
 * Meta sends ?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...
 * If the verify_token matches, we echo back hub.challenge as plain text.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = request.nextUrl;

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode === "subscribe" && token === verifyToken) {
    return new Response(challenge ?? "", { status: 200 });
  }

  return new Response("Forbidden", { status: 403 });
}

/**
 * POST /api/whatsapp/webhook
 * Receives Meta webhook events:
 *   - statuses: delivery/read/failed receipts → update WhatsappLog.status
 *   - messages: inbound customer texts → auto-reply with tracking link
 *               when the message contains a ticket code (GPU-XXXXX)
 *
 * Always responds 200 quickly so Meta doesn't retry.
 */
export async function POST(request: NextRequest): Promise<Response> {
  try {
    // Read the raw body so we can verify Meta's HMAC signature over the exact
    // bytes they signed (JSON.parse would lose that fidelity).
    const raw = await request.text();

    // When an app secret is configured, reject any request whose
    // X-Hub-Signature-256 doesn't match — this is the only thing stopping a
    // stranger from spoofing delivery receipts or triggering outbound replies.
    // If the secret is unset we accept the request, matching the app's
    // "degrade gracefully without credentials" behaviour elsewhere.
    const appSecret = process.env.WHATSAPP_APP_SECRET;
    if (appSecret && !isValidSignature(raw, request.headers.get("x-hub-signature-256"), appSecret)) {
      return new Response("Forbidden", { status: 403 });
    }

    const body = JSON.parse(raw) as MetaWebhookBody;
    // Await so a PM2 graceful shutdown / serverless freeze can't kill the
    // work after the response is sent. processWebhook swallows its own
    // internal errors, so the 200 below is still guaranteed.
    await processWebhook(body);
  } catch {
    // JSON parse failure — still return 200 to avoid Meta retries
  }

  return new Response("OK", { status: 200 });
}

/**
 * Verifies Meta's X-Hub-Signature-256 header: HMAC-SHA256 of the raw request
 * body keyed with the app secret, hex-encoded and prefixed with "sha256=".
 * Uses a constant-time compare to avoid leaking the signature via timing.
 */
function isValidSignature(
  rawBody: string,
  header: string | null,
  appSecret: string
): boolean {
  if (!header) return false;
  const expected =
    "sha256=" + createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// ---------------------------------------------------------------------------
// Internal processing
// ---------------------------------------------------------------------------

interface MetaWebhookBody {
  object?: string;
  entry?: MetaEntry[];
}

interface MetaEntry {
  changes?: MetaChange[];
}

interface MetaChange {
  value?: MetaChangeValue;
}

interface MetaChangeValue {
  statuses?: MetaStatus[];
  messages?: MetaMessage[];
}

interface MetaStatus {
  id: string;
  status: string; // "sent" | "delivered" | "read" | "failed"
}

interface MetaMessage {
  from: string;
  type: string;
  text?: { body: string };
}

async function processWebhook(body: MetaWebhookBody): Promise<void> {
  if (body.object !== "whatsapp_business_account") return;

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      if (!value) continue;

      // Status receipts
      for (const status of value.statuses ?? []) {
        await handleStatus(status);
      }

      // Inbound messages
      for (const message of value.messages ?? []) {
        await handleInbound(message);
      }
    }
  }
}

async function handleStatus(status: MetaStatus): Promise<void> {
  // Map Meta statuses to our log statuses
  const statusMap: Record<string, string> = {
    sent: "SENT",
    delivered: "DELIVERED",
    read: "READ",
    failed: "FAILED",
  };

  const newStatus = statusMap[status.status] ?? status.status.toUpperCase();

  try {
    await db.whatsappLog.updateMany({
      where: { waMessageId: status.id },
      data: { status: newStatus },
    });
  } catch {
    // Non-fatal — the log entry might not exist yet
  }
}

async function handleInbound(message: MetaMessage): Promise<void> {
  if (message.type !== "text" || !message.text?.body) return;

  const text = message.text.body;

  // Look for a ticket code pattern: GPU-XXXXX (case-insensitive so customers
  // typing lowercase still get a reply)
  const match = text.match(/GPU-[A-Z0-9]{5}/i);
  if (!match) return;

  const code = match[0].toUpperCase();

  try {
    const ticket = await db.ticket.findUnique({
      where: { code },
      include: { customer: { select: { name: true } } },
    });
    if (!ticket) return;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const trackUrl = `${appUrl}/track/${code}`;
    const statusLabel = CUSTOMER_STATUS_LABELS[ticket.customerStatus as CustomerStatus] ?? ticket.customerStatus;
    const replyBody = `Hi ${ticket.customer.name}, your repair (${code}) is currently: ${statusLabel}.\n\nTrack anytime: ${trackUrl}`;

    await sendReply(ticket.id, message.from, replyBody);
  } catch {
    // Non-fatal
  }
}

/**
 * Sends a free-form text reply via the Graph API and records the attempt in
 * WhatsappLog (SENT with waMessageId, or FAILED with error text) so auto-
 * replies have an audit trail like every other outbound message.
 */
async function sendReply(
  ticketId: string,
  to: string,
  text: string
): Promise<void> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) return;

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { body: text },
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      await db.whatsappLog.create({
        data: {
          ticketId,
          to,
          body: text,
          status: "FAILED",
          error: err.slice(0, 500),
        },
      });
      return;
    }

    const json = (await res.json()) as { messages?: { id: string }[] };
    const waMessageId = json?.messages?.[0]?.id ?? null;

    await db.whatsappLog.create({
      data: { ticketId, to, body: text, status: "SENT", waMessageId },
    });
  } catch (e) {
    await db.whatsappLog.create({
      data: {
        ticketId,
        to,
        body: text,
        status: "FAILED",
        error: e instanceof Error ? e.message : "Unknown error",
      },
    });
  }
}
