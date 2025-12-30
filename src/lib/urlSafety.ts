import dns from "node:dns/promises";
import net from "node:net";

const isPrivateIPv4 = (ip: string) => {
  const parts = ip.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return true;
  }

  const [a, b] = parts;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 192 && b === 0) return true;
  return false;
};

const isPrivateIPv6 = (ip: string) => {
  const normalized = ip.toLowerCase();
  if (normalized === "::1" || normalized === "::") return true;
  if (normalized.startsWith("fe80:")) return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  return false;
};

const isPrivateIp = (ip: string) => {
  if (net.isIP(ip) === 4) return isPrivateIPv4(ip);
  if (net.isIP(ip) === 6) return isPrivateIPv6(ip);
  return true;
};

const assertPublicHostname = async (hostname: string) => {
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new Error("Blocked private IP address");
    }
    return;
  }

  const results = await dns.lookup(hostname, { all: true });
  if (!results.length) {
    throw new Error("Host did not resolve");
  }

  for (const result of results) {
    if (isPrivateIp(result.address)) {
      throw new Error("Blocked private IP address");
    }
  }
};

export const assertSafeUrl = async (value: string) => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Invalid URL");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Unsupported protocol");
  }

  if (url.username || url.password) {
    throw new Error("Blocked credentialed URL");
  }

  await assertPublicHostname(url.hostname);
  return url;
};

export const isHttpUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

export const readResponseText = async (response: Response, maxBytes: number) => {
  const contentLength = response.headers.get("content-length");
  if (contentLength && Number(contentLength) > maxBytes) {
    throw new Error("Response too large");
  }

  if (!response.body) {
    return response.text();
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let text = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel();
      throw new Error("Response too large");
    }
    text += decoder.decode(value, { stream: true });
  }

  text += decoder.decode();
  return text;
};
