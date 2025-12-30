import crypto from "node:crypto";

const TOKEN_TTL_MS = 1000 * 60 * 60 * 24; // 1 day

const getSecret = () => {
  const secret = import.meta.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    throw new Error("ADMIN_SESSION_SECRET is not set. Please provide a long, random string.");
  }
  const trimmed = secret.trim();
  if (trimmed.length < 32 || trimmed.toLowerCase().includes("changeme")) {
    throw new Error("ADMIN_SESSION_SECRET is too weak. Use a long, random string (32+ chars).");
  }
  return trimmed;
};

export const createSessionToken = () => {
  const secret = getSecret();
  const timestamp = Date.now().toString();
  const hmac = crypto.createHmac("sha256", secret).update(timestamp).digest("hex");
  return `${timestamp}.${hmac}`;
};

export const verifySessionToken = (token: string | undefined) => {
  const secret = getSecret();
  if (!token) {
    return false;
  }
  const [timestamp, signature] = token.split(".");
  if (!timestamp || !signature) {
    return false;
  }
  const parsed = Number(timestamp);
  if (!Number.isFinite(parsed)) {
    return false;
  }
  if (Date.now() - parsed > TOKEN_TTL_MS) {
    return false;
  }
  const expected = crypto.createHmac("sha256", secret).update(timestamp).digest("hex");
  if (signature.length !== expected.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
};
