-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('WISHLIST', 'APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'REJECTED', 'WITHDRAWN');
CREATE TYPE "RemoteType" AS ENUM ('ONSITE', 'REMOTE', 'HYBRID');
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'CONTRACT', 'INTERNSHIP');
CREATE TYPE "InterviewType" AS ENUM ('PHONE', 'TECHNICAL', 'HR', 'SYSTEM_DESIGN', 'ONSITE', 'OTHER');
CREATE TYPE "InterviewStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateTable
CREATE TABLE "applications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "job_url" TEXT,
    "location" TEXT,
    "remote_type" "RemoteType",
    "employment_type" "EmploymentType",
    "source" TEXT,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'WISHLIST',
    "applied_at" DATE,
    "salary_min" DECIMAL(12,2),
    "salary_max" DECIMAL(12,2),
    "currency" CHAR(3),
    "next_follow_up_at" TIMESTAMPTZ(3),
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "applications_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "applications_salary_min_nonnegative" CHECK ("salary_min" IS NULL OR "salary_min" >= 0),
    CONSTRAINT "applications_salary_max_nonnegative" CHECK ("salary_max" IS NULL OR "salary_max" >= 0),
    CONSTRAINT "applications_salary_range_valid" CHECK (
      "salary_min" IS NULL OR "salary_max" IS NULL OR "salary_max" >= "salary_min"
    ),
    CONSTRAINT "applications_currency_format" CHECK ("currency" IS NULL OR "currency" ~ '^[A-Z]{3}$'),
    CONSTRAINT "applications_salary_currency_required" CHECK (
      ("salary_min" IS NULL AND "salary_max" IS NULL) OR "currency" IS NOT NULL
    )
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tags_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "tags_name_length" CHECK (char_length("name") BETWEEN 1 AND 50)
);

-- CreateTable
CREATE TABLE "application_tags" (
    "application_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,
    "assigned_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "application_tags_pkey" PRIMARY KEY ("application_id", "tag_id")
);

-- CreateTable
CREATE TABLE "notes" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "notes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "notes_content_length" CHECK (char_length("content") BETWEEN 1 AND 5000)
);

-- CreateTable
CREATE TABLE "interviews" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "type" "InterviewType" NOT NULL,
    "scheduled_at" TIMESTAMPTZ(3) NOT NULL,
    "interviewer_name" TEXT,
    "meeting_link" TEXT,
    "location" TEXT,
    "notes" TEXT,
    "status" "InterviewStatus" NOT NULL DEFAULT 'SCHEDULED',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "interviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "status_history" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "from_status" "ApplicationStatus" NOT NULL,
    "to_status" "ApplicationStatus" NOT NULL,
    "note" TEXT,
    "changed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "applications_user_id_idx" ON "applications"("user_id");
CREATE INDEX "applications_user_id_status_idx" ON "applications"("user_id", "status");
CREATE INDEX "applications_user_id_updated_at_idx" ON "applications"("user_id", "updated_at");
CREATE INDEX "applications_user_id_next_follow_up_at_idx" ON "applications"("user_id", "next_follow_up_at");
CREATE INDEX "applications_user_id_applied_at_idx" ON "applications"("user_id", "applied_at");
CREATE UNIQUE INDEX "tags_user_id_name_key" ON "tags"("user_id", "name");
CREATE INDEX "tags_user_id_idx" ON "tags"("user_id");
CREATE INDEX "application_tags_tag_id_idx" ON "application_tags"("tag_id");
CREATE INDEX "notes_application_id_idx" ON "notes"("application_id");
CREATE INDEX "notes_application_id_created_at_idx" ON "notes"("application_id", "created_at");
CREATE INDEX "interviews_application_id_idx" ON "interviews"("application_id");
CREATE INDEX "interviews_application_id_scheduled_at_idx" ON "interviews"("application_id", "scheduled_at");
CREATE INDEX "status_history_application_id_idx" ON "status_history"("application_id");
CREATE INDEX "status_history_application_id_changed_at_idx" ON "status_history"("application_id", "changed_at");

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tags" ADD CONSTRAINT "tags_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "application_tags" ADD CONSTRAINT "application_tags_application_id_fkey"
  FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "application_tags" ADD CONSTRAINT "application_tags_tag_id_fkey"
  FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notes" ADD CONSTRAINT "notes_application_id_fkey"
  FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_application_id_fkey"
  FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "status_history" ADD CONSTRAINT "status_history_application_id_fkey"
  FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
