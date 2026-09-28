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
