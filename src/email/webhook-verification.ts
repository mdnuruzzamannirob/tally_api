import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyWebhook(
  payload: string,
  headers: {
    id?: string | undefined;
    timestamp?: string | undefined;
    signature?: string | undefined;
  },
  secret: string,
  now = Date.now(),
): boolean {
  if (!headers.id || !headers.timestamp || !headers.signature || !secret.startsWith("whsec_"))
    return false;
  if (!/^\d+$/.test(headers.timestamp) || Math.abs(now / 1000 - Number(headers.timestamp)) > 300)
    return false;
  const key = Buffer.from(secret.slice(6), "base64");
  if (!key.length) return false;
  const expected = createHmac("sha256", key)
    .update(`${headers.id}.${headers.timestamp}.${payload}`)
    .digest();
  return headers.signature.split(" ").some((value) => {
    const [version, encoded] = value.split(",");
    if (version !== "v1" || !encoded) return false;
    const actual = Buffer.from(encoded, "base64");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  });
}
