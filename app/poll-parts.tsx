import { castVoteAction } from "./actions";
import type { Messages } from "@/lib/i18n/messages";
import type { Option, Result } from "@/lib/polls/polls";

export function VoteForm({
  pollId,
  options,
  myVote,
  t,
}: {
  pollId: string;
  options: Option[];
  myVote: number | null;
  t: Messages;
}) {
  return (
    <form action={castVoteAction} className="flex flex-col gap-2">
      <input type="hidden" name="pollId" value={pollId} />
      {options.map((o) => (
        <label
          key={o.id}
          className="flex items-center gap-3 rounded border border-zinc-300 p-3 has-checked:border-foreground dark:border-zinc-700"
        >
          <input type="radio" name="optionId" value={o.id} defaultChecked={o.id === myVote} required />
          <span>{o.label}</span>
          {o.id === myVote && <span className="ml-auto text-sm text-zinc-500">{t.yourVote}</span>}
        </label>
      ))}
      <button type="submit" className="btn-primary self-start">
        {myVote === null ? t.vote : t.switchVote}
      </button>
    </form>
  );
}

export function PollResults({ results, t }: { results: Result[]; t: Messages }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">{t.results}</h2>
      {results.map((r) => (
        <div key={r.optionId} className="flex flex-col gap-1">
          <div className="flex justify-between text-sm">
            <span>{r.label}</span>
            <span className="tabular-nums">
              {r.count} {t.votes} · {r.percent}%
            </span>
          </div>
          <div className="h-2 rounded bg-zinc-200 dark:bg-zinc-800">
            <div className="h-2 rounded bg-foreground" style={{ width: `${r.percent}%` }} />
          </div>
        </div>
      ))}
    </section>
  );
}
