CREATE TABLE "parking_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slot_id" uuid,
	"license_plate" varchar(20) NOT NULL,
	"vehicle_type" varchar(20) NOT NULL,
	"entry_time" timestamp DEFAULT now() NOT NULL,
	"exit_time" timestamp,
	"duration_minutes" integer,
	"fee" integer DEFAULT 0,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"detection_confidence" integer,
	"entry_image_url" text,
	"exit_image_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parking_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slot_number" varchar(10) NOT NULL,
	"floor" integer DEFAULT 1 NOT NULL,
	"zone" varchar(5) NOT NULL,
	"is_occupied" boolean DEFAULT false NOT NULL,
	"vehicle_type" varchar(20),
	"license_plate" varchar(20),
	"camera_id" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "parking_slots_slot_number_unique" UNIQUE("slot_number")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" varchar(50) NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"role" varchar(20) DEFAULT 'user' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "parking_logs" ADD CONSTRAINT "parking_logs_slot_id_parking_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."parking_slots"("id") ON DELETE no action ON UPDATE no action;