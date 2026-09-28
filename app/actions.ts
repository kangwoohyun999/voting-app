"use server";

import { refresh } from "next/cache";
import { appOrigin, ensureVoterId, getLanguage, polls } from "@/lib/server";

export async function castVoteAction(form: FormData) {
  const pollId = String(form.get("pollId"));
  const optionId = Number(form.get("optionId"));
  if (!Number.isInteger(optionId)) return;
  await polls.castVote(pollId, await ensureVoterId(), optionId);
  refresh();
}

// Authorised only by the Owner Link token; the Polls module rejects a wrong one.
export async function ownerAction(form: FormData) {
  const token = String(form.get("token"));
  switch (form.get("intent")) {
    case "close":
      await polls.closePoll(token);
      break;
    case "reopen":
      await polls.reopenPoll(token);
      break;
  }
  refresh();
}

export type CreateState =
  | { status: "idle" }
  | { status: "error"; error: "owner-email-required" }
  | { status: "created"; pollLink: string; ownerLink: string };

export async function createPollAction(_prev: CreateState, form: FormData): Promise<CreateState> {
  const result = await polls.createPoll({
    question: String(form.get("question") ?? ""),
    options: form.getAll("option").map(String),
    ownerEmail: String(form.get("ownerEmail") ?? ""),
    language: await getLanguage(),
  });
  if (!result.ok) return { status: "error", error: result.error };

  const origin = await appOrigin();
  return {
    status: "created",
    pollLink: `${origin}/p/${result.pollId}`,
    ownerLink: `${origin}/o/${result.ownerToken}`,
  };
}
