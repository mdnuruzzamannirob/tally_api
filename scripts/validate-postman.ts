import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { openApiRoutes } from "./openapi-routes.js";

type CollectionItem = {
  request?: { url?: { raw?: string }; body?: { raw?: string } };
  item?: CollectionItem[];
};

const collectionPath = fileURLToPath(new URL("../contracts/tally.postman.json", import.meta.url));
const collection = JSON.parse(await readFile(collectionPath, "utf8")) as {
  info?: { schema?: string };
  variable?: Array<{ key?: string }>;
  item?: CollectionItem[];
};

if (
  collection.info?.schema !== "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
) {
  throw new Error("Postman collection must use schema v2.1.0.");
}

const requests: CollectionItem[] = [];
const collect = (items: CollectionItem[] = []) => {
  for (const item of items) {
    if (item.request) requests.push(item);
    if (item.item) collect(item.item);
  }
};
collect(collection.item);

if (requests.length !== openApiRoutes.length) {
  throw new Error(
    `Postman route parity failed. Expected ${openApiRoutes.length}, found ${requests.length}.`,
  );
}

const declaredVariables = new Set(
  (collection.variable ?? []).flatMap(({ key }) => (key ? [key] : [])),
);
const undeclared = new Set<string>();
for (const item of requests) {
  const source = `${item.request?.url?.raw ?? ""}\n${item.request?.body?.raw ?? ""}`;
  for (const match of source.matchAll(/{{([^{}]+)}}/g)) {
    const variable = match[1];
    if (variable && !variable.startsWith("$") && !declaredVariables.has(variable)) {
      undeclared.add(variable);
    }
  }
}
if (undeclared.size) {
  throw new Error(`Postman collection uses undeclared variables: ${[...undeclared].join(", ")}.`);
}

console.info(`Postman collection is valid with ${requests.length} requests.`);
