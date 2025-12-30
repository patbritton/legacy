import type { APIRoute } from "astro";
import { getSupabaseClient, type GuestbookEntry, type GuestbookConfig } from "../../../lib/supabase";
import { checkRateLimit } from "../../../lib/rateLimiter";

export const prerender = false;

const RECAPTCHA_VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";
const OPENAI_MODERATION_URL = "https://api.openai.com/v1/moderations";

const sanitize = (value: string) => value.trim().replace(/\s+/g, " ");

const countLinks = (value: string) => {
  const matches = value.match(/https?:\/\/|www\./gi);
  return matches ? matches.length : 0;
};

const loadConfig = async (): Promise<GuestbookConfig> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('guestbook_config')
    .select('*')
    .eq('id', 1)
    .single();

  if (error || !data) {
    // Return default config if not found
    return {
      id: 1,
      max_links: 2,
      max_comment_length: 800,
      max_field_length: 120,
      banned_terms: [],
      require_moderation: false,
    };
  }

  return data as GuestbookConfig;
};

const getNextRecordNumber = async (): Promise<number> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('guestbook_entries')
    .select('record')
    .order('record', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return 1;
  }

  return data.record + 1;
};

const verifyRecaptcha = async (token: string, remoteIp: string | null) => {
  const secret = import.meta.env.RECAPTCHA_SECRET_KEY;
  if (!secret) {
    return { ok: false, reason: "missing-secret" };
  }

  const body = new URLSearchParams({
    secret,
    response: token,
  });

  if (remoteIp) {
    body.set("remoteip", remoteIp);
  }

  const response = await fetch(RECAPTCHA_VERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const data = await response.json();
  return { ok: Boolean(data.success), reason: data["error-codes"]?.join(",") };
};

const runOpenAIModeration = async (text: string) => {
  const apiKey = import.meta.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { available: false, flagged: false };
  }

  const response = await fetch(OPENAI_MODERATION_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "omni-moderation-latest",
      input: text,
    }),
  });

  if (!response.ok) {
    return { available: true, flagged: true };
  }

  const data = await response.json();
  const flagged = Boolean(data?.results?.[0]?.flagged);
  return { available: true, flagged };
};

export const POST: APIRoute = async ({ request, clientAddress }) => {
  if (!checkRateLimit(clientAddress, { keyPrefix: "guestbook-submit", windowMs: 60 * 1000, maxRequests: 5 })) {
    return new Response("Too many requests", { status: 429 });
  }

  const formData = await request.formData();
  const honeypot = String(formData.get("company") || "");
  if (honeypot.trim()) {
    return new Response(null, { status: 204 });
  }

  const config = await loadConfig();
  const name = sanitize(String(formData.get("name") || ""));
  const website = sanitize(String(formData.get("website") || ""));
  const referredBy = sanitize(String(formData.get("referredBy") || ""));
  const from = sanitize(String(formData.get("from") || ""));
  const comments = String(formData.get("comments") || "").trim();
  const captchaToken = String(formData.get("g-recaptcha-response") || "");

  if (!name || !comments) {
    return Response.redirect(new URL("/guestbook/?status=error", request.url), 303);
  }

  if (name.length > config.max_field_length || website.length > config.max_field_length || referredBy.length > config.max_field_length || from.length > config.max_field_length) {
    return Response.redirect(new URL("/guestbook/?status=error", request.url), 303);
  }

  if (comments.length > config.max_comment_length) {
    return Response.redirect(new URL("/guestbook/?status=error", request.url), 303);
  }

  const captchaResult = await verifyRecaptcha(captchaToken, clientAddress ?? null);
  if (!captchaResult.ok) {
    return Response.redirect(new URL("/guestbook/?status=captcha", request.url), 303);
  }

  const linkScore = countLinks(`${website} ${comments}`);
  const combinedText = `${name}\n${website}\n${referredBy}\n${from}\n${comments}`;
  const lowerText = combinedText.toLowerCase();
  const bannedMatch = config.banned_terms.some((term) => term && lowerText.includes(term.toLowerCase()));

  // Auto-reject if banned terms detected
  if (bannedMatch) {
    return Response.redirect(new URL("/guestbook/?status=banned", request.url), 303);
  }

  const moderation = await runOpenAIModeration(combinedText);
  const requiresReview = config.require_moderation || linkScore > config.max_links || moderation.flagged || !moderation.available;

  const record = await getNextRecordNumber();

  const newEntry: Omit<GuestbookEntry, 'id' | 'created_at' | 'updated_at'> = {
    record,
    name,
    website,
    referred_by: referredBy,
    from_location: from,
    comments,
    private_message: false,
    flagged: requiresReview,
    status: requiresReview ? 'pending' : 'approved',
  };

  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('guestbook_entries')
    .insert([newEntry]);

  if (error) {
    console.error('Error inserting guestbook entry:', error);
    return Response.redirect(new URL("/guestbook/?status=error", request.url), 303);
  }

  if (requiresReview) {
    return Response.redirect(new URL("/guestbook/?status=pending", request.url), 303);
  }

  return Response.redirect(new URL("/guestbook/?status=ok", request.url), 303);
};
