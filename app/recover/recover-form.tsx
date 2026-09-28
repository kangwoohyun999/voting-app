"use client";

import { useActionState } from "react";
import { recoverAction } from "../actions";
import type { Messages } from "@/lib/i18n/messages";

export function RecoverForm({ t }: { t: Messages }) {
  const [submitted, action, pending] = useActionState(recoverAction, false);

  if (submitted) return <p>{t.recoverSent}</p>;

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="font-medium">{t.recoverEmail}</span>
        <input name="email" type="email" required className="input" />
      </label>
      <button type="submit" disabled={pending} className="btn-primary self-start">
        {t.recoverSubmit}
      </button>
    </form>
  );
}
