"use client";

import { useActionState, useState } from "react";
import { createPollAction, type CreateState } from "./actions";
import type { Messages } from "@/lib/i18n/messages";

export function CreatePollForm({ t }: { t: Messages }) {
  const [state, action, pending] = useActionState(createPollAction, { status: "idle" } as CreateState);
  const [optionKeys, setOptionKeys] = useState([0, 1]);
  const [nextKey, setNextKey] = useState(2);

  if (state.status === "created") {
    return (
      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">{t.created}</h2>
        <LinkBox label={t.pollLinkLabel} href={state.pollLink} />
        <LinkBox label={t.ownerLinkLabel} href={state.ownerLink} />
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {state.emailSent ? t.ownerLinkEmailed : t.ownerLinkEmailFailed}
        </p>
      </section>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="font-medium">{t.question}</span>
        <input name="question" placeholder={t.questionPlaceholder} className="input" />
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="font-medium mb-1">{t.options}</legend>
        {optionKeys.map((key, i) => (
          <div key={key} className="flex gap-2">
            <input name="option" placeholder={`${t.optionPlaceholder} ${i + 1}`} className="input flex-1" />
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setOptionKeys(optionKeys.filter((k) => k !== key))}
            >
              {t.removeOption}
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn-secondary self-start"
          onClick={() => {
            setOptionKeys([...optionKeys, nextKey]);
            setNextKey(nextKey + 1);
          }}
        >
          {t.addOption}
        </button>
      </fieldset>

      <label className="flex flex-col gap-1">
        <span className="font-medium">{t.ownerEmail}</span>
        <input name="ownerEmail" type="email" required className="input" />
      </label>
      {state.status === "error" && <p className="text-red-600">{t.ownerEmailRequired}</p>}

      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? t.creating : t.create}
      </button>
    </form>
  );
}

function LinkBox({ label, href }: { label: string; href: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm text-zinc-600 dark:text-zinc-400">{label}</span>
      <a href={href} className="break-all rounded border border-zinc-300 p-2 font-mono text-sm dark:border-zinc-700">
        {href}
      </a>
    </div>
  );
}
