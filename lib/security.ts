import "server-only";

import { createCipheriv, createDecipheriv, createHmac, createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { env } from "@/lib/env";

function deriveKey(secret: string) {
  return createHash("sha256").update(secret).digest();
}

function toBase64Url(input: Buffer | string) {
  return Buffer.from(input).toString("base64url");
}

function fromBase64Url(input: string) {
  return Buffer.from(input, "base64url");
}

export function encryptValue(value: string) {
  const iv = randomBytes(12);
  const key = deriveKey(env.TOKEN_ENCRYPTION_KEY);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [iv, tag, ciphertext].map(toBase64Url).join(".");
}

export function decryptValue(payload: string) {
  const [ivPart, tagPart, ciphertextPart] = payload.split(".");
  if (!ivPart || !tagPart || !ciphertextPart) {
    throw new Error("Invalid encrypted payload");
  }

  const key = deriveKey(env.TOKEN_ENCRYPTION_KEY);
  const decipher = createDecipheriv("aes-256-gcm", key, fromBase64Url(ivPart));
  decipher.setAuthTag(fromBase64Url(tagPart));
  const plaintext = Buffer.concat([
    decipher.update(fromBase64Url(ciphertextPart)),
    decipher.final(),
  ]);

  return plaintext.toString("utf8");
}

export function signValue(value: string) {
  return toBase64Url(createHmac("sha256", deriveKey(env.SESSION_SECRET)).update(value).digest());
}

export function verifySignedValue(value: string, signature: string) {
  const expected = createHmac("sha256", deriveKey(env.SESSION_SECRET)).update(value).digest();
  const provided = fromBase64Url(signature);

  return (
    expected.length === provided.length &&
    timingSafeEqual(expected, provided)
  );
}
