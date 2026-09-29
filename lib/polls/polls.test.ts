import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import { createPolls, type Db, type Email, type Mailer, type Polls } from "./polls";

const SCHEMA = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");

let polls: Polls;
let testDb: Db;
let sent: Email[];
let clock: Date;

beforeEach(async () => {
  const pg = new PGlite();
  await pg.exec(SCHEMA);
  testDb = {
    query: async (text, params) => (await pg.query(text, params)).rows as never,
  };
  sent = [];
  const mailer: Mailer = { send: async (email) => void sent.push(email) };
  clock = new Date("2026-09-30T09:00:00+09:00");
  polls = createPolls({ db: testDb, mailer, now: () => clock });
});

const later = (minutes: number) => new Date(clock.getTime() + minutes * 60_000);

const ORIGIN = "https://vote.example";

const lunch = {
  question: "Friday lunch?",
  options: ["Pizza", "Tacos"],
  ownerEmail: "owner@example.com",
  language: "ko" as const,
  origin: ORIGIN,
};

describe("creating a Poll", () => {
  it("returns a Poll Link id and a separate Owner Link token", async () => {
    const created = await polls.createPoll(lunch);
    if (!created.ok) throw new Error("expected ok");

    expect(created.pollId).toMatch(/^[\w-]{10,}$/);
    expect(created.ownerToken).toMatch(/^[\w-]{40,}$/);
    expect(created.ownerToken).not.toContain(created.pollId);
  });

  it("is refused without an Owner Email", async () => {
    expect(await polls.createPoll({ ...lunch, ownerEmail: "  " })).toEqual({
      ok: false,
      error: "owner-email-required",
    });
    expect(sent).toEqual([]);
  });

  it("emails a copy of the Owner Link to the Owner Email", async () => {
    const created = await polls.createPoll({ ...lunch, ownerEmail: " Owner@Example.com " });
    if (!created.ok) throw new Error("expected ok");

    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("owner@example.com");
    expect(sent[0].text).toContain(`${ORIGIN}/o/${created.ownerToken}`);
    expect(sent[0].text).toContain(`${ORIGIN}/p/${created.pollId}`);
    expect(sent[0].text).toContain("Friday lunch?");
    expect(created.emailSent).toBe(true);
  });

  it("still creates the Poll when the email cannot be sent", async () => {
    const failing = createPolls({
      db: testDb,
      mailer: { send: async () => { throw new Error("SMTP down"); } },
    });
    const created = await failing.createPoll(lunch);
    if (!created.ok) throw new Error("expected ok");

    expect(created.emailSent).toBe(false);
    expect((await polls.viewPoll(created.pollId, null)).kind).toBe("poll");
  });

  it("stores Options exactly as typed, including duplicates and blanks", async () => {
    const created = await polls.createPoll({
      ...lunch,
      options: ["Pizza", "pizza", "", "Pizza"],
    });
    if (!created.ok) throw new Error("expected ok");

    const view = await polls.viewPoll(created.pollId, null);
    if (view.kind !== "poll") throw new Error("expected poll");
    expect(view.options.map((o) => o.label)).toEqual(["Pizza", "pizza", "", "Pizza"]);
  });

  it("allows a Poll with no Options", async () => {
    const created = await polls.createPoll({ ...lunch, options: [] });
    if (!created.ok) throw new Error("expected ok");

    const view = await polls.viewPoll(created.pollId, null);
    if (view.kind !== "poll") throw new Error("expected poll");
    expect(view.options).toEqual([]);
  });
});

async function createLunch(options = lunch.options) {
  const created = await polls.createPoll({ ...lunch, options });
  if (!created.ok) throw new Error("expected ok");
  const view = await polls.viewPoll(created.pollId, null);
  if (view.kind !== "poll") throw new Error("expected poll");
  const optionId = (label: string) => view.options.find((o) => o.label === label)!.id;
  return { ...created, optionId };
}

async function pollFor(pollId: string, voterId: string | null) {
  const view = await polls.viewPoll(pollId, voterId);
  if (view.kind !== "poll") throw new Error(`expected poll, got ${view.kind}`);
  return view;
}

describe("voting", () => {
  it("hides Results from a Voter who has not voted", async () => {
    const { pollId } = await createLunch();
    expect((await pollFor(pollId, "alice")).results).toBeNull();
    expect((await pollFor(pollId, null)).results).toBeNull();
  });

  it("shows Results with count and share once the Voter has voted", async () => {
    const { pollId, optionId } = await createLunch();
    await polls.castVote(pollId, "alice", optionId("Pizza"));
    await polls.castVote(pollId, "bob", optionId("Pizza"));
    await polls.castVote(pollId, "carol", optionId("Tacos"));

    const view = await pollFor(pollId, "alice");
    expect(view.results).toEqual([
      { optionId: optionId("Pizza"), label: "Pizza", count: 2, percent: 67 },
      { optionId: optionId("Tacos"), label: "Tacos", count: 1, percent: 33 },
    ]);
    expect(view.myVote).toBe(optionId("Pizza"));
  });

  it("replaces the Voter's earlier Vote when they switch", async () => {
    const { pollId, optionId } = await createLunch();
    await polls.castVote(pollId, "alice", optionId("Pizza"));
    expect(await polls.castVote(pollId, "alice", optionId("Tacos"))).toEqual({ ok: true });

    const view = await pollFor(pollId, "alice");
    expect(view.myVote).toBe(optionId("Tacos"));
    expect(view.results?.map((r) => r.count)).toEqual([0, 1]);
  });

  it("shows 0% for Options nobody picked", async () => {
    const { pollId, optionId } = await createLunch(["Pizza", "Tacos", "Sushi"]);
    await polls.castVote(pollId, "alice", optionId("Sushi"));
    expect((await pollFor(pollId, "alice")).results?.map((r) => r.percent)).toEqual([0, 0, 100]);
  });

  it("cannot be done on a Poll with no Options", async () => {
    const { pollId } = await createLunch([]);
    expect((await pollFor(pollId, "alice")).canVote).toBe(false);
  });

  it("rejects an Option from a different Poll", async () => {
    const first = await createLunch();
    const second = await createLunch();
    expect(await polls.castVote(second.pollId, "alice", first.optionId("Pizza"))).toEqual({
      ok: false,
      error: "invalid-option",
    });
  });

  it("is rejected for an unknown Poll", async () => {
    expect(await polls.castVote("nope", "alice", 1)).toEqual({ ok: false, error: "not-found" });
  });
});

async function ownerView(ownerToken: string, voterId: string | null = null) {
  const view = await polls.viewAsOwner(ownerToken, voterId);
  if (view.kind !== "poll") throw new Error(`expected poll, got ${view.kind}`);
  return view;
}

describe("the Owner Link", () => {
  it("always shows Results, even before the Poll Owner votes", async () => {
    const { pollId, ownerToken, optionId } = await createLunch();
    expect((await ownerView(ownerToken)).results?.map((r) => r.count)).toEqual([0, 0]);

    await polls.castVote(pollId, "alice", optionId("Tacos"));
    expect((await ownerView(ownerToken)).results?.map((r) => r.count)).toEqual([0, 1]);
  });

  it("shows only a masked hint of the Owner Email", async () => {
    const { ownerToken } = await createLunch();
    const view = await ownerView(ownerToken);
    expect(view.ownerEmailHint).toBe("o•••@example.com");
    expect(JSON.stringify(view)).not.toContain("owner@example.com");
  });

  it("lets the Poll Owner vote like any Voter", async () => {
    const { pollId, ownerToken, optionId } = await createLunch();
    await polls.castVote(pollId, "owner-browser", optionId("Pizza"));

    const view = await ownerView(ownerToken, "owner-browser");
    expect(view.myVote).toBe(optionId("Pizza"));
    expect(view.results?.map((r) => r.count)).toEqual([1, 0]);
  });

  it("is not found for an invalid token", async () => {
    await createLunch();
    expect(await polls.viewAsOwner("wrong-token", null)).toEqual({ kind: "not-found" });
  });
});

describe("closing and reopening", () => {
  it("a Closed Poll rejects new Votes and switches", async () => {
    const { pollId, ownerToken, optionId } = await createLunch();
    await polls.castVote(pollId, "alice", optionId("Pizza"));
    expect(await polls.closePoll(ownerToken)).toEqual({ ok: true });

    expect(await polls.castVote(pollId, "bob", optionId("Pizza"))).toEqual({ ok: false, error: "closed" });
    expect(await polls.castVote(pollId, "alice", optionId("Tacos"))).toEqual({ ok: false, error: "closed" });

    const view = await pollFor(pollId, "alice");
    expect(view.status).toBe("closed");
    expect(view.myVote).toBe(optionId("Pizza"));
    expect(view.canVote).toBe(false);
  });

  it("a Closed Poll shows Results to a Voter who never voted", async () => {
    const { pollId, ownerToken, optionId } = await createLunch();
    await polls.castVote(pollId, "alice", optionId("Pizza"));
    await polls.closePoll(ownerToken);

    expect((await pollFor(pollId, "bob")).results?.map((r) => r.count)).toEqual([1, 0]);
    expect((await pollFor(pollId, null)).results).not.toBeNull();
  });

  it("reopening restores the Open rules", async () => {
    const { pollId, ownerToken, optionId } = await createLunch();
    await polls.closePoll(ownerToken);
    expect(await polls.reopenPoll(ownerToken)).toEqual({ ok: true });

    const view = await pollFor(pollId, "bob");
    expect(view.status).toBe("open");
    expect(view.results).toBeNull();
    expect(await polls.castVote(pollId, "bob", optionId("Tacos"))).toEqual({ ok: true });
  });

  it("is refused with a wrong Owner Link token", async () => {
    const { pollId } = await createLunch();
    expect(await polls.closePoll("wrong-token")).toEqual({ ok: false, error: "not-found" });
    expect(await polls.reopenPoll("wrong-token")).toEqual({ ok: false, error: "not-found" });
    expect((await pollFor(pollId, null)).status).toBe("open");
  });
});

describe("deleting", () => {
  it("makes the Poll Link say the Poll was deleted, distinct from not found", async () => {
    const { pollId, ownerToken } = await createLunch();
    expect(await polls.deletePoll(ownerToken)).toEqual({ ok: true });
    expect(await polls.viewPoll(pollId, null)).toEqual({ kind: "deleted" });
    expect(await polls.viewAsOwner(ownerToken, null)).toEqual({ kind: "deleted" });
  });

  it("rejects Votes and shows no Results, even to earlier Voters", async () => {
    const { pollId, ownerToken, optionId } = await createLunch();
    await polls.castVote(pollId, "alice", optionId("Pizza"));
    await polls.deletePoll(ownerToken);

    expect(await polls.castVote(pollId, "alice", optionId("Tacos"))).toEqual({ ok: false, error: "deleted" });
    expect(await polls.viewPoll(pollId, "alice")).toEqual({ kind: "deleted" });
  });

  it("cannot be closed or reopened afterwards", async () => {
    const { ownerToken } = await createLunch();
    await polls.deletePoll(ownerToken);
    expect(await polls.closePoll(ownerToken)).toEqual({ ok: false, error: "deleted" });
    expect(await polls.reopenPoll(ownerToken)).toEqual({ ok: false, error: "deleted" });
    expect(await polls.viewAsOwner(ownerToken, null)).toEqual({ kind: "deleted" });
  });

  it("is refused with a wrong Owner Link token", async () => {
    const { pollId } = await createLunch();
    expect(await polls.deletePoll("wrong-token")).toEqual({ ok: false, error: "not-found" });
    expect((await pollFor(pollId, null)).status).toBe("open");
  });
});

describe("recovering Owner Links", () => {
  const recover = (email: string) => polls.recoverOwnerLinks({ email, language: "ko", origin: ORIGIN });

  it("sends one email listing the original Owner Links of every Poll for that Owner Email", async () => {
    const first = await createLunch();
    const second = await createLunch();
    await polls.createPoll({ ...lunch, ownerEmail: "someone-else@example.com" });
    sent = [];

    await recover("  OWNER@example.com ");

    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("owner@example.com");
    expect(sent[0].text).toContain(`${ORIGIN}/o/${first.ownerToken}`);
    expect(sent[0].text).toContain(`${ORIGIN}/o/${second.ownerToken}`);
    expect(sent[0].text.match(/\/o\//g)).toHaveLength(2);
  });

  it("leaves out Deleted Polls, and sends nothing if none remain", async () => {
    const kept = await createLunch();
    const gone = await createLunch();
    await polls.deletePoll(gone.ownerToken);
    sent = [];

    await recover("owner@example.com");
    expect(sent[0].text).toContain(kept.ownerToken);
    expect(sent[0].text).not.toContain(gone.ownerToken);

    await polls.deletePoll(kept.ownerToken);
    sent = [];
    await recover("owner@example.com");
    expect(sent).toEqual([]);
  });

  it("sends nothing for an unknown email", async () => {
    await createLunch();
    sent = [];
    await recover("stranger@example.com");
    expect(sent).toEqual([]);
  });

  it("resends links that keep working", async () => {
    const { ownerToken } = await createLunch();
    await recover("owner@example.com");
    expect((await polls.viewAsOwner(ownerToken, null)).kind).toBe("poll");
  });
});

describe("email language", () => {
  it("writes the creation email in the language the Poll was created in", async () => {
    await polls.createPoll({ ...lunch, language: "en" });
    expect(sent[0].subject).toBe("Your poll is ready: Friday lunch?");

    await polls.createPoll({ ...lunch, language: "ko" });
    expect(sent[1].subject).toBe("투표가 만들어졌습니다: Friday lunch?");
  });

  it("writes the recovery email in the requester's current language", async () => {
    await polls.createPoll({ ...lunch, language: "ko" });
    sent = [];
    await polls.recoverOwnerLinks({ email: lunch.ownerEmail, language: "en", origin: ORIGIN });
    expect(sent[0].subject).toBe("Your poll owner links");
  });
});

describe("Closing Time", () => {
  it("is optional", async () => {
    const { pollId } = await createLunch();
    expect((await pollFor(pollId, null)).closesAt).toBeNull();
  });

  it("must be in the future", async () => {
    expect(await polls.createPoll({ ...lunch, closesAt: later(-1) })).toEqual({
      ok: false,
      error: "closing-time-in-past",
    });
    expect(sent).toEqual([]);
  });

  it("keeps the Poll Open until it passes", async () => {
    const created = await polls.createPoll({ ...lunch, closesAt: later(60) });
    if (!created.ok) throw new Error("expected ok");
    const view = await pollFor(created.pollId, null);

    expect(view.status).toBe("open");
    expect(view.closesAt).toBe("2026-09-30T01:00:00.000Z");
    expect(await polls.castVote(created.pollId, "alice", view.options[0].id)).toEqual({ ok: true });
  });

  it("closes the Poll once it passes: no Votes, Results for everyone", async () => {
    const created = await polls.createPoll({ ...lunch, closesAt: later(60) });
    if (!created.ok) throw new Error("expected ok");
    const [pizza] = (await pollFor(created.pollId, null)).options;
    await polls.castVote(created.pollId, "alice", pizza.id);

    clock = later(60);

    const view = await pollFor(created.pollId, "bob");
    expect(view.status).toBe("closed");
    expect(view.canVote).toBe(false);
    expect(view.results?.map((r) => r.count)).toEqual([1, 0]);
    expect(await polls.castVote(created.pollId, "bob", pizza.id)).toEqual({ ok: false, error: "closed" });
    expect((await ownerView(created.ownerToken)).status).toBe("closed");
  });

  it("is removed when the Poll is reopened after it passed", async () => {
    const created = await polls.createPoll({ ...lunch, closesAt: later(60) });
    if (!created.ok) throw new Error("expected ok");
    clock = later(120);

    expect(await polls.reopenPoll(created.ownerToken)).toEqual({ ok: true });

    const view = await pollFor(created.pollId, null);
    expect(view.status).toBe("open");
    expect(view.closesAt).toBeNull();
  });

  it("is kept when a Poll closed early is reopened before it passes", async () => {
    const created = await polls.createPoll({ ...lunch, closesAt: later(60) });
    if (!created.ok) throw new Error("expected ok");
    await polls.closePoll(created.ownerToken);
    await polls.reopenPoll(created.ownerToken);

    const view = await pollFor(created.pollId, null);
    expect(view.status).toBe("open");
    expect(view.closesAt).toBe("2026-09-30T01:00:00.000Z");
  });
});

describe("viewing a Poll by its Poll Link", () => {
  it("shows the question, Options and Open status, but not the Owner Email", async () => {
    const created = await polls.createPoll(lunch);
    if (!created.ok) throw new Error("expected ok");

    const view = await polls.viewPoll(created.pollId, null);

    expect(view).toMatchObject({
      kind: "poll",
      question: "Friday lunch?",
      status: "open",
    });
    if (view.kind !== "poll") throw new Error("expected poll");
    expect(view.options.map((o) => o.label)).toEqual(["Pizza", "Tacos"]);
    expect(JSON.stringify(view)).not.toContain("owner@example.com");
  });

  it("is not found for an unknown Poll Link", async () => {
    expect(await polls.viewPoll("does-not-exist", null)).toEqual({ kind: "not-found" });
  });
});
