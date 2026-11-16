import { execSync } from "node:child_process";

export default function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgresql://postgres@localhost:5432/laundry_test";
  if (!/test/i.test(url)) throw new Error("TEST_DATABASE_URL harus mengarah ke database pengujian (nama memuat 'test').");
  process.env.DATABASE_URL = url;
  execSync("npx tsx scripts/migrate.mts --reset", { stdio: "inherit", env: { ...process.env, DATABASE_URL: url, NODE_ENV: "test" } });
}
