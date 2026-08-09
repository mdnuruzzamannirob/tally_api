import express from "express";
import type { Express } from "express";

export function createApp(): Express {
  const app = express();

  app.get("/", (_request, response) => {
    response.status(200).json({
      service: "tally-api",
      status: "starting",
    });
  });

  return app;
}

export const app: Express = createApp();
