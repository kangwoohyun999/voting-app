import { castVoteAction } from "./actions";
import type { Messages } from "@/lib/i18n/messages";
import type { Option, PollView, Result } from "@/lib/polls/polls";

type LoadedPoll = Extract<PollView, { kind: "poll" }>;

/** Voting area plus Results, shared by the Poll Link and Owner Link pages. */
export function PollBody({ view, t }: { view: LoadedPoll; t: Messages }) {
  return (
    <>
      <StatusBadge status={view.status} t={t} />
      {view.closesAt && (
        <p className="text-sm text-zinc-500">
          {t.closesAt}: {formatKoreanTime(view.closesAt, t.dateLocale)} (KST)
        </p>
      )}
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

const formatKoreanTime = (iso: string, locale: string) =>
  new Intl.DateTimeFormat(locale, { timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short" }).format(
    new Date(iso),
  );

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

/**
 * Horizontal bar chart of Results: one series, so one color and no legend.
 * Bar length is the Option's share of all Votes; every value is also shown as text.
 */
function PollResults({ results, myVote, t }: { results: Result[]; myVote: number | null; t: Messages }) {
  const total = results.reduce((sum, r) => sum + r.count, 0);
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">{t.results}</h2>
        <span className="text-sm text-zinc-500 tabular-nums">
          {t.totalVotes} {total} {t.votes}
        </span>
      </div>
      <ul className="flex flex-col gap-3">
        {results.map((r) => {
          const label = r.label || "—";
          const mine = r.optionId === myVote;
          const summary = `${label}: ${r.count} ${t.votes} (${r.percent}%)${mine ? ` · ${t.yourVote}` : ""}`;
          return (
            <li key={r.optionId} className="group relative flex flex-col gap-1" tabIndex={0} aria-label={summary}>
              <span className="break-words text-sm">
                {label}
                {mine && <span className="ml-2 text-zinc-500">({t.yourVote})</span>}
              </span>
              <div className="grid grid-cols-[1fr_auto] items-center gap-3">
                <div className="h-5 border-l border-zinc-300 dark:border-zinc-700">
                  <div
                    className="h-5 rounded-r bg-(--chart-bar)"
                    style={{ width: `${r.percent}%` }}
                  />
                </div>
                <span className="text-sm text-zinc-600 tabular-nums dark:text-zinc-400">
                  {r.count} {t.votes} · {r.percent}%
                </span>
              </div>
              <span
                role="tooltip"
                className="pointer-events-none absolute -top-8 left-0 z-10 hidden whitespace-nowrap rounded bg-foreground px-2 py-1 text-xs text-background group-hover:block group-focus:block"
              >
                {summary}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
