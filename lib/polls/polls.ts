import { randomBytes } from "node:crypto";
import type { Language } from "@/lib/i18n/messages";

export type Db = {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
};

export type Option = { id: number; label: string };

export type PollView =
  | { kind: "not-found" }
  | {
      kind: "poll";
      id: string;
      question: string;
      status: "open" | "closed";
      options: Option[];
    };

type CreatePollInput = {
  question: string;
  options: string[];
  ownerEmail: string;
  language: Language;
};

type CreatePollResult =
  | { ok: true; pollId: string; ownerToken: string }
  | { ok: false; error: "owner-email-required" };

const randomId = (bytes: number) => randomBytes(bytes).toString("base64url");

export function createPolls({ db }: { db: Db }) {
  async function createPoll(input: CreatePollInput): Promise<CreatePollResult> {
    const ownerEmail = input.ownerEmail.trim().toLowerCase();
    if (!ownerEmail) return { ok: false, error: "owner-email-required" };

    const pollId = randomId(9);
    const ownerToken = randomId(32);
    // One statement, so a Poll is never stored without its Options.
    await db.query(
      `WITH p AS (
         INSERT INTO polls (id, question, owner_token, owner_email, language)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id
       )
       INSERT INTO options (poll_id, label, position)
       SELECT p.id, t.label, t.ord FROM p, unnest($6::text[]) WITH ORDINALITY AS t(label, ord)`,
      [pollId, input.question, ownerToken, ownerEmail, input.language, input.options],
    );
    return { ok: true, pollId, ownerToken };
  }

  async function viewPoll(pollId: string, _voterId: string | null): Promise<PollView> {
    const [poll] = await db.query<{ id: string; question: string; status: "open" | "closed" }>(
      `SELECT id, question, status FROM polls WHERE id = $1`,
      [pollId],
    );
    if (!poll) return { kind: "not-found" };

    const options = await db.query<Option>(
      `SELECT id, label FROM options WHERE poll_id = $1 ORDER BY position`,
      [pollId],
    );
    return { kind: "poll", ...poll, options };
  }

  return { createPoll, viewPoll };
}

export type Polls = ReturnType<typeof createPolls>;
