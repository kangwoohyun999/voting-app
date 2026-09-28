import { randomBytes } from "node:crypto";
import type { Language } from "@/lib/i18n/messages";

export type Db = {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
};

export type Option = { id: number; label: string };

export type Result = { optionId: number; label: string; count: number; percent: number };

type LoadedPoll = {
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

export type PollView = { kind: "not-found" } | LoadedPoll;

export type OwnerView = { kind: "not-found" } | (LoadedPoll & { ownerEmailHint: string });

type CreatePollInput = {
  question: string;
  options: string[];
  ownerEmail: string;
  language: Language;
};

type CreatePollResult =
  | { ok: true; pollId: string; ownerToken: string }
  | { ok: false; error: "owner-email-required" };

type VoteResult = { ok: true } | { ok: false; error: "not-found" | "closed" | "invalid-option" };

type OwnerActionResult = { ok: true } | { ok: false; error: "not-found" };

type PollRow = { id: string; question: string; status: "open" | "closed"; owner_email: string };
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

  async function load(poll: PollRow, voterId: string | null, isOwner: boolean): Promise<LoadedPoll> {
    const tally = await db.query<TallyRow>(
      `SELECT o.id, o.label, count(v.voter_id)::int AS count
       FROM options o LEFT JOIN votes v ON v.option_id = o.id
       WHERE o.poll_id = $1
       GROUP BY o.id ORDER BY o.position`,
      [poll.id],
    );
    const [vote] = voterId
      ? await db.query<{ option_id: number }>(
          `SELECT option_id FROM votes WHERE poll_id = $1 AND voter_id = $2`,
          [poll.id, voterId],
        )
      : [];
    const myVote = vote?.option_id ?? null;
    const maySeeResults = isOwner || poll.status === "closed" || myVote !== null;

    return {
      kind: "poll",
      id: poll.id,
      question: poll.question,
      status: poll.status,
      options: tally.map(({ id, label }) => ({ id, label })),
      myVote,
      canVote: poll.status === "open" && tally.length > 0,
      results: maySeeResults ? toResults(tally) : null,
    };
  }

  async function findPoll(column: "id" | "owner_token", value: string) {
    const [poll] = await db.query<PollRow>(
      `SELECT id, question, status, owner_email FROM polls WHERE ${column} = $1`,
      [value],
    );
    return poll;
  }

  async function viewPoll(pollId: string, voterId: string | null): Promise<PollView> {
    const poll = await findPoll("id", pollId);
    if (!poll) return { kind: "not-found" };
    return load(poll, voterId, false);
  }

  /** The Poll as seen through its Owner Link; `voterId` is the owner's own browser. */
  async function viewAsOwner(ownerToken: string, voterId: string | null): Promise<OwnerView> {
    const poll = await findPoll("owner_token", ownerToken);
    if (!poll) return { kind: "not-found" };
    return { ...(await load(poll, voterId, true)), ownerEmailHint: maskEmail(poll.owner_email) };
  }

  async function castVote(pollId: string, voterId: string, optionId: number): Promise<VoteResult> {
    // Casting and switching are the same upsert: one Vote per Voter per Poll.
    // The Open check is in the same statement, so a Vote can't slip in after closing.
    const cast = await db.query(
      `INSERT INTO votes (poll_id, voter_id, option_id)
       SELECT o.poll_id, $2, o.id
       FROM options o JOIN polls p ON p.id = o.poll_id
       WHERE o.id = $3 AND o.poll_id = $1 AND p.status = 'open'
       ON CONFLICT (poll_id, voter_id) DO UPDATE SET option_id = excluded.option_id
       RETURNING option_id`,
      [pollId, voterId, optionId],
    );
    if (cast.length > 0) return { ok: true };

    const poll = await findPoll("id", pollId);
    if (!poll) return { ok: false, error: "not-found" };
    return { ok: false, error: poll.status === "open" ? "invalid-option" : "closed" };
  }

  async function setStatus(ownerToken: string, status: "open" | "closed"): Promise<OwnerActionResult> {
    const updated = await db.query(
      `UPDATE polls SET status = $2 WHERE owner_token = $1 RETURNING id`,
      [ownerToken, status],
    );
    return updated.length > 0 ? { ok: true } : { ok: false, error: "not-found" };
  }

  const closePoll = (ownerToken: string) => setStatus(ownerToken, "closed");
  const reopenPoll = (ownerToken: string) => setStatus(ownerToken, "open");

  return { createPoll, viewPoll, viewAsOwner, castVote, closePoll, reopenPoll };
}

function maskEmail(email: string) {
  const at = email.lastIndexOf("@");
  return at < 1 ? "•••" : `${email[0]}•••${email.slice(at)}`;
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
