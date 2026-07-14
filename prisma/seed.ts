import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  // --- Users ---
  const password = await bcrypt.hash("admin123", 10);
  const admin = await db.user.upsert({
    where: { email: "admin@shop.com" },
    update: {},
    create: { name: "Shop Owner", email: "admin@shop.com", passwordHash: password, role: "ADMIN" },
  });
  await db.user.upsert({
    where: { email: "reception@shop.com" },
    update: {},
    create: { name: "Front Desk", email: "reception@shop.com", passwordHash: password, role: "RECEPTIONIST" },
  });
  const tech = await db.user.upsert({
    where: { email: "tech@shop.com" },
    update: {},
    create: { name: "Lead Technician", email: "tech@shop.com", passwordHash: password, role: "TECHNICIAN" },
  });

  // --- Supplier + parts ---
  const supplier = await db.supplier.upsert({
    where: { id: "seed-supplier" },
    update: {},
    create: { id: "seed-supplier", name: "TechParts Wholesale", phone: "+201000000000" },
  });

  const parts = [
    { sku: "FAN-9025-12V", name: "GPU Fan 90mm 12V 4-pin", category: "FAN", quantity: 12, costPrice: 150, sellPrice: 300, lowStockThreshold: 4 },
    { sku: "FAN-8515-12V", name: "GPU Fan 85mm blower 12V", category: "FAN", quantity: 2, costPrice: 180, sellPrice: 350, lowStockThreshold: 4 },
    { sku: "VRM-MP2888A", name: "MP2888A voltage controller", category: "VRM", quantity: 6, costPrice: 220, sellPrice: 450, lowStockThreshold: 3 },
    { sku: "MOS-SIC654", name: "SiC654 power stage MOSFET", category: "VRM", quantity: 20, costPrice: 90, sellPrice: 200, lowStockThreshold: 8 },
    { sku: "CAP-POLY-470", name: "Polymer capacitor 470uF 16V", category: "CAPACITOR", quantity: 40, costPrice: 15, sellPrice: 50, lowStockThreshold: 15 },
    { sku: "MEM-GDDR6-2GB", name: "GDDR6 memory chip 2GB (K4Z80325BC)", category: "MEMORY", quantity: 8, costPrice: 550, sellPrice: 1100, lowStockThreshold: 4 },
    { sku: "TP-PAD-2MM", name: "Thermal pads 2mm sheet", category: "THERMAL", quantity: 15, costPrice: 80, sellPrice: 180, lowStockThreshold: 5 },
    { sku: "TP-PASTE-GD900", name: "GD900 thermal paste", category: "THERMAL", quantity: 25, costPrice: 40, sellPrice: 100, lowStockThreshold: 10 },
    { sku: "CON-PCIE-8P", name: "8-pin PCIe power connector", category: "CONNECTOR", quantity: 10, costPrice: 25, sellPrice: 80, lowStockThreshold: 5 },
  ];
  for (const p of parts) {
    await db.part.upsert({
      where: { sku: p.sku },
      update: {},
      create: { ...p, supplierId: supplier.id },
    });
  }

  // --- Sample customer + ticket so the dashboard isn't empty ---
  const existing = await db.ticket.findFirst();
  if (!existing) {
    const customer = await db.customer.create({
      data: {
        name: "Ahmed Hassan",
        phone: "+201234567890",
        whatsapp: "+201234567890",
      },
    });
    const ticket = await db.ticket.create({
      data: {
        code: "GPU-DEMO1",
        customerId: customer.id,
        deviceType: "GPU",
        brand: "ASUS",
        model: "RTX 3080 TUF Gaming",
        serialNumber: "SN-123456",
        issue: "Fans spin at full speed then card shuts down under load. Suspected fan controller or VRM issue.",
        status: "DIAGNOSING",
        priority: "NORMAL",
        assignedToId: tech.id,
        createdById: admin.id,
      },
    });
    await db.ticketEvent.createMany({
      data: [
        { ticketId: ticket.id, type: "CREATED", toStatus: "RECEIVED", createdById: admin.id, isPublic: true },
        { ticketId: ticket.id, type: "STATUS_CHANGE", fromStatus: "RECEIVED", toStatus: "DIAGNOSING", createdById: tech.id, isPublic: true },
        { ticketId: ticket.id, type: "NOTE", note: "Card received with all fans intact, no visible PCB damage. Starting thermal-camera inspection.", isPublic: true, createdById: tech.id },
      ],
    });
  }

  console.log("Seed complete. Logins (password: admin123):");
  console.log("  admin@shop.com | reception@shop.com | tech@shop.com");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
