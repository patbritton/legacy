import type { APIRoute } from "astro";
import { createSessionToken } from "../../../lib/adminAuth";
import { checkRateLimit } from "../../../lib/rateLimiter";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, clientAddress }) => {
  if (!checkRateLimit(clientAddress, { keyPrefix: "admin-login", windowMs: 10 * 60 * 1000, maxRequests: 10 })) {
    return new Response("Too many login attempts", { status: 429 });
  }
  const contentType = request.headers.get("content-type") || "";
  let password = "";

  if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    password = String(formData.get("password") || "");
  } else if (contentType.includes("application/json")) {
    const body = await request.json();
    password = String(body?.password || "");
  } else {
    const bodyText = await request.text();
    const params = new URLSearchParams(bodyText);
    password = String(params.get("password") || bodyText || "");
  }
  const expected = (import.meta.env.ADMIN_PASSWORD || "").trim();
  password = password.trim();

  if (!expected || expected.length < 12 || expected.toLowerCase().includes("changeme")) {
    return new Response("Server misconfigured", { status: 500 });
  }

  if (!expected || !password || password !== expected) {
    return Response.redirect(new URL("/admin?status=auth", request.url), 303);
  }

  const token = createSessionToken();
  if (!token) {
    return Response.redirect(new URL("/admin?status=error", request.url), 303);
  }

  cookies.set("admin_session", token, {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
    secure: process.env.NODE_ENV === "production",
  });

  return Response.redirect(new URL("/admin?status=ok", request.url), 303);
};
