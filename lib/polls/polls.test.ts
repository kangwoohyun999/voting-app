import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import { createPolls, type Db, type Polls } from "./polls";

const SCHEMA = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");

let polls: Polls;

beforeEach(async () => {
  const pg = new PGlite();
  await pg.exec(SCHEMA);
  const db: Db = {
    query: async (text, params) => (await pg.query(text, params)).rows as never,
  };
  polls = createPolls({ db });
});

const lunch = {
  question: "Friday lunch?",
  options: ["Pizza", "Tacos"],
  ownerEmail: "owner@example.com",
  language: "ko" as const,
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
