/** Dipanggil saat build/deploy: migrasi → data dasar → (opsional) data demo. */
await import("./migrate.mts");
const { seedBase } = await import("../src/server/seed");
await seedBase();
console.log("✔ Data dasar (peran, izin, pengaturan, layanan) siap.");
if (process.env.DEMO_SEED === "true") {
  const { seedDemo } = await import("../src/server/seed-demo");
  const created = await seedDemo();
  console.log(created ? "✔ Data demo dibuat (password semua akun: demo1234)." : "Data demo dilewati (pengguna sudah ada).");
}
const { prisma } = await import("../src/server/db");
await prisma.$disconnect();
