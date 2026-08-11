import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../../../src/app.js";
import type { EmailService } from "../../../src/email/email.service.js";
import type { PrismaClient } from "../../../src/generated/prisma/client.js";
import { createAccessToken } from "../../../src/core/security/jwt.js";
import { ApplicationRepository } from "../../../src/modules/applications/applications.repository.js";
import { ApplicationService } from "../../../src/modules/applications/applications.service.js";
import { AuthRepository } from "../../../src/modules/auth/auth.repository.js";
import { AuthService } from "../../../src/modules/auth/auth.service.js";
import { NoteRepository } from "../../../src/modules/notes/notes.repository.js";
import { NoteService } from "../../../src/modules/notes/notes.service.js";
import { clearTestDatabase, createTestPrismaClient } from "../../helpers/db.js";

const runDatabaseTests = Boolean(process.env.TEST_DATABASE_URL);

class TestEmailService implements EmailService {
  async sendVerificationEmail(_input: { email: string; token: string }): Promise<void> {
    void _input;
  }

  async sendPasswordResetEmail(_input: { email: string; token: string }): Promise<void> {
    void _input;
  }
}

describe.skipIf(!runDatabaseTests)("notes", () => {
  let prisma: PrismaClient;
  let app: Express;

  beforeAll(() => {
    prisma = createTestPrismaClient();
    app = createApp({
      checkDatabase: async () => undefined,
      authService: new AuthService(new AuthRepository(prisma), new TestEmailService()),
      applicationService: new ApplicationService(new ApplicationRepository(prisma)),
      noteService: new NoteService(new NoteRepository(prisma)),
    });
  });

  beforeEach(async () => {
    await clearTestDatabase(prisma);
  });

  afterAll(async () => {
    await clearTestDatabase(prisma);
    await prisma.$disconnect();
  });

  it("creates, lists, updates, and deletes notes for owned applications", async () => {
    const user = await prisma.user.create({ data: { email: "notes@example.test" } });
    const application = await prisma.application.create({
      data: { userId: user.id, company: "Tally", role: "Engineer" },
    });
    const accessToken = createAccessToken({ sub: user.id, emailVerified: false });

    const created = await request(app)
      .post(`/api/v1/applications/${application.id}/notes`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ content: "  Recruiter replied.  " });
    expect(created.status).toBe(201);
    expect(created.body.data.note.content).toBe("Recruiter replied.");
    const noteId = created.body.data.note.id as string;
    const listed = await request(app)
      .get(`/api/v1/applications/${application.id}/notes`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(listed.status).toBe(200);
    expect(listed.body.data.notes).toHaveLength(1);

    const updated = await request(app)
      .patch(`/api/v1/notes/${noteId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ content: "  Sent resume.  " });
    expect(updated.body.data.note.content).toBe("Sent resume.");
    await request(app)
      .delete(`/api/v1/notes/${noteId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    await expect(prisma.note.findUnique({ where: { id: noteId } })).resolves.toBeNull();
  });

  it("does not expose notes through another user's application", async () => {
    const user = await prisma.user.create({ data: { email: "notes-owner@example.test" } });
    const otherUser = await prisma.user.create({ data: { email: "notes-other@example.test" } });
    const application = await prisma.application.create({
      data: { userId: otherUser.id, company: "Private", role: "Engineer" },
    });
    const note = await prisma.note.create({
      data: { applicationId: application.id, content: "Private note" },
    });
    const accessToken = createAccessToken({ sub: user.id, emailVerified: false });
    await request(app)
      .get(`/api/v1/applications/${application.id}/notes`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(404);
    await request(app)
      .patch(`/api/v1/notes/${note.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ content: "Attempted update" })
      .expect(404);
    await request(app)
      .post(`/api/v1/applications/${application.id}/notes`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ content: "Attempted create" })
      .expect(404);
  });
});
