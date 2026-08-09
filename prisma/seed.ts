import bcrypt from "bcrypt";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

import { PrismaClient } from "../src/generated/prisma/client.js";

const DEMO_EMAIL = "demo@tally.local";
const DEMO_PASSWORD = "password123";

async function seed(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Seeding is disabled in production.");
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to seed the database.");
  }
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    const user = await prisma.user.upsert({
      where: { email: DEMO_EMAIL },
      create: {
        name: "Tally Demo",
        email: DEMO_EMAIL,
        passwordHash,
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
      update: {
        name: "Tally Demo",
        passwordHash,
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
    });

    await prisma.$transaction([
      prisma.application.deleteMany({ where: { userId: user.id } }),
      prisma.tag.deleteMany({ where: { userId: user.id } }),
    ]);

    const [priorityTag, remoteTag, referralTag] = await prisma.$transaction([
      prisma.tag.create({ data: { userId: user.id, name: "priority", color: "#EF4444" } }),
      prisma.tag.create({ data: { userId: user.id, name: "remote", color: "#3B82F6" } }),
      prisma.tag.create({ data: { userId: user.id, name: "referral", color: "#22C55E" } }),
    ]);

    const application = await prisma.application.create({
      data: {
        userId: user.id,
        company: "Acme Corporation",
        role: "Senior Software Engineer",
        location: "Remote",
        remoteType: "REMOTE",
        employmentType: "FULL_TIME",
        source: "Referral",
        status: "INTERVIEW",
        appliedAt: new Date("2026-08-01"),
        salaryMin: 120_000,
        salaryMax: 150_000,
        currency: "USD",
        nextFollowUpAt: new Date("2026-08-15T09:00:00.000Z"),
      },
    });

    await prisma.$transaction([
      prisma.applicationTag.create({
        data: { applicationId: application.id, tagId: priorityTag.id },
      }),
      prisma.applicationTag.create({
        data: { applicationId: application.id, tagId: remoteTag.id },
      }),
      prisma.note.create({
        data: {
          applicationId: application.id,
          content: "Hiring manager feedback was very positive.",
        },
      }),
      prisma.interview.create({
        data: {
          applicationId: application.id,
          type: "TECHNICAL",
          scheduledAt: new Date("2026-08-12T14:00:00.000Z"),
          interviewerName: "Alex Morgan",
          meetingLink: "https://meet.example.com/tally-demo",
        },
      }),
      prisma.statusHistory.create({
        data: { applicationId: application.id, fromStatus: "WISHLIST", toStatus: "APPLIED" },
      }),
      prisma.statusHistory.create({
        data: { applicationId: application.id, fromStatus: "APPLIED", toStatus: "INTERVIEW" },
      }),
    ]);

    const archivedApplication = await prisma.application.create({
      data: {
        userId: user.id,
        company: "Northstar Labs",
        role: "Platform Engineer",
        status: "REJECTED",
        appliedAt: new Date("2026-07-15"),
        archivedAt: new Date("2026-08-05T09:00:00.000Z"),
      },
    });
    await prisma.applicationTag.create({
      data: { applicationId: archivedApplication.id, tagId: referralTag.id },
    });

    console.info(`Seeded ${DEMO_EMAIL}. Demo password: ${DEMO_PASSWORD}`);
  } finally {
    await prisma.$disconnect();
  }
}

await seed();
