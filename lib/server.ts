// Wires the Polls module to Neon for the running app. Server-only.
import { neon } from "@neondatabase/serverless";
import { randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import { createPolls, type Db } from "@/lib/polls/polls";
import { isLanguage, messages, type Language } from "@/lib/i18n/messages";
import { createSmtpMailer } from "@/lib/mailer";

// Connect on first query, not at import, so `next build` works without DATABASE_URL.
let sql: ReturnType<typeof neon> | undefined;
const db: Db = {
  query: (text, params) => {
    sql ??= neon(process.env.DATABASE_URL!);
    return sql.query(text, params) as never;
  },
};

export const polls = createPolls({
  db,
  mailer: createSmtpMailer(),
  operatorPassword: process.env.OPERATOR_PASSWORD,
});

// A Voter is one browser (ADR-0001): a random id in a long-lived cookie.
const VOTER_COOKIE = "voter";

export async function getVoterId(): Promise<string | null> {
  return (await cookies()).get(VOTER_COOKIE)?.value ?? null;
}

/** Only callable from Server Actions, since it may set the cookie. */
export async function ensureVoterId(): Promise<string> {
  const existing = await getVoterId();
  if (existing) return existing;
  const voterId = randomUUID();
  (await cookies()).set(VOTER_COOKIE, voterId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365 * 5,
  });
  return voterId;
}

export const LANGUAGE_COOKIE = "lang";

/** Korean unless the viewer has switched. */
export async function getLanguage(): Promise<Language> {
  const chosen = (await cookies()).get(LANGUAGE_COOKIE)?.value;
  return isLanguage(chosen) ? chosen : "ko";
}

export async function getMessages() {
  return messages[await getLanguage()];
}

/**
 * Where links (including emailed Owner Links) point. In production this never comes
 * from request headers: a forged Host would send someone's Owner Link to another site.
 */
export async function appOrigin() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.NODE_ENV === "production") {
    const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL; // set by Vercel
    if (vercelUrl) return `https://${vercelUrl}`;
    throw new Error("Set APP_URL to the app's public address, e.g. https://vote.example");
  }
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
