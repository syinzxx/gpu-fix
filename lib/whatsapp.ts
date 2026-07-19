import { db } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { statusMessage, buildStatusLine, type TicketStatus } from "@/lib/constants";

/**
 * Optional structured params for the ticket_update template.
 * When provided, sends a WhatsApp template message via Meta Cloud API.
 * When omitted, falls back to a free-text message (only works inside a
 * 24-hour customer-initiated window).
 */
export interface WhatsappTemplateParams {
  customerName: string;
  code: string;
  statusLine: string;
  trackUrl: string;
}

/**
 * Sends a WhatsApp message via the Meta WhatsApp Cloud API.
 *
 * If WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN are not set, the
 * message is logged with status SKIPPED so staff can copy-paste it manually
 * from the ticket page (same fallback behaviour as the previous Twilio impl).
 *
 * The optional `templateParams` argument drives the `ticket_update` template
 * (4 variables: customerName, code, statusLine, trackUrl). When omitted, the
 * function sends `body` as a free-form text message, which is only delivered
 * if the customer initiated a conversation in the last 24 hours.
 *
 * NOTE: all three ticket actions (createTicket, changeStatus, resendWhatsapp)
 * always pass `templateParams`, so they take the template path. The free-text
 * branch is NOT dead code — it exists for ad-hoc/manual callers that pass only
 * `body` (deliverable only inside an open 24h service window).
 */
export async function sendWhatsapp(opts: {
  ticketId: string;
  to: string | null | undefined;
  body: string;
  templateParams?: WhatsappTemplateParams;
}): Promise<void> {
  const { ticketId, body, templateParams } = opts;
  const to = opts.to;
  if (!to) return;

  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    await db.whatsappLog.create({
      data: { ticketId, to, body, status: "SKIPPED" },
    });
    return;
  }

  // Normalize to E.164 for the Cloud API
  const normalizedTo = normalizePhone(to);

  // Build the message payload
  const payload = templateParams
    ? buildTemplatePayload(normalizedTo, templateParams)
    : buildTextPayload(normalizedTo, body);

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      await db.whatsappLog.create({
        data: {
          ticketId,
          to,
          body,
          status: "FAILED",
          error: err.slice(0, 500),
        },
      });
      return;
    }

    const json = (await res.json()) as { messages?: { id: string }[] };
    const waMessageId = json?.messages?.[0]?.id ?? null;

    await db.whatsappLog.create({
      data: { ticketId, to, body, status: "SENT", waMessageId },
    });
  } catch (e) {
    await db.whatsappLog.create({
      data: {
        ticketId,
        to,
        body,
        status: "FAILED",
        error: e instanceof Error ? e.message : "Unknown error",
      },
    });
  }
}

/**
 * Sends the standard per-status-change WhatsApp message for a ticket.
 * This is the single place that assembles the free-text body (statusMessage)
 * and the ticket_update template line (buildStatusLine) so every caller —
 * createTicket, changeStatus, resendWhatsapp, and the public quote-approval
 * actions — sends an identical message for a given status. Do not
 * reimplement this assembly elsewhere; call this instead.
 */
export async function sendTicketStatusWhatsapp(opts: {
  ticketId: string;
  to: string | null | undefined;
  customerName: string;
  code: string;
  status: TicketStatus;
  device: string;
  quoteAmount?: number | null;
  eta?: string | null;
}): Promise<void> {
  const trackUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/track/${opts.code}`;
  await sendWhatsapp({
    ticketId: opts.ticketId,
    to: opts.to,
    body: statusMessage({
      customerName: opts.customerName,
      code: opts.code,
      status: opts.status,
      device: opts.device,
      quoteAmount: opts.quoteAmount,
      eta: opts.eta,
    }),
    templateParams: {
      customerName: opts.customerName,
      code: opts.code,
      statusLine: buildStatusLine({
        status: opts.status,
        device: opts.device,
        quoteAmount: opts.quoteAmount,
        eta: opts.eta,
      }),
      trackUrl,
    },
  });
}

// ---------------------------------------------------------------------------
// Payload builders
// ---------------------------------------------------------------------------

function buildTemplatePayload(to: string, p: WhatsappTemplateParams) {
  return {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: "ticket_update",
      language: { code: "en" },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: p.customerName },
            { type: "text", text: p.code },
            { type: "text", text: p.statusLine },
            { type: "text", text: p.trackUrl },
          ],
        },
      ],
    },
  };
}

function buildTextPayload(to: string, text: string) {
  return {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: text },
  };
}
