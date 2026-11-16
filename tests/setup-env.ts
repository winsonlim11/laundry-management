process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgresql://postgres@localhost:5432/laundry_test";
process.env.BUSINESS_TZ = "Asia/Jakarta";
