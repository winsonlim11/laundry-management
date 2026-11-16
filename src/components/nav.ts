import type { PermissionKey } from "@/lib/permissions";

export type NavItem = { href: string; label: string; icon: string; perms: PermissionKey[]; mobile?: boolean };
export const NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: "LayoutDashboard", perms: ["dashboard.view"], mobile: true },
  { href: "/kasir", label: "Kasir", icon: "ShoppingBasket", perms: ["orders.create"], mobile: true },
  { href: "/pesanan", label: "Pesanan", icon: "ReceiptText", perms: ["orders.view_all"], mobile: true },
  { href: "/pelanggan", label: "Pelanggan", icon: "Users", perms: ["customers.manage"] },
  { href: "/produksi", label: "Produksi", icon: "WashingMachine", perms: ["production.update_assigned", "production.update_any", "production.assign"], mobile: true },
  { href: "/logistik", label: "Jemput & Antar", icon: "Truck", perms: ["logistics.manage"] },
  { href: "/kurir", label: "Tugas Kurir", icon: "Bike", perms: ["courier.tasks"], mobile: true },
  { href: "/scan", label: "Pindai Nota", icon: "ScanLine", perms: ["orders.view_all"] },
  { href: "/laporan", label: "Laporan", icon: "BarChart3", perms: ["reports.view"] },
  { href: "/pengeluaran", label: "Pengeluaran", icon: "Wallet", perms: ["expenses.manage"] },
  { href: "/pegawai", label: "Pegawai & Izin", icon: "UserCog", perms: ["users.manage", "users.manage_privileged"] },
  { href: "/pengaturan", label: "Pengaturan", icon: "Settings", perms: ["settings.manage", "services.manage", "backup.manage"] },
  { href: "/aktivitas", label: "Log Aktivitas", icon: "History", perms: ["activity.view"] },
];
