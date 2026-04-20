DROP TABLE IF EXISTS "geofence_events" CASCADE;
DROP TABLE IF EXISTS "geofences" CASCADE;
DROP TABLE IF EXISTS "bus_status" CASCADE;
DROP TABLE IF EXISTS "drivers" CASCADE;
DROP TABLE IF EXISTS "admin_users" CASCADE;
DROP TABLE IF EXISTS "bipol_tracker" CASCADE;
DROP TABLE IF EXISTS "app_info" CASCADE;
DROP TABLE IF EXISTS "lost_items" CASCADE;
DROP TABLE IF EXISTS "feedback" CASCADE;
DROP TABLE IF EXISTS "app_settings" CASCADE;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE "admin_users" (
    "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    "username" VARCHAR(50) UNIQUE NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE "drivers" (
    "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    "bus_plate" VARCHAR(20) UNIQUE NOT NULL,
    "driver_name" VARCHAR(100),
    "password_hash" VARCHAR(255) NOT NULL,
    "current_status" VARCHAR(50) DEFAULT 'Off Duty',
    "created_at" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE "bipol_tracker" (
    "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    "bus_id" VARCHAR(20) NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "speed" DOUBLE PRECISION DEFAULT 0,
    "gas_level" INTEGER DEFAULT 0,
    "co2" INTEGER DEFAULT 0,
    "rssi" INTEGER DEFAULT 0,
    "created_at" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE "app_info" (
    "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    "title" VARCHAR(100) NOT NULL,
    "content" TEXT NOT NULL,
    "is_active" BOOLEAN DEFAULT TRUE,
    "created_at" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE "geofences" (
    "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    "name" VARCHAR(100) NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "radius_meters" INTEGER DEFAULT 100,
    "created_at" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE "geofence_events" (
    "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    "bus_id" VARCHAR(20) NOT NULL,
    "geofence_id" UUID REFERENCES "geofences"("id") ON DELETE SET NULL,
    "event_type" VARCHAR(20) NOT NULL,
    "timestamp" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE "lost_items" (
    "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    "bus_plate" VARCHAR(20) NOT NULL,
    "whatsapp_number" VARCHAR(20) NOT NULL,
    "message" TEXT NOT NULL,
    "status" VARCHAR(20) DEFAULT 'pending',
    "created_at" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE "feedback" (
    "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    "name" VARCHAR(100),
    "message" TEXT NOT NULL,
    "status" VARCHAR(20) DEFAULT 'pending',
    "created_at" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE "app_settings" (
    "key" VARCHAR(50) PRIMARY KEY,
    "value" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- Security Policies (RLS)
-- ==========================================

ALTER TABLE "bipol_tracker" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON "bipol_tracker" FOR SELECT USING (true);
CREATE POLICY "Public insert access" ON "bipol_tracker" FOR INSERT WITH CHECK (true);

ALTER TABLE "app_info" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON "app_info" FOR SELECT USING (true);

ALTER TABLE "app_settings" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON "app_settings" FOR SELECT USING (true);

-- ==========================================
-- Seed Data
-- ==========================================

-- Default Admin User (Password: admin123)
INSERT INTO "admin_users" ("username", "password_hash")
VALUES ('admin', '$2b$12$OFaetj2v25mybHEiXp2y6.6hU9iZXx0yx49T5B05sqgtxRFsq.tka')
ON CONFLICT ("username") DO NOTHING;

-- Default App Settings
INSERT INTO "app_settings" ("key", "value", "description")
VALUES
('GAS_ALERT_THRESHOLD', '600', 'Ambang batas sensor gas'),
('BUS_STOP_TIMEOUT_MINUTES', '5', 'Waktu tunggu (menit) sebelum parkir'),
('UDP_MIN_SPEED_THRESHOLD', '3.0', 'Minimum kecepatan (km/h) bus bergerak')
ON CONFLICT ("key") DO NOTHING;

-- Default Geofences (Bus Stops)
INSERT INTO "geofences" ("name", "latitude", "longitude", "radius_meters", "created_at")
VALUES
('Halte PNJ', -6.371168, 106.823983, 100, NOW()),
('Halte St. UI', -6.360951, 106.831581, 100, NOW()),
('Halte Pondok Cina', -6.368193, 106.831678, 100, NOW()),
('Halte Menwa', -6.353486, 106.831739, 100, NOW())
ON CONFLICT DO NOTHING;

