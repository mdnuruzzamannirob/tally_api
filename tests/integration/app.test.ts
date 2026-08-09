import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../../src/app.js";

describe("API application", () => {
  it("returns the healthy database response with a request ID", async () => {
    const app = createApp({ checkDatabase: async () => undefined });
    const response = await request(app).get("/api/v1/health").set("X-Request-ID", "health-check-1");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: expect.objectContaining({ status: "ok", database: "connected" }),
    });
    expect(response.headers["x-request-id"]).toBe("health-check-1");
  });

  it("returns a 503 envelope when the database is unavailable", async () => {
    const app = createApp({ checkDatabase: async () => Promise.reject(new Error("offline")) });
    const response = await request(app).get("/api/v1/health");

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: "SERVICE_UNAVAILABLE", message: "Service temporarily unavailable." },
    });
    expect(response.body.error.requestId).toEqual(expect.any(String));
  });

  it("returns a structured 404 envelope", async () => {
    const app = createApp({ checkDatabase: async () => undefined });
    const response = await request(app).get("/api/v1/missing");

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ success: false, error: { code: "NOT_FOUND" } });
  });

  it("returns a structured error for malformed JSON", async () => {
    const app = createApp({ checkDatabase: async () => undefined });
    const response = await request(app)
      .post("/api/v1/health")
      .set("Content-Type", "application/json")
      .send("{");

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ success: false, error: { code: "BAD_REQUEST" } });
  });
});
