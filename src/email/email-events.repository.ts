import type { PrismaClient } from "../generated/prisma/client.js";

export class EmailEventsRepository {
  constructor(private readonly client: PrismaClient) {}
  record(input: { id: string; messageId: string; type: string; occurredAt: Date }) {
    return this.client.emailDeliveryEvent.upsert({
      where: { id: input.id },
      create: input,
      update: {},
    });
  }
}
