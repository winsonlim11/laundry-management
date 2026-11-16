// Daftar izin & hak awal per peran. Satu sumber kebenaran untuk seed, UI, dan server.

export const PERMISSIONS = {
  "dashboard.view": "Lihat dashboard operasional",
  "finance.view": "Lihat angka keuangan (penerimaan, piutang, laporan keuangan)",
  "orders.view_all": "Lihat semua pesanan",
  "orders.create": "Buat pesanan baru",
  "orders.cancel": "Batalkan pesanan",
  "payments.create": "Terima pembayaran",
  "payments.confirm": "Verifikasi pembayaran QRIS/transfer",
  "refunds.create": "Catat pengembalian dana",
  "customers.manage": "Kelola pelanggan",
  "production.assign": "Tugaskan pesanan ke operator",
  "production.update_any": "Perbarui pengerjaan semua pesanan",
  "production.update_assigned": "Perbarui pengerjaan pesanan yang ditugaskan",
  "logistics.manage": "Kelola jadwal jemput/antar dan penugasan kurir",
  "courier.tasks": "Kerjakan tugas jemput/antar milik sendiri",
  "services.manage": "Kelola katalog layanan & tarif",
  "reports.view": "Lihat & ekspor laporan",
  "expenses.manage": "Catat pengeluaran",
  "users.manage": "Kelola pegawai operasional (Kasir, Operator, Kurir)",
  "users.manage_privileged": "Kelola Owner/Administrator & ubah izin peran",
  "settings.manage": "Kelola pengaturan operasional",
  "backup.manage": "Buat & unduh backup database",
  "activity.view": "Lihat log aktivitas",
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

export const ROLE_KEYS = ["OWNER", "ADMIN", "KASIR", "OPERATOR", "KURIR"] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];

export const ROLE_NAMES: Record<RoleKey, string> = {
  OWNER: "Owner",
  ADMIN: "Administrator",
  KASIR: "Kasir",
  OPERATOR: "Operator Laundry",
  KURIR: "Kurir",
};

const ALL = Object.keys(PERMISSIONS) as PermissionKey[];

export const DEFAULT_ROLE_PERMISSIONS: Record<RoleKey, PermissionKey[]> = {
  OWNER: ALL,
  ADMIN: [
    "dashboard.view",
    "orders.view_all",
    "orders.create",
    "customers.manage",
    "production.assign",
    "production.update_any",
    "logistics.manage",
    "services.manage",
    "users.manage",
    "settings.manage",
    "activity.view",
  ],
  KASIR: ["dashboard.view", "orders.view_all", "orders.create", "payments.create", "payments.confirm", "customers.manage", "logistics.manage"],
  OPERATOR: ["production.update_assigned"],
  KURIR: ["courier.tasks"],
};

/** Izin yang hanya boleh diberikan/diubah oleh pemegang users.manage_privileged (Owner). */
export const PRIVILEGED_PERMISSIONS: PermissionKey[] = [
  "finance.view",
  "reports.view",
  "refunds.create",
  "backup.manage",
  "users.manage_privileged",
];

/** Peran yang boleh dikelola Administrator tanpa otorisasi Owner. */
export const OPERATIONAL_ROLES: RoleKey[] = ["KASIR", "OPERATOR", "KURIR"];
