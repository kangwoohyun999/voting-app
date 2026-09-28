import Link from "next/link";
import { getMessages, getVoterId, polls } from "@/lib/server";
import { PollResults, VoteForm } from "../../poll-parts";

export default async function PollPage({ params }: PageProps<"/p/[id]">) {
  const { id } = await params;
  const t = await getMessages();
  const view = await polls.viewPoll(id, await getVoterId());

  if (view.kind === "not-found") {
    return (
      <main className="page">
        <p>{t.notFound}</p>
        <Link href="/" className="underline">{t.backHome}</Link>
      </main>
    );
  }

  return (
    <main className="page">
      <h1 className="text-2xl font-semibold">{view.question}</h1>
      {view.canVote ? (
        <VoteForm pollId={view.id} options={view.options} myVote={view.myVote} t={t} />
      ) : (
        <p>{t.noOptions}</p>
      )}
      {view.results ? (
        <PollResults results={view.results} t={t} />
      ) : (
        view.canVote && <p className="text-zinc-500">{t.resultsAfterVoting}</p>
      )}
    </main>
  );
}
