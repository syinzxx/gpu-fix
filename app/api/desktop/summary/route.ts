import { type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/desktop/summary
 * Authenticated endpoint for the Electron desktop app tray poller.
 * Returns a lightweight JSON summary of current ticket counts and the
 * most recently created ticket (for new-ticket notifications).
 *
 * Returns 401 if there is no valid session.
 */
export async function GET(_request: NextRequest): Promise<Response> {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [open, ready, latestTicket] = await Promise.all([
    db.ticket.count({
      where: { status: { not: "CLOSED" } },
    }),
    db.ticket.count({
      where: { status: "READY_FOR_PICKUP" },
    }),
    db.ticket.findFirst({
      orderBy: { createdAt: "desc" },
      select: { id: true, code: true, createdAt: true },
    }),
  ]);

  return Response.json({
    open,
    ready,
    latestTicketId: latestTicket?.id ?? null,
    latestTicketCode: latestTicket?.code ?? null,
    latestCreatedAt: latestTicket?.createdAt ?? null,
  });
}
