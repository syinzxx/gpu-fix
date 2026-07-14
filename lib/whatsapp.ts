import { db } from "@/lib/db";

/**
 * Sends a WhatsApp message via the Twilio WhatsApp Business API.
 * If Twilio env vars are not configured, the message is logged with status
 * SKIPPED so staff can copy-paste it manually from the ticket page.
 */
export async function sendWhatsapp(opts: {
  ticketId: string;
  to: string | null | undefined;
  body: string;
}): Promise<void> {
  const { ticketId, to, body } = opts;
  if (!to) return;

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;

  if (!sid || !token || !from) {
    await db.whatsappLog.create({
      data: { ticketId, to, body, status: "SKIPPED" },
    });
    return;
  }

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          From: `whatsapp:${from}`,
          To: `whatsapp:${to}`,
          Body: body,
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      await db.whatsappLog.create({
        data: { ticketId, to, body, status: "FAILED", error: err.slice(0, 500) },
      });
      return;
    }

    await db.whatsappLog.create({
      data: { ticketId, to, body, status: "SENT" },
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
