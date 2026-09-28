import { castVoteAction } from "./actions";
import type { Messages } from "@/lib/i18n/messages";
import type { Option, PollView, Result } from "@/lib/polls/polls";

type LoadedPoll = Extract<PollView, { kind: "poll" }>;

/** Voting area plus Results, shared by the Poll Link and Owner Link pages. */
export function PollBody({ view, t }: { view: LoadedPoll; t: Messages }) {
  return (
    <>
      <StatusBadge status={view.status} t={t} />
      {view.status === "closed" ? (
        <p className="text-zinc-500">{t.closedNotice}</p>
      ) : view.canVote ? (
        <VoteForm pollId={view.id} options={view.options} myVote={view.myVote} t={t} />
      ) : (
        <p>{t.noOptions}</p>
      )}
      {view.results ? (
        <PollResults results={view.results} myVote={view.myVote} t={t} />
      ) : (
        view.canVote && <p className="text-zinc-500">{t.resultsAfterVoting}</p>
      )}
    </>
  );
}

function StatusBadge({ status, t }: { status: "open" | "closed"; t: Messages }) {
  return (
    <span className="self-start rounded-full border border-zinc-300 px-2 py-0.5 text-xs dark:border-zinc-700">
      {status === "open" ? t.statusOpen : t.statusClosed}
    </span>
  );
}

function VoteForm({
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

function PollResults({ results, myVote, t }: { results: Result[]; myVote: number | null; t: Messages }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">{t.results}</h2>
      {results.map((r) => (
        <div key={r.optionId} className="flex flex-col gap-1">
          <div className="flex justify-between text-sm">
            <span>
              {r.label}
              {r.optionId === myVote && <span className="ml-2 text-zinc-500">({t.yourVote})</span>}
            </span>
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
