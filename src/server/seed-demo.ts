/**
 * Data contoh untuk DEMO (DEMO_SEED=true). Hanya berjalan bila belum ada pengguna.
 * Semua transaksi dibuat lewat service yang sama dengan aplikasi, jadi angka laporan konsisten.
 */
import { prisma } from "./db";
import { hashPassword } from "./password";
import { loadActorByUserId } from "./actor-loader";
import { createOrder, assignOperator, transitionOrder, cancelOrder } from "./services/orders";
import { recordPayment } from "./services/payments";
import { createCustomer } from "./services/customers";
import { createPickup, createDelivery, advanceDelivery, advancePickup } from "./services/logistics";
import { createExpense } from "./services/expenses";
import { addDaysKey, localDateKey, startOfLocalDay } from "@/lib/time";
import type { OrderStatusT } from "@/lib/status";

export const DEMO_PASSWORD = "demo1234";

// gambar 1x1 PNG sebagai foto bukti contoh
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

export async function seedDemo() {
  if ((await prisma.user.count()) > 0) return false;
  const roles = Object.fromEntries((await prisma.role.findMany()).map((r) => [r.key, r.id]));
  const pw = await hashPassword(DEMO_PASSWORD);
  const mk = (name: string, username: string, role: string, phone?: string) =>
    prisma.user.create({ data: { name, username, passwordHash: pw, roleId: roles[role], phone } });
  const owner = await mk("Bu Rina (Owner)", "owner", "OWNER");
  await mk("Andi (Admin)", "admin", "ADMIN");
  const kasir = await mk("Sari (Kasir)", "kasir", "KASIR");
  const op1 = await mk("Budi (Operator)", "operator", "OPERATOR");
  const op2 = await mk("Dewi (Operator)", "operator2", "OPERATOR");
  const k1 = await mk("Joko (Kurir)", "kurir", "KURIR", "6281234500001");
  const k2 = await mk("Rudi (Kurir)", "kurir2", "KURIR", "6281234500002");
  const c1 = await prisma.courier.create({ data: { userId: k1.id, phone: k1.phone, vehicle: "Motor" } });
  await prisma.courier.create({ data: { userId: k2.id, phone: k2.phone, vehicle: "Motor" } });
  await prisma.businessSetting.update({ where: { id: 1 }, data: { name: "Laundry", address: "Jl. Contoh No. 1, Medan", whatsapp: "6281200000000" } });

  const A = async (id: number) => (await loadActorByUserId(id))!;
  const aOwner = await A(owner.id), aKasir = await A(kasir.id), aOp1 = await A(op1.id), aOp2 = await A(op2.id), aK1 = await A(k1.id);
  const services = await prisma.service.findMany();
  const svc = (code: string) => services.find((s) => s.code === code)!.id;

  const people = [
    ["Ibu Ani", "081311112222", "Jl. Merdeka 10"], ["Pak Hendra", "081322223333", "Jl. Gatot Subroto 25"],
    ["Mbak Lia", "081333334444", "Komp. Cemara Asri B-12"], ["Koh Willy", "081344445555", "Jl. Asia 88"],
    ["Ibu Maria", "081355556666", "Jl. Setia Budi 3"], ["Bang Riko", "081366667777", "Jl. Iskandar Muda 41"],
  ];
  const customers = [];
  for (const [name, phone, address] of people) customers.push(await createCustomer(aKasir, { name, phone, address }));

  const today = localDateKey();
  const at = (daysAgo: number, hour: number) => new Date(startOfLocalDay(addDaysKey(today, -daysAgo)).getTime() + hour * 3600000);
  const flowTo = async (orderId: number, target: OrderStatusT, actor: typeof aOp1, now: Date) => {
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
    const { orderPath } = await import("@/lib/status");
    const path = orderPath(order.items.map((i) => i.flow), order.handover);
    let t = now.getTime();
    for (const st of path.slice(path.indexOf(order.status) + 1)) {
      if (st === "DALAM_PENGANTARAN") break;
      if (st === "SELESAI" && order.handover === "ANTAR") break;
      t += 2 * 3600000;
      await transitionOrder(st === "SELESAI" ? aKasir : actor, orderId, st, undefined, new Date(t));
      if (st === target) break;
    }
  };

  let i = 0;
  for (let d = 12; d >= 0; d--) {
    const perDay = d === 0 ? 3 : 2 + (d % 3);
    for (let j = 0; j < perDay; j++) {
      const c = customers[i % customers.length];
      const now = at(d, 9 + j * 2);
      const items = i % 4 === 0
        ? [{ serviceId: svc("CS"), quantity: (2 + (i % 5) * 0.5).toString() }, { serviceId: svc("BC"), quantity: "1" }]
        : i % 4 === 1 ? [{ serviceId: svc("CK"), quantity: (3 + (i % 3)).toString() }]
        : i % 4 === 2 ? [{ serviceId: svc("SS"), quantity: "2.5" }]
        : [{ serviceId: svc("CS"), quantity: "4", express: true }];
      const dp = i % 3 === 0 ? { method: "CASH" as const, amount: 10000 } : undefined;
      const { order } = await createOrder(aKasir, { customerId: c.id, items, discountType: i % 5 === 0 ? "PERCENT" : "NONE", discountValue: i % 5 === 0 ? 10 : 0, initialPayment: dp }, now);
      const op = i % 2 ? aOp1 : aOp2;
      await assignOperator(aOwner, order.id, op.id, new Date(now.getTime() + 600000));
      if (d >= 2) {
        await flowTo(order.id, "SIAP_DIAMBIL", op, new Date(now.getTime() + 3600000));
        const fresh = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
        const rest = fresh.total - fresh.paidAmount;
        if (rest > 0) await recordPayment(aKasir, order.id, { method: i % 2 ? "TRANSFER" : "CASH", amount: rest }, new Date(now.getTime() + 30 * 3600000));
        if (i % 7 !== 0) await transitionOrder(aKasir, order.id, "SELESAI", undefined, new Date(now.getTime() + 31 * 3600000));
      } else if (d === 1) {
        await flowTo(order.id, i % 2 ? "DICUCI" : "DISETRIKA", op, new Date(now.getTime() + 3600000));
      }
      i++;
    }
  }
  // satu pesanan dibatalkan
  const { order: cancelMe } = await createOrder(aKasir, { customerId: customers[2].id, items: [{ serviceId: svc("CK"), quantity: "3" }], initialPayment: { method: "CASH", amount: 10000 } }, at(3, 10));
  await cancelOrder(aOwner, cancelMe.id, { reason: "Pelanggan membatalkan sebelum diproses", refund: { method: "CASH", amount: 10000 } }, at(3, 15));

  // alur antar: pesanan siap → dijadwalkan → sedang diantar
  const { order: toDeliver } = await createOrder(aKasir, { customerId: customers[3].id, items: [{ serviceId: svc("CS"), quantity: "5" }], handover: "ANTAR", deliveryFee: 5000 }, at(2, 9));
  await assignOperator(aOwner, toDeliver.id, aOp1.id, at(2, 10));
  await flowTo(toDeliver.id, "SIAP_DIAMBIL", aOp1, at(2, 11));
  await createDelivery(aKasir, toDeliver.id, { name: customers[3].name, phone: customers[3].phone, address: customers[3].address ?? "-", mapsUrl: "https://maps.google.com/?q=3.5952,98.6722", scheduledAt: new Date(), courierId: c1.id, courierPay: 7000 }, at(1, 9));
  // alur antar selesai
  const { order: delivered } = await createOrder(aKasir, { customerId: customers[4].id, items: [{ serviceId: svc("CK"), quantity: "4" }], handover: "ANTAR", deliveryFee: 5000, initialPayment: { method: "TRANSFER", amount: 29000 } }, at(4, 9));
  await assignOperator(aOwner, delivered.id, aOp2.id, at(4, 10));
  await flowTo(delivered.id, "SIAP_DIAMBIL", aOp2, at(4, 11));
  const dl = await createDelivery(aKasir, delivered.id, { name: customers[4].name, phone: customers[4].phone, address: customers[4].address ?? "-", scheduledAt: at(3, 10), courierId: c1.id, courierPay: 7000 }, at(3, 8));
  await advanceDelivery(aK1, dl.id, "DALAM_PENGANTARAN", at(3, 10));
  await prisma.taskPhoto.create({ data: { deliveryRequestId: dl.id, mime: "image/png", size: PNG.length, data: new Uint8Array(PNG), uploadedById: k1.id } });
  await advanceDelivery(aK1, dl.id, "BERHASIL_DIANTAR", at(3, 11));
  // permintaan jemput
  await createPickup(aKasir, { name: customers[5].name, phone: customers[5].phone, address: customers[5].address ?? "-", mapsUrl: "https://maps.google.com/?q=3.5896,98.6738", scheduledAt: new Date(Date.now() + 2 * 3600000), courierId: c1.id, fee: 5000, courierPay: 5000, notes: "Rumah pagar hijau", customerId: customers[5].id });
  const pk2 = await createPickup(aKasir, { name: "Pak Tono", phone: "081377778888", address: "Jl. Sei Batang Hari 7", scheduledAt: new Date(Date.now() + 5 * 3600000), courierId: c1.id, fee: 5000 });
  await advancePickup(aK1, pk2.id, "KURIR_MENUJU_LOKASI");

  // pengeluaran
  for (let d = 10; d >= 0; d -= 2) {
    await createExpense(aOwner, { date: addDaysKey(today, -d), category: d % 4 ? "Deterjen & Bahan" : "Listrik & Air", amount: 45000 + d * 1000, description: "Belanja rutin" });
  }
  await createExpense(aOwner, { date: addDaysKey(today, -1), category: "Transportasi", amount: 20000, description: "Bensin motor" });
  return true;
}
