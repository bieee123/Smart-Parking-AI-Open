CREATE TABLE "ai_analysis_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"filename" text NOT NULL,
	"media_type" varchar(10) NOT NULL,
	"result_summary" text,
	"detailed_result" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cameras" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"type" varchar(20) NOT NULL,
	"status" varchar(20) DEFAULT 'online' NOT NULL,
	"zone" varchar(50),
	"stream_url" text,
	"last_active" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "traffic_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"camera_id" varchar(50) NOT NULL,
	"vehicle_count" integer DEFAULT 0 NOT NULL,
	"density_level" varchar(20) NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "parking_slots" ADD COLUMN "status" varchar(20) DEFAULT 'empty' NOT NULL;