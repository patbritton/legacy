import type { APIRoute } from "astro";
import { verifySessionToken } from "../../../lib/adminAuth";
import { getSupabaseAdminClient, type GuestbookConfig } from "../../../lib/supabase";
import { checkRateLimit } from "../../../lib/rateLimiter";

export const prerender = false;

const sanitize = (value: string) => value.trim().replace(/\s+/g, " ");

export const POST: APIRoute = async ({ request, cookies, clientAddress }) => {
  const token = cookies.get("admin_session")?.value;
  if (!verifySessionToken(token)) {
    return Response.redirect(new URL("/admin?status=auth", request.url), 303);
  }
  if (!checkRateLimit(clientAddress, { keyPrefix: "admin-actions", windowMs: 60 * 1000, maxRequests: 30 })) {
    return new Response("Too many requests", { status: 429 });
  }

  const formData = await request.formData();
  const action = String(formData.get("action") || "");
  const supabase = getSupabaseAdminClient();

  if (action === "approve") {
    const record = Number(formData.get("record"));

    const { error } = await supabase
      .from('guestbook_entries')
      .update({ status: 'approved', flagged: false })
      .eq('record', record);

    if (error) {
      console.error('Error approving entry:', error);
      return Response.redirect(new URL("/legacy/admin/guestbook/?status=error", request.url), 303);
    }

    return Response.redirect(new URL("/legacy/admin/guestbook/?status=ok", request.url), 303);
  }

  if (action === "reject") {
    const record = Number(formData.get("record"));

    const { error } = await supabase
      .from('guestbook_entries')
      .update({ status: 'rejected' })
      .eq('record', record);

    if (error) {
      console.error('Error rejecting entry:', error);
      return Response.redirect(new URL("/legacy/admin/guestbook/?status=error", request.url), 303);
    }

    return Response.redirect(new URL("/legacy/admin/guestbook/?status=ok", request.url), 303);
  }

  if (action === "delete") {
    const record = Number(formData.get("record"));

    const { error } = await supabase
      .from('guestbook_entries')
      .delete()
      .eq('record', record);

    if (error) {
      console.error('Error deleting entry:', error);
      return Response.redirect(new URL("/legacy/admin/guestbook/?status=error", request.url), 303);
    }

    return Response.redirect(new URL("/legacy/admin/guestbook/?status=ok", request.url), 303);
  }

  if (action === "update") {
    const record = Number(formData.get("record"));
    const name = sanitize(String(formData.get("name") || ""));
    const website = sanitize(String(formData.get("website") || ""));
    const referredBy = sanitize(String(formData.get("referredBy") || ""));
    const from = sanitize(String(formData.get("from") || ""));
    const comments = String(formData.get("comments") || "").trim();
    const privateMessage = String(formData.get("privateMessage") || "") === "on";

    const { error } = await supabase
      .from('guestbook_entries')
      .update({
        name,
        website,
        referred_by: referredBy,
        from_location: from,
        comments,
        private_message: privateMessage,
      })
      .eq('record', record);

    if (error) {
      console.error('Error updating entry:', error);
      return Response.redirect(new URL("/legacy/admin/guestbook/?status=error", request.url), 303);
    }

    return Response.redirect(new URL("/legacy/admin/guestbook/?status=ok", request.url), 303);
  }

  if (action === "update-config") {
    const maxLinks = Number(formData.get("maxLinks") || 2);
    const maxCommentLength = Number(formData.get("maxCommentLength") || 800);
    const maxFieldLength = Number(formData.get("maxFieldLength") || 120);
    const requireModeration = String(formData.get("requireModeration") || "") === "on";
    const bannedRaw = String(formData.get("bannedTerms") || "");
    if (bannedRaw.length > 10000) {
      return Response.redirect(new URL("/legacy/admin/guestbook/?status=error", request.url), 303);
    }
    const bannedTerms = bannedRaw
      .split("\n")
      .map((term) => term.trim())
      .filter(Boolean);

    if (bannedTerms.length > 1000) {
        return Response.redirect(new URL("/legacy/admin/guestbook/?status=error", request.url), 303);
    }

    const config: Partial<GuestbookConfig> = {
      max_links: maxLinks,
      max_comment_length: maxCommentLength,
      max_field_length: maxFieldLength,
      require_moderation: requireModeration,
      banned_terms: bannedTerms,
    };

    const { error } = await supabase
      .from('guestbook_config')
      .update(config)
      .eq('id', 1);

    if (error) {
      console.error('Error updating config:', error);
      return Response.redirect(new URL("/legacy/admin/guestbook/?status=error", request.url), 303);
    }

    return Response.redirect(new URL("/legacy/admin/guestbook/?status=ok", request.url), 303);
  }

  return Response.redirect(new URL("/legacy/admin/guestbook/?status=error", request.url), 303);
};
