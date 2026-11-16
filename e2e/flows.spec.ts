/**
 * Alur pengguna utama (butuh server berjalan dengan DEMO_SEED=true, lihat docs/TESTING.md).
 */
import { expect, test, type Page, type APIRequestContext, request as pwRequest } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3100";

async function login(page: Page, username: string) {
  await page.goto("/login");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Kata sandi").fill("demo1234");
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

async function apiAs(username: string): Promise<APIRequestContext> {
  const ctx = await pwRequest.newContext({ baseURL: BASE, extraHTTPHeaders: { "x-requested-with": "laundry-app", origin: BASE } });
  const r = await ctx.post("/api/auth/login", { data: { username, password: "demo1234" } });
  expect(r.ok()).toBeTruthy();
  return ctx;
}

test("kasir: pelanggan baru → nota multi-item + DP → struk → pindai → profil", async ({ page }) => {
  await login(page, "kasir");
  await page.goto("/kasir");
  const phone = "0812" + String(Date.now()).slice(-8);
  await page.getByRole("button", { name: "Baru" }).click();
  await page.getByLabel("Nama").fill("Pelanggan E2E");
  await page.getByLabel("WhatsApp").fill(phone);
  await page.getByRole("button", { name: "Simpan pelanggan" }).click();
  await expect(page.getByText("Pelanggan E2E")).toBeVisible();

  await page.getByRole("button", { name: /Cuci Setrika/ }).click();
  await page.locator('input[placeholder="0,0"]').first().fill("2,5");
  await page.getByRole("button", { name: /Jas \/ Kemeja Satuan/ }).click();
  await page.locator('input[inputmode="numeric"][placeholder="1"]').fill("3");
  await page.getByLabel("Jenis diskon").selectOption("PERCENT");
  await page.getByLabel("Diskon (%)").fill("10");
  await page.getByLabel("Serah terima").selectOption("ANTAR");
  await page.getByLabel("Biaya antar (Rp)").fill("5000");
  await expect(page.getByText("Subtotal layanan").locator("..")).toContainText("Rp35.000");
  await expect(page.locator("dl").getByText("Total", { exact: true }).locator("..")).toContainText("Rp36.500");
  await page.getByLabel("Nominal DP").fill("10000");
  await expect(page.getByText("Sisa tagihan").locator("..")).toContainText("Rp26.500");
  await page.getByRole("button", { name: "Simpan nota" }).click();
  await page.waitForURL(/\/pesanan\/\d+\?baru=1/);
  await expect(page.getByText("Nota tersimpan")).toBeVisible();
  const orderUrl = page.url();
  const refCode = (await page.getByText(/Kode nota/).textContent())!.match(/Kode nota\s+(\w+)/)![1];

  // struk
  const id = orderUrl.match(/pesanan\/(\d+)/)![1];
  await page.goto(`/struk/${id}`);
  await expect(page.locator("article")).toContainText("SISA");
  await expect(page.locator("article")).toContainText("Rp26.500");
  await expect(page.locator("article svg").first()).toBeVisible();
  await page.screenshot({ path: "e2e/screens/struk.png", fullPage: true });

  // pindai (scanner USB = mengetik kode + Enter)
  await page.goto("/scan");
  await page.getByLabel("Kode / nomor nota").fill(refCode);
  await page.keyboard.press("Enter");
  await page.waitForURL(new RegExp(`/pesanan/${id}$`));

  // profil pelanggan
  await page.getByRole("link", { name: "Pelanggan E2E" }).click();
  await page.waitForURL(/\/pelanggan\/\d+/);
  await expect(page.getByRole("heading", { name: "Pelanggan E2E" })).toBeVisible();
  await expect(page.getByText("Sisa tagihan", { exact: true }).locator("../..")).toContainText("Rp26.500");
  await expect(page.getByRole("link", { name: /LND-/ })).toBeVisible();
  await page.screenshot({ path: "e2e/screens/profil-pelanggan.png", fullPage: true });
});

test("API: kurir lain ditolak membuka & mengubah tugas milik kurir lain", async () => {
  const k1 = await apiAs("kurir");
  const k2 = await apiAs("kurir2");
  const mine = await (await k1.get("/api/courier/tasks")).json();
  const task = mine.deliveries[0] ?? mine.pickups[0];
  const type = mine.deliveries[0] ? "delivery" : "pickup";
  expect(task).toBeTruthy();
  expect((await k1.get(`/api/tasks/${type}/${task.id}`)).status()).toBe(200);
  const r = await k2.get(`/api/tasks/${type}/${task.id}`);
  expect(r.status()).toBe(403);
  const r2 = await k2.post(`/api/${type === "delivery" ? "deliveries" : "pickups"}/${task.id}/status`, { data: { to: type === "delivery" ? "DALAM_PENGANTARAN" : "SUDAH_DIJEMPUT" } });
  expect(r2.status()).toBe(403);
  // kurir tidak boleh melihat laporan/ekspor/backup
  expect((await k2.get("/api/reports/export?format=xlsx&from=2026-01-01&to=2026-01-31")).status()).toBe(403);
  expect((await k2.get("/api/backup")).status()).toBe(403);
  expect((await k2.get("/api/orders/1")).status()).toBe(403);
});

test("keamanan: CSRF & tanpa sesi", async () => {
  const anon = await pwRequest.newContext({ baseURL: BASE });
  expect((await anon.get("/api/orders")).status()).toBe(401);
  const kasir = await apiAs("kasir");
  const noHeader = await pwRequest.newContext({ baseURL: BASE, storageState: await kasir.storageState() });
  const r = await noHeader.post("/api/customers", { data: { name: "Hack", phone: "081200000000" }, headers: { origin: "https://evil.example" } });
  expect(r.status()).toBe(403);
});

test("kurir ponsel: mulai antar → unggah bukti → konfirmasi → pesanan selesai", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "id-ID", timezoneId: "Asia/Jakarta" });
  const page = await ctx.newPage();
  await login(page, "kurir");
  await page.waitForURL(/\/kurir/);
  await page.screenshot({ path: "e2e/screens/kurir-mobile.png", fullPage: true });
  await page.getByRole("link", { name: /ANTAR/ }).first().click();
  await expect(page.getByRole("link", { name: /Maps/ })).toBeVisible();
  const start = page.getByRole("button", { name: "Mulai antar" });
  if (await start.isVisible()) { await start.click(); await expect(page.getByRole("button", { name: /Konfirmasi diterima/ })).toBeVisible(); }
  await expect(page.getByRole("button", { name: /Konfirmasi diterima/ })).toBeDisabled();
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
  await page.locator("#photo").setInputFiles({ name: "bukti.png", mimeType: "image/png", buffer: png });
  await expect(page.getByText("Foto bukti (1)")).toBeVisible();
  await page.screenshot({ path: "e2e/screens/kurir-tugas-mobile.png", fullPage: true });
  await page.getByRole("button", { name: /Konfirmasi diterima/ }).click();
  await expect(page.getByText("Berhasil Diantar").first()).toBeVisible();
  await ctx.close();
});

test("operator: tahapan Setrika Saja + kasir serah terima", async ({ page }) => {
  const kasir = await apiAs("kasir");
  const owner = await apiAs("owner");
  const cust = await (await kasir.post("/api/customers", { data: { name: "Bu Setrika", phone: "081299991234" } })).json();
  const services = await (await kasir.get("/api/services")).json();
  const ss = services.find((s: { code: string }) => s.code === "SS");
  const users = await (await owner.get("/api/users")).json();
  const op = users.find((u: { username: string }) => u.username === "operator");
  const { order } = await (await kasir.post("/api/orders", { data: { customerId: cust.id, items: [{ serviceId: ss.id, quantity: "2" }] } })).json();
  expect((await owner.post(`/api/orders/${order.id}/assign`, { data: { operatorId: op.id } })).ok()).toBeTruthy();
  const opApi = await apiAs("operator");
  const bad = await opApi.post(`/api/orders/${order.id}/status`, { data: { to: "DICUCI" } });
  expect(bad.status()).toBe(400);
  await login(page, "operator");
  await page.goto("/produksi");
  const card = page.locator("li", { hasText: order.number });
  for (const step of ["Disetrika", "Dikemas", "Siap Diambil"]) {
    await card.getByRole("button", { name: step }).click();
    await expect(page.getByText(`${order.number}: ${step}`)).toBeVisible();
  }
  await page.goto(`/pesanan/${order.id}`);
  await expect(page.getByText("Disetrika").first()).toBeVisible();
  const done = await kasir.post(`/api/orders/${order.id}/status`, { data: { to: "SELESAI" } });
  expect(done.ok()).toBeTruthy();
});

for (const [name, vp] of [["desktop", { width: 1440, height: 900 }], ["tablet", { width: 820, height: 1180 }], ["ponsel", { width: 390, height: 844 }]] as const) {
  test(`tampilan ${name}: dashboard, kasir, laporan, pesanan`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: vp, locale: "id-ID", timezoneId: "Asia/Jakarta" });
    const page = await ctx.newPage();
    await login(page, "owner");
    for (const path of ["/", "/kasir", "/laporan", "/pesanan", "/produksi", "/pengaturan"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await expect(page.getByRole("heading", { name: "Terjadi kesalahan" }), `${path} error di ${name}`).toHaveCount(0);
      await expect(page.locator("h1").first()).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${path} melebar horizontal di ${name}`).toBeLessThanOrEqual(1);
      await page.screenshot({ path: `e2e/screens/${name}${path === "/" ? "-dashboard" : path.replace(/\//g, "-")}.png`, fullPage: false });
    }
    await ctx.close();
  });
}
