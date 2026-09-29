"use server";

import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { ownerLink, pollLink, type Polls } from "@/lib/polls/polls";
import { appOrigin, ensureVoterId, getLanguage, LANGUAGE_COOKIE, polls } from "@/lib/server";

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

export async function switchLanguageAction() {
  const next = (await getLanguage()) === "ko" ? "en" : "ko";
  (await cookies()).set(LANGUAGE_COOKIE, next, { sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
}

export async function recoverAction(_prev: boolean, form: FormData): Promise<boolean> {
  await polls.recoverOwnerLinks({
    email: String(form.get("email") ?? ""),
    language: await getLanguage(),
    origin: await appOrigin(),
  });
  return true; // Same answer whether or not the email has Polls.
}

type CreatePollError = Extract<Awaited<ReturnType<Polls["createPoll"]>>, { ok: false }>["error"];

export type CreateState =
  | { status: "idle" }
  | { status: "error"; error: CreatePollError }
  | { status: "created"; pollLink: string; ownerLink: string; emailSent: boolean };

/** A `datetime-local` value ("2026-09-30T18:00") read as Korean time. */
function parseKoreanTime(value: FormDataEntryValue | null): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  return new Date(`${value}:00+09:00`);
}

export async function createPollAction(_prev: CreateState, form: FormData): Promise<CreateState> {
  const origin = await appOrigin();
  const result = await polls.createPoll({
    question: String(form.get("question") ?? ""),
    options: form.getAll("option").map(String),
    ownerEmail: String(form.get("ownerEmail") ?? ""),
    language: await getLanguage(),
    origin,
    closesAt: parseKoreanTime(form.get("closesAt")),
    operatorPassword: String(form.get("operatorPassword") ?? ""),
  });
  if (!result.ok) return { status: "error", error: result.error };

  return {
    status: "created",
    pollLink: pollLink(origin, result.pollId),
    ownerLink: ownerLink(origin, result.ownerToken),
    emailSent: result.emailSent,
  };
}
