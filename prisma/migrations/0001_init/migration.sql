-- 0001_init: skema awal Laundry Management System

CREATE TYPE "Unit" AS ENUM ('KG', 'PCS');
CREATE TYPE "ServiceFlow" AS ENUM ('WASH_DRY', 'WASH_IRON', 'IRON_ONLY');
CREATE TYPE "OrderStatus" AS ENUM ('BARU', 'MENUNGGU_PROSES', 'DICUCI', 'DIKERINGKAN', 'DISETRIKA', 'DIKEMAS', 'SIAP_DIAMBIL', 'DALAM_PENGANTARAN', 'SELESAI', 'DIBATALKAN');
CREATE TYPE "PaymentStatus" AS ENUM ('BELUM_BAYAR', 'SEBAGIAN', 'LUNAS');
CREATE TYPE "Handover" AS ENUM ('AMBIL_SENDIRI', 'ANTAR');
CREATE TYPE "DiscountType" AS ENUM ('NONE', 'NOMINAL', 'PERCENT');
CREATE TYPE "PaymentKind" AS ENUM ('PAYMENT', 'REFUND');
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'QRIS', 'TRANSFER');
CREATE TYPE "TxStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED');
CREATE TYPE "PickupStatus" AS ENUM ('MENUNGGU_DIJEMPUT', 'KURIR_MENUJU_LOKASI', 'SUDAH_DIJEMPUT', 'DITERIMA_LAUNDRY', 'DIBATALKAN');
CREATE TYPE "DeliveryStatus" AS ENUM ('MENUNGGU_DIANTAR', 'DALAM_PENGANTARAN', 'BERHASIL_DIANTAR', 'DIBATALKAN');
CREATE TYPE "HistoryTrack" AS ENUM ('PRODUCTION', 'PAYMENT', 'PICKUP', 'DELIVERY');
CREATE TYPE "Membership" AS ENUM ('REGULER', 'SILVER', 'GOLD');
CREATE TYPE "LoyaltyType" AS ENUM ('EARN', 'ADJUST');

CREATE TABLE "roles" (
  "id" SERIAL PRIMARY KEY,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL
);
CREATE UNIQUE INDEX "roles_key_key" ON "roles"("key");

CREATE TABLE "permissions" (
  "id" SERIAL PRIMARY KEY,
  "key" TEXT NOT NULL,
  "description" TEXT NOT NULL
);
CREATE UNIQUE INDEX "permissions_key_key" ON "permissions"("key");

CREATE TABLE "role_permissions" (
  "roleId" INTEGER NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "permissionId" INTEGER NOT NULL REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  PRIMARY KEY ("roleId", "permissionId")
);

CREATE TABLE "users" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "username" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "phone" TEXT,
  "roleId" INTEGER NOT NULL REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
CREATE INDEX "users_roleId_idx" ON "users"("roleId");

CREATE TABLE "sessions" (
  "id" TEXT PRIMARY KEY,
  "userId" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "userAgent" TEXT
);
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

CREATE TABLE "login_attempts" (
  "id" SERIAL PRIMARY KEY,
  "key" TEXT NOT NULL,
  "success" BOOLEAN NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "login_attempts_key_createdAt_idx" ON "login_attempts"("key", "createdAt");

CREATE TABLE "couriers" (
  "id" SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "phone" TEXT,
  "vehicle" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true
);
CREATE UNIQUE INDEX "couriers_userId_key" ON "couriers"("userId");

CREATE TABLE "customers" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "address" TEXT,
  "mapsUrl" TEXT,
  "notes" TEXT,
  "membership" "Membership" NOT NULL DEFAULT 'REGULER',
  "points" INTEGER NOT NULL DEFAULT 0,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "customers_points_check" CHECK ("points" >= 0)
);
CREATE INDEX "customers_phone_idx" ON "customers"("phone");
CREATE INDEX "customers_name_idx" ON "customers"("name");

CREATE TABLE "services" (
  "id" SERIAL PRIMARY KEY,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "unit" "Unit" NOT NULL,
  "flow" "ServiceFlow" NOT NULL,
  "price" INTEGER NOT NULL,
  "expressPrice" INTEGER NOT NULL,
  "estimateHours" INTEGER NOT NULL,
  "expressEstimateHours" INTEGER NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "services_price_check" CHECK ("price" >= 0 AND "expressPrice" >= 0)
);
CREATE UNIQUE INDEX "services_code_key" ON "services"("code");

CREATE TABLE "orders" (
  "id" SERIAL PRIMARY KEY,
  "number" TEXT NOT NULL,
  "refCode" TEXT NOT NULL,
  "idempotencyKey" TEXT,
  "customerId" INTEGER NOT NULL REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "createdById" INTEGER NOT NULL,
  "assignedOperatorId" INTEGER,
  "status" "OrderStatus" NOT NULL DEFAULT 'BARU',
  "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'BELUM_BAYAR',
  "handover" "Handover" NOT NULL DEFAULT 'AMBIL_SENDIRI',
  "subtotal" INTEGER NOT NULL,
  "discountType" "DiscountType" NOT NULL DEFAULT 'NONE',
  "discountValue" INTEGER NOT NULL DEFAULT 0,
  "discountAmount" INTEGER NOT NULL DEFAULT 0,
  "extraFee" INTEGER NOT NULL DEFAULT 0,
  "extraFeeNote" TEXT,
  "pickupFee" INTEGER NOT NULL DEFAULT 0,
  "deliveryFee" INTEGER NOT NULL DEFAULT 0,
  "total" INTEGER NOT NULL,
  "paidAmount" INTEGER NOT NULL DEFAULT 0,
  "refundedAmount" INTEGER NOT NULL DEFAULT 0,
  "estimatedDoneAt" TIMESTAMP(3),
  "notes" TEXT,
  "cancelReason" TEXT,
  "cancelledAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "orders_money_check" CHECK ("subtotal" >= 0 AND "discountAmount" >= 0 AND "discountAmount" <= "subtotal" AND "extraFee" >= 0 AND "pickupFee" >= 0 AND "deliveryFee" >= 0 AND "total" >= 0),
  CONSTRAINT "orders_paid_check" CHECK ("paidAmount" >= 0 AND "refundedAmount" >= 0 AND "refundedAmount" <= "paidAmount" AND "paidAmount" <= "total")
);
CREATE UNIQUE INDEX "orders_number_key" ON "orders"("number");
CREATE UNIQUE INDEX "orders_refCode_key" ON "orders"("refCode");
CREATE UNIQUE INDEX "orders_idempotencyKey_key" ON "orders"("idempotencyKey");
CREATE INDEX "orders_customerId_idx" ON "orders"("customerId");
CREATE INDEX "orders_status_idx" ON "orders"("status");
CREATE INDEX "orders_paymentStatus_idx" ON "orders"("paymentStatus");
CREATE INDEX "orders_createdAt_idx" ON "orders"("createdAt");
CREATE INDEX "orders_assignedOperatorId_idx" ON "orders"("assignedOperatorId");

CREATE TABLE "order_items" (
  "id" SERIAL PRIMARY KEY,
  "orderId" INTEGER NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "serviceId" INTEGER NOT NULL REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "serviceName" TEXT NOT NULL,
  "unit" "Unit" NOT NULL,
  "flow" "ServiceFlow" NOT NULL,
  "express" BOOLEAN NOT NULL DEFAULT false,
  "unitPrice" INTEGER NOT NULL,
  "quantity" DECIMAL(10,3) NOT NULL,
  "lineTotal" INTEGER NOT NULL,
  "notes" TEXT,
  CONSTRAINT "order_items_qty_check" CHECK ("quantity" > 0 AND "unitPrice" >= 0 AND "lineTotal" >= 0)
);
CREATE INDEX "order_items_orderId_idx" ON "order_items"("orderId");
CREATE INDEX "order_items_serviceId_idx" ON "order_items"("serviceId");

CREATE TABLE "payments" (
  "id" SERIAL PRIMARY KEY,
  "orderId" INTEGER NOT NULL REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "kind" "PaymentKind" NOT NULL DEFAULT 'PAYMENT',
  "method" "PaymentMethod" NOT NULL,
  "amount" INTEGER NOT NULL,
  "status" "TxStatus" NOT NULL DEFAULT 'CONFIRMED',
  "idempotencyKey" TEXT,
  "qrisCode" TEXT,
  "gatewayRef" TEXT,
  "note" TEXT,
  "createdById" INTEGER,
  "confirmedById" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "confirmedAt" TIMESTAMP(3),
  CONSTRAINT "payments_amount_check" CHECK ("amount" > 0)
);
CREATE UNIQUE INDEX "payments_idempotencyKey_key" ON "payments"("idempotencyKey");
CREATE UNIQUE INDEX "payments_qrisCode_key" ON "payments"("qrisCode");
CREATE UNIQUE INDEX "payments_gatewayRef_key" ON "payments"("gatewayRef");
CREATE INDEX "payments_orderId_idx" ON "payments"("orderId");
CREATE INDEX "payments_status_confirmedAt_idx" ON "payments"("status", "confirmedAt");

CREATE TABLE "pickup_requests" (
  "id" SERIAL PRIMARY KEY,
  "number" TEXT NOT NULL,
  "customerId" INTEGER REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "orderId" INTEGER REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "name" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "mapsUrl" TEXT,
  "scheduledAt" TIMESTAMP(3) NOT NULL,
  "courierId" INTEGER REFERENCES "couriers"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "fee" INTEGER NOT NULL DEFAULT 0,
  "courierPay" INTEGER NOT NULL DEFAULT 0,
  "notes" TEXT,
  "status" "PickupStatus" NOT NULL DEFAULT 'MENUNGGU_DIJEMPUT',
  "createdById" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "pickup_fee_check" CHECK ("fee" >= 0 AND "courierPay" >= 0)
);
CREATE UNIQUE INDEX "pickup_requests_number_key" ON "pickup_requests"("number");
CREATE UNIQUE INDEX "pickup_requests_orderId_key" ON "pickup_requests"("orderId");
CREATE INDEX "pickup_requests_courierId_status_idx" ON "pickup_requests"("courierId", "status");
CREATE INDEX "pickup_requests_scheduledAt_idx" ON "pickup_requests"("scheduledAt");

CREATE TABLE "delivery_requests" (
  "id" SERIAL PRIMARY KEY,
  "number" TEXT NOT NULL,
  "orderId" INTEGER NOT NULL REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "name" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "mapsUrl" TEXT,
  "scheduledAt" TIMESTAMP(3) NOT NULL,
  "courierId" INTEGER REFERENCES "couriers"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "fee" INTEGER NOT NULL DEFAULT 0,
  "courierPay" INTEGER NOT NULL DEFAULT 0,
  "notes" TEXT,
  "status" "DeliveryStatus" NOT NULL DEFAULT 'MENUNGGU_DIANTAR',
  "createdById" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "delivery_fee_check" CHECK ("fee" >= 0 AND "courierPay" >= 0)
);
CREATE UNIQUE INDEX "delivery_requests_number_key" ON "delivery_requests"("number");
CREATE UNIQUE INDEX "delivery_requests_orderId_key" ON "delivery_requests"("orderId");
CREATE INDEX "delivery_requests_courierId_status_idx" ON "delivery_requests"("courierId", "status");
CREATE INDEX "delivery_requests_scheduledAt_idx" ON "delivery_requests"("scheduledAt");

CREATE TABLE "order_status_history" (
  "id" SERIAL PRIMARY KEY,
  "track" "HistoryTrack" NOT NULL,
  "orderId" INTEGER REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "pickupRequestId" INTEGER REFERENCES "pickup_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "deliveryRequestId" INTEGER REFERENCES "delivery_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "fromStatus" TEXT,
  "toStatus" TEXT NOT NULL,
  "userId" INTEGER,
  "userName" TEXT,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "order_status_history_orderId_createdAt_idx" ON "order_status_history"("orderId", "createdAt");
CREATE INDEX "order_status_history_pickupRequestId_idx" ON "order_status_history"("pickupRequestId");
CREATE INDEX "order_status_history_deliveryRequestId_idx" ON "order_status_history"("deliveryRequestId");
CREATE INDEX "order_status_history_userId_createdAt_idx" ON "order_status_history"("userId", "createdAt");

CREATE TABLE "task_photos" (
  "id" SERIAL PRIMARY KEY,
  "pickupRequestId" INTEGER REFERENCES "pickup_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "deliveryRequestId" INTEGER REFERENCES "delivery_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "mime" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "data" BYTEA NOT NULL,
  "uploadedById" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "task_photos_pickupRequestId_idx" ON "task_photos"("pickupRequestId");
CREATE INDEX "task_photos_deliveryRequestId_idx" ON "task_photos"("deliveryRequestId");

CREATE TABLE "expenses" (
  "id" SERIAL PRIMARY KEY,
  "date" DATE NOT NULL,
  "category" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "description" TEXT,
  "pickupRequestId" INTEGER REFERENCES "pickup_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "deliveryRequestId" INTEGER REFERENCES "delivery_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "createdById" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "expenses_amount_check" CHECK ("amount" > 0)
);
CREATE INDEX "expenses_date_idx" ON "expenses"("date");
CREATE INDEX "expenses_category_idx" ON "expenses"("category");

CREATE TABLE "loyalty_ledger" (
  "id" SERIAL PRIMARY KEY,
  "customerId" INTEGER NOT NULL REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "orderId" INTEGER REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "type" "LoyaltyType" NOT NULL,
  "points" INTEGER NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "loyalty_ledger_orderId_type_key" ON "loyalty_ledger"("orderId", "type");
CREATE INDEX "loyalty_ledger_customerId_createdAt_idx" ON "loyalty_ledger"("customerId", "createdAt");

CREATE TABLE "business_settings" (
  "id" INTEGER PRIMARY KEY DEFAULT 1,
  "name" TEXT NOT NULL DEFAULT 'Laundry',
  "address" TEXT NOT NULL DEFAULT '',
  "whatsapp" TEXT NOT NULL DEFAULT '',
  "logoDataUrl" TEXT,
  "receiptFooter" TEXT NOT NULL DEFAULT 'Terima kasih telah mempercayakan cucian Anda.',
  "receiptWidth" INTEGER NOT NULL DEFAULT 58,
  "printerName" TEXT NOT NULL DEFAULT '',
  "showLogoOnReceipt" BOOLEAN NOT NULL DEFAULT true,
  "defaultPickupFee" INTEGER NOT NULL DEFAULT 5000,
  "defaultDeliveryFee" INTEGER NOT NULL DEFAULT 5000,
  "pointsPerAmount" INTEGER NOT NULL DEFAULT 10000,
  "pointsEnabled" BOOLEAN NOT NULL DEFAULT true,
  "qrisStaticPayload" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "business_settings_singleton" CHECK ("id" = 1)
);

CREATE TABLE "activity_logs" (
  "id" SERIAL PRIMARY KEY,
  "userId" INTEGER,
  "userName" TEXT,
  "action" TEXT NOT NULL,
  "entity" TEXT,
  "entityId" TEXT,
  "detail" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "activity_logs_createdAt_idx" ON "activity_logs"("createdAt");
CREATE INDEX "activity_logs_userId_idx" ON "activity_logs"("userId");

CREATE TABLE "doc_sequences" (
  "key" TEXT PRIMARY KEY,
  "last" INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE "gateway_notifications" (
  "id" SERIAL PRIMARY KEY,
  "provider" TEXT NOT NULL,
  "externalId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "gateway_notifications_provider_externalId_status_key" ON "gateway_notifications"("provider", "externalId", "status");
