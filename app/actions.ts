"use server";

import { refresh } from "next/cache";
import { ownerLink, pollLink } from "@/lib/polls/polls";
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
    case "delete":
      await polls.deletePoll(token);
      break;
  }
  refresh();
}

export async function recoverAction(_prev: boolean, form: FormData): Promise<boolean> {
  await polls.recoverOwnerLinks({
    email: String(form.get("email") ?? ""),
    language: await getLanguage(),
    origin: await appOrigin(),
  });
  return true; // Same answer whether or not the email has Polls.
}

export type CreateState =
  | { status: "idle" }
  | { status: "error"; error: "owner-email-required" }
  | { status: "created"; pollLink: string; ownerLink: string; emailSent: boolean };

export async function createPollAction(_prev: CreateState, form: FormData): Promise<CreateState> {
  const origin = await appOrigin();
  const result = await polls.createPoll({
    question: String(form.get("question") ?? ""),
    options: form.getAll("option").map(String),
    ownerEmail: String(form.get("ownerEmail") ?? ""),
    language: await getLanguage(),
    origin,
  });
  if (!result.ok) return { status: "error", error: result.error };

  return {
    status: "created",
    pollLink: pollLink(origin, result.pollId),
    ownerLink: ownerLink(origin, result.ownerToken),
    emailSent: result.emailSent,
  };
}
