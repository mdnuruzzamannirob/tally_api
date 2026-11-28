import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { DEMO_DOMAIN, seedDemoWorkspace } from "../src/modules/demo/demo.fixture.js";

if (process.env.NODE_ENV === "production")
  throw new Error("CLI seeding is disabled in production. Use the isolated demo profile.");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const password = process.env.TALLY_SEED_PASSWORD;
if (!password || password.length < 12 || Buffer.byteLength(password) > 72)
  throw new Error(
    "Set TALLY_SEED_PASSWORD to a unique 12-72 byte password. No default password is provided.",
  );
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
try {
  const user = await prisma.$transaction(
    async (tx) => {
      const created = await tx.user.create({
        data: {
          email: `${randomUUID()}${DEMO_DOMAIN}`,
          name: "Demo Visitor",
          passwordHash: await bcrypt.hash(password, 12),
          emailVerified: true,
          emailVerifiedAt: new Date(),
        },
      });
      await seedDemoWorkspace(tx, created.id);
      return created;
    },
    { timeout: 15000 },
  );
  console.info(`Development fixture created for ${user.email}. Existing users were not modified.`);
} finally {
  await prisma.$disconnect();
}
