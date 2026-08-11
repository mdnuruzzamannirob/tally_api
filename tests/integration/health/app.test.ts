import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../../../src/app.js";

describe("API application", () => {
  it("returns the healthy database response with a request ID", async () => {
    const app = createApp({ checkDatabase: async () => undefined });
    const response = await request(app).get("/api/v1/health").set("X-Request-ID", "health-check-1");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      message: "Service is healthy.",
      data: expect.objectContaining({ status: "ok", database: "connected" }),
      meta: expect.objectContaining({ requestId: "health-check-1" }),
    });
    expect(response.headers["x-request-id"]).toBe("health-check-1");
  });

  it("returns a 503 envelope when the database is unavailable", async () => {
    const app = createApp({ checkDatabase: async () => Promise.reject(new Error("offline")) });
    const response = await request(app).get("/api/v1/health");

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({
      success: false,
      message: "Service temporarily unavailable.",
      error: { code: "SERVICE_UNAVAILABLE" },
    });
    expect(response.body.meta.requestId).toEqual(expect.any(String));
  });

  it("returns a structured 404 envelope", async () => {
    const app = createApp({ checkDatabase: async () => undefined });
    const response = await request(app).get("/api/v1/missing");

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ success: false, error: { code: "NOT_FOUND" } });
  });

  it("serves the versioned OpenAPI contract and Swagger UI", async () => {
    const app = createApp({ checkDatabase: async () => undefined });

    const contractResponse = await request(app).get("/api/v1/openapi.json");
    expect(contractResponse.status).toBe(200);
    expect(contractResponse.body).toMatchObject({
      openapi: "3.1.0",
      info: { title: "Tally API" },
      paths: expect.any(Object),
    });

    const docsRedirect = await request(app).get("/api/v1/docs");
    expect(docsRedirect.status).toBe(308);
    expect(docsRedirect.headers.location).toBe("/api/v1/docs/");

    const docsResponse = await request(app).get("/api/v1/docs/");
    expect(docsResponse.status).toBe(200);
    expect(docsResponse.type).toContain("text/html");
    expect(docsResponse.text).toContain("Tally API Documentation");
    expect(docsResponse.text).toContain("swagger-ui-init.js");

    const swaggerAsset = await request(app).get("/api/v1/docs/swagger-ui.css");
    expect(swaggerAsset.status).toBe(200);
    expect(swaggerAsset.type).toContain("text/css");
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
