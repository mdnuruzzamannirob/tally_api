import type { Express } from "express";
import request from "supertest";

/** Adds a bearer token to a Supertest request for protected-route tests. */
export function authenticatedRequest(app: Express, accessToken: string) {
  return request(app).set("Authorization", `Bearer ${accessToken}`);
}
