// Wires the Polls module to Neon for the running app. Server-only.
import { neon } from "@neondatabase/serverless";
import { randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import { createPolls, type Db } from "@/lib/polls/polls";
import { messages, type Language } from "@/lib/i18n/messages";
import { createSmtpMailer } from "@/lib/mailer";

const sql = neon(process.env.DATABASE_URL!);
const db: Db = { query: (text, params) => sql.query(text, params) as never };

export const polls = createPolls({ db, mailer: createSmtpMailer() });

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

export async function getLanguage(): Promise<Language> {
  return "ko";
}

export async function getMessages() {
  return messages[await getLanguage()];
}

export async function appOrigin() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
