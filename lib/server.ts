// Wires the Polls module to Neon for the running app. Server-only.
import { neon } from "@neondatabase/serverless";
import { headers } from "next/headers";
import { createPolls, type Db } from "@/lib/polls/polls";
import { messages, type Language } from "@/lib/i18n/messages";

const sql = neon(process.env.DATABASE_URL!);
const db: Db = { query: (text, params) => sql.query(text, params) as never };

export const polls = createPolls({ db });

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
