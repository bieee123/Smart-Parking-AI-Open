CREATE TABLE "reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"slot_id" uuid NOT NULL,
	"license_plate" varchar(20) NOT NULL,
	"vehicle_type" varchar(20) DEFAULT 'car' NOT NULL,
	"duration_hours" integer DEFAULT 1 NOT NULL,
	"start_time" timestamp DEFAULT now() NOT NULL,
	"end_time" timestamp NOT NULL,
	"estimated_fee" integer DEFAULT 0,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar(100) NOT NULL,
	"value" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "system_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "user_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"action" varchar(50) NOT NULL,
	"device_info" text,
	"ip_address" varchar(45),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "assigned_zones" SET DATA TYPE jsonb;--> statement-breakpoint
ALTER TABLE "parking_slots" ADD COLUMN "slot_type" varchar(20) DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE "parking_slots" ADD COLUMN "latitude" text;--> statement-breakpoint
ALTER TABLE "parking_slots" ADD COLUMN "longitude" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "security_stamp" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "language" varchar(10) DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "two_factor_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "two_factor_secret" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "two_factor_method" varchar(20) DEFAULT 'totp' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "two_factor_email_code" varchar(10);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "two_factor_email_expires" timestamp;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_slot_id_parking_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."parking_slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_activities" ADD CONSTRAINT "user_activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;