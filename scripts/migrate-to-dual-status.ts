import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const STATUS_MAP: Record<string, { staffStatus: string; customerStatus: string }> = {
  RECEIVED:                   { staffStatus: "OPEN",    customerStatus: "RECEIVED" },
  DIAGNOSING:                 { staffStatus: "OPEN",    customerStatus: "DIAGNOSING" },
  EXPEDITE_DIAGNOSIS:         { staffStatus: "OPEN",    customerStatus: "DIAGNOSING" },
  WAITING_FOR_PARTS:          { staffStatus: "PENDING", customerStatus: "WAITING_FOR_PARTS" },
  TESTING:                    { staffStatus: "OPEN",    customerStatus: "TESTING" },
  WAITING_FOR_QUOTE_APPROVAL: { staffStatus: "PENDING", customerStatus: "WAITING_FOR_APPROVAL" },
  READY_FOR_PICKUP:           { staffStatus: "PENDING", customerStatus: "READY_FOR_PICKUP" },
  CLOSED:                     { staffStatus: "CLOSED",  customerStatus: "CLOSED" },
};

async function main() {
  // Migration already applied — status column has been removed.
  // This script is kept for historical reference only.
  const tickets = await db.ticket.findMany({ select: { id: true, staffStatus: true, customerStatus: true } });
  console.log(`Found ${tickets.length} tickets (already migrated).`);
  for (const t of tickets) {
    const mapped = STATUS_MAP[t.staffStatus] ?? { staffStatus: "OPEN", customerStatus: "RECEIVED" };
    await db.ticket.update({
      where: { id: t.id },
      data: { staffStatus: mapped.staffStatus, customerStatus: mapped.customerStatus },
    });
  }
  console.log("Done.");
  await db.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
