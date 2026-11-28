import type { Prisma } from "../../generated/prisma/client.js";

export const DEMO_DOMAIN = "@demo.tally.invalid";
export const DEMO_LIFETIME_MS = 24 * 60 * 60_000;

/** Fictional companies and people; dates remain useful whenever a workspace is created. */
export async function seedDemoWorkspace(
  tx: Prisma.TransactionClient,
  userId: string,
  now = new Date(),
): Promise<void> {
  const day = (offset: number) =>
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offset, 14));
  await tx.application.deleteMany({ where: { userId } });
  await tx.tag.deleteMany({ where: { userId } });
  const remote = await tx.tag.create({ data: { userId, name: "remote", color: "#3B82F6" } });
  const referral = await tx.tag.create({ data: { userId, name: "referral", color: "#22C55E" } });
  const roles = [
    { company: "Cedar Atlas", role: "Full Stack Developer", status: "INTERVIEW", ago: 12 },
    { company: "Harbor Finch", role: "Backend Engineer", status: "SCREENING", ago: 8 },
    { company: "Juniper Circuit", role: "Frontend Engineer", status: "APPLIED", ago: 4 },
    { company: "Lantern Grove", role: "Software Engineer", status: "OFFER", ago: 21 },
    { company: "Copper Meadow", role: "Platform Developer", status: "REJECTED", ago: 28 },
    { company: "Willow Parcel", role: "Product Engineer", status: "WISHLIST", ago: 0 },
    { company: "Pebble Orchard", role: "Web Developer", status: "WITHDRAWN", ago: 18 },
    { company: "Maple Beacon", role: "API Developer", status: "APPLIED", ago: 32 },
  ] as const;
  for (const [index, item] of roles.entries()) {
    await tx.application.create({
      data: {
        userId,
        company: item.company,
        role: item.role,
        status: item.status,
        location: "Remote",
        remoteType: "REMOTE",
        employmentType: "FULL_TIME",
        source: index === 0 ? "Referral" : "Company website",
        appliedAt: item.status === "WISHLIST" ? null : day(-item.ago),
        createdAt: day(-item.ago),
        updatedAt: day(-item.ago),
        nextFollowUpAt: index === 1 ? day(0) : null,
        archivedAt: index === 7 ? day(-10) : null,
        tags: { create: [{ tagId: remote.id }, ...(index === 0 ? [{ tagId: referral.id }] : [])] },
        notes: {
          create: {
            content:
              index === 0
                ? "Prepare an API design example and discuss transaction boundaries."
                : "Fictional sample application for exploring Tally.",
          },
        },
        ...(index === 0
          ? {
              interviews: {
                create: [
                  {
                    type: "PHONE",
                    scheduledAt: day(-3),
                    status: "COMPLETED",
                    interviewerName: "Morgan Vale",
                    notes: "Discussed team responsibilities and interview format.",
                  },
                  {
                    type: "TECHNICAL",
                    scheduledAt: day(2),
                    interviewerName: "Riley Brook",
                    notes: "Prepare database and API examples. No real meeting link.",
                  },
                ],
              },
            }
          : {}),
        ...(item.status !== "WISHLIST"
          ? {
              statusHistory: {
                create: {
                  fromStatus: "WISHLIST",
                  toStatus: item.status,
                  changedAt: day(-item.ago),
                },
              },
            }
          : {}),
      },
    });
  }
}
