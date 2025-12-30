import type { APIRoute } from "astro";

export const prerender = false;

export const POST: APIRoute = async ({ cookies }) => {
  cookies.delete("admin_session", { path: "/" });
  return Response.redirect("/admin?status=logout", 303);
};
