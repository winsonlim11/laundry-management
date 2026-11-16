import { prisma } from "./db";
import { DEFAULT_ROLE_PERMISSIONS, PERMISSIONS, ROLE_KEYS, ROLE_NAMES } from "@/lib/permissions";

/** Data dasar (wajib, aman dijalankan berulang): peran, izin, pengaturan usaha, katalog layanan awal. */
export async function seedBase() {
  for (const [key, description] of Object.entries(PERMISSIONS)) {
    await prisma.permission.upsert({ where: { key }, create: { key, description }, update: { description } });
  }
  const perms = await prisma.permission.findMany();
  const idOf = new Map(perms.map((p) => [p.key, p.id]));
  for (const key of ROLE_KEYS) {
    const role = await prisma.role.upsert({ where: { key }, create: { key, name: ROLE_NAMES[key] }, update: {} });
    const existing = await prisma.rolePermission.count({ where: { roleId: role.id } });
    // hanya isi izin awal bila peran belum punya izin (perubahan Owner dipertahankan); Owner selalu lengkap
    if (existing === 0 || key === "OWNER") {
      await prisma.rolePermission.createMany({
        data: DEFAULT_ROLE_PERMISSIONS[key].map((k) => ({ roleId: role.id, permissionId: idOf.get(k)! })),
        skipDuplicates: true,
      });
    }
  }
  await prisma.businessSetting.upsert({ where: { id: 1 }, create: { id: 1, name: "Laundry" }, update: {} });
  if ((await prisma.service.count()) === 0) {
    await prisma.service.createMany({
      data: [
        { code: "CK", name: "Cuci Kering", unit: "KG", flow: "WASH_DRY", price: 6000, expressPrice: 9000, estimateHours: 48, expressEstimateHours: 24, sortOrder: 1 },
        { code: "CS", name: "Cuci Setrika", unit: "KG", flow: "WASH_IRON", price: 8000, expressPrice: 12000, estimateHours: 48, expressEstimateHours: 24, sortOrder: 2 },
        { code: "SS", name: "Setrika Saja", unit: "KG", flow: "IRON_ONLY", price: 5000, expressPrice: 7500, estimateHours: 24, expressEstimateHours: 8, sortOrder: 3 },
        { code: "BC", name: "Bed Cover", unit: "PCS", flow: "WASH_DRY", price: 25000, expressPrice: 35000, estimateHours: 72, expressEstimateHours: 24, sortOrder: 4 },
        { code: "JS", name: "Jas / Kemeja Satuan", unit: "PCS", flow: "WASH_IRON", price: 5000, expressPrice: 8000, estimateHours: 48, expressEstimateHours: 24, sortOrder: 5 },
      ],
    });
  }
}
