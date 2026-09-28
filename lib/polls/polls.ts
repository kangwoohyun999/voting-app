import { randomBytes } from "node:crypto";
import type { Language } from "@/lib/i18n/messages";

export type Db = {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
};

export type Option = { id: number; label: string };

export type Result = { optionId: number; label: string; count: number; percent: number };

export type PollView =
  | { kind: "not-found" }
  | {
      kind: "poll";
      id: string;
      question: string;
      status: "open" | "closed";
      options: Option[];
      myVote: number | null;
      canVote: boolean;
      /** Null when the viewer may not see Results yet. */
      results: Result[] | null;
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

type VoteResult = { ok: true } | { ok: false; error: "not-found" | "invalid-option" };

type PollRow = { id: string; question: string; status: "open" | "closed" };
type TallyRow = { id: number; label: string; count: number };

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

  async function viewPoll(pollId: string, voterId: string | null): Promise<PollView> {
    const [poll] = await db.query<PollRow>(
      `SELECT id, question, status FROM polls WHERE id = $1`,
      [pollId],
    );
    if (!poll) return { kind: "not-found" };

    const tally = await db.query<TallyRow>(
      `SELECT o.id, o.label, count(v.voter_id)::int AS count
       FROM options o LEFT JOIN votes v ON v.option_id = o.id
       WHERE o.poll_id = $1
       GROUP BY o.id ORDER BY o.position`,
      [pollId],
    );
    const [vote] = voterId
      ? await db.query<{ option_id: number }>(
          `SELECT option_id FROM votes WHERE poll_id = $1 AND voter_id = $2`,
          [pollId, voterId],
        )
      : [];
    const myVote = vote?.option_id ?? null;

    return {
      kind: "poll",
      ...poll,
      options: tally.map(({ id, label }) => ({ id, label })),
      myVote,
      canVote: tally.length > 0,
      results: myVote !== null ? toResults(tally) : null,
    };
  }

  async function castVote(pollId: string, voterId: string, optionId: number): Promise<VoteResult> {
    // Casting and switching are the same upsert: one Vote per Voter per Poll.
    const cast = await db.query(
      `INSERT INTO votes (poll_id, voter_id, option_id)
       SELECT o.poll_id, $2, o.id FROM options o WHERE o.id = $3 AND o.poll_id = $1
       ON CONFLICT (poll_id, voter_id) DO UPDATE SET option_id = excluded.option_id
       RETURNING option_id`,
      [pollId, voterId, optionId],
    );
    if (cast.length > 0) return { ok: true };

    const [poll] = await db.query(`SELECT 1 FROM polls WHERE id = $1`, [pollId]);
    return { ok: false, error: poll ? "invalid-option" : "not-found" };
  }

  return { createPoll, viewPoll, castVote };
}

function toResults(tally: TallyRow[]): Result[] {
  const total = tally.reduce((sum, row) => sum + row.count, 0);
  return tally.map(({ id, label, count }) => ({
    optionId: id,
    label,
    count,
    percent: total === 0 ? 0 : Math.round((count * 100) / total),
  }));
}

export type Polls = ReturnType<typeof createPolls>;
