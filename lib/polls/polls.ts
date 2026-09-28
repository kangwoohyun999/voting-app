import { randomBytes } from "node:crypto";
import { emails } from "@/lib/i18n/emails";
import type { Language } from "@/lib/i18n/messages";

export type Db = {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
};

export type Email = { to: string; subject: string; text: string };

export type Mailer = { send(email: Email): Promise<void> };

export type Option = { id: number; label: string };

export type Result = { optionId: number; label: string; count: number; percent: number };

export type LoadedPoll = {
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

type Gone = { kind: "not-found" } | { kind: "deleted" };

export type PollView = Gone | LoadedPoll;

export type OwnerView = Gone | (LoadedPoll & { ownerEmailHint: string });

type CreatePollInput = {
  question: string;
  options: string[];
  ownerEmail: string;
  language: Language;
  /** Scheme and host the emailed links point at, e.g. https://vote.example */
  origin: string;
};

type CreatePollResult =
  | { ok: true; pollId: string; ownerToken: string; emailSent: boolean }
  | { ok: false; error: "owner-email-required" };

type VoteResult =
  | { ok: true }
  | { ok: false; error: "not-found" | "deleted" | "closed" | "invalid-option" };

type OwnerActionResult = { ok: true } | { ok: false; error: "not-found" | "deleted" };

type PollRow = {
  id: string;
  question: string;
  status: "open" | "closed" | "deleted";
  owner_email: string;
};
type LivePollRow = PollRow & { status: "open" | "closed" };
type TallyRow = { id: number; label: string; count: number };

const randomId = (bytes: number) => randomBytes(bytes).toString("base64url");

export const pollLink = (origin: string, pollId: string) => `${origin}/p/${pollId}`;
export const ownerLink = (origin: string, ownerToken: string) => `${origin}/o/${ownerToken}`;

export function createPolls({ db, mailer }: { db: Db; mailer: Mailer }) {
  // A failed email must not undo a Poll that is already stored.
  async function trySend(email: Email) {
    try {
      await mailer.send(email);
      return true;
    } catch (error) {
      console.error("Failed to send email", error);
      return false;
    }
  }

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
    const emailSent = await trySend({
      to: ownerEmail,
      ...emails[input.language].created({
        question: input.question,
        pollLink: pollLink(input.origin, pollId),
        ownerLink: ownerLink(input.origin, ownerToken),
      }),
    });
    return { ok: true, pollId, ownerToken, emailSent };
  }

  async function load(poll: LivePollRow, voterId: string | null, isOwner: boolean): Promise<LoadedPoll> {
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
    if (poll.status === "deleted") return { kind: "deleted" };
    return load(poll as LivePollRow, voterId, false);
  }

  /** The Poll as seen through its Owner Link; `voterId` is the owner's own browser. */
  async function viewAsOwner(ownerToken: string, voterId: string | null): Promise<OwnerView> {
    const poll = await findPoll("owner_token", ownerToken);
    if (!poll) return { kind: "not-found" };
    if (poll.status === "deleted") return { kind: "deleted" };
    return {
      ...(await load(poll as LivePollRow, voterId, true)),
      ownerEmailHint: maskEmail(poll.owner_email),
    };
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
    if (poll.status === "open") return { ok: false, error: "invalid-option" };
    return { ok: false, error: poll.status };
  }

  async function setStatus(ownerToken: string, status: PollRow["status"]): Promise<OwnerActionResult> {
    // A Deleted Poll is final.
    const updated = await db.query(
      `UPDATE polls SET status = $2 WHERE owner_token = $1 AND status <> 'deleted' RETURNING id`,
      [ownerToken, status],
    );
    if (updated.length > 0) return { ok: true };
    const poll = await findPoll("owner_token", ownerToken);
    return { ok: false, error: poll ? "deleted" : "not-found" };
  }

  const closePoll = (ownerToken: string) => setStatus(ownerToken, "closed");
  const reopenPoll = (ownerToken: string) => setStatus(ownerToken, "open");
  const deletePoll = (ownerToken: string) => setStatus(ownerToken, "deleted");

  return { createPoll, viewPoll, viewAsOwner, castVote, closePoll, reopenPoll, deletePoll };
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
