import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { Router } from "express";
import swaggerUi from "swagger-ui-express";
import type { JsonObject } from "swagger-ui-express";

const contractPath = fileURLToPath(new URL("../../contracts/openapi.json", import.meta.url));
const openApiDocument = JSON.parse(readFileSync(contractPath, "utf8")) as JsonObject;

/** Serves the exact release contract and its human-readable Swagger UI. */
export function createOpenApiRouter(): Router {
  const router = Router();

  router.get("/openapi.json", (_request, response) => {
    response
      .set("Cache-Control", "public, max-age=300")
      .type("application/json")
      .send(openApiDocument);
  });
  router.get("/docs", (request, response, next) => {
    if (request.path.endsWith("/")) return next();
    response.redirect(308, `${request.baseUrl}/docs/`);
  });
  router.use(
    "/docs/",
    swaggerUi.serve,
    swaggerUi.setup(openApiDocument, {
      customSiteTitle: "Tally API Documentation",
      customCss: ".swagger-ui .topbar { display: none }",
      swaggerOptions: {
        displayRequestDuration: true,
        filter: true,
        persistAuthorization: true,
        tryItOutEnabled: true,
        docExpansion: "list",
      },
    }),
  );

  return router;
}
