import Link from "next/link";
import { appOrigin, getMessages, getVoterId, polls } from "@/lib/server";
import { PollResults, VoteForm } from "../../poll-parts";

export default async function OwnerPage({ params }: PageProps<"/o/[token]">) {
  const { token } = await params;
  const t = await getMessages();
  const view = await polls.viewAsOwner(token, await getVoterId());

  if (view.kind === "not-found") {
    return (
      <main className="page">
        <p>{t.ownerLinkNotFound}</p>
        <Link href="/" className="underline">{t.backHome}</Link>
      </main>
    );
  }

  const pollLink = `${await appOrigin()}/p/${view.id}`;

  return (
    <main className="page">
      <p className="text-sm text-zinc-500">{t.ownerPageTitle}</p>
      <h1 className="text-2xl font-semibold">{view.question}</h1>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-zinc-500">{t.pollLinkLabel}</dt>
        <dd className="break-all font-mono">
          <a href={pollLink} className="underline">{pollLink}</a>
        </dd>
        <dt className="text-zinc-500">{t.ownerEmailHint}</dt>
        <dd>{view.ownerEmailHint}</dd>
      </dl>

      {view.results && <PollResults results={view.results} t={t} />}
      {view.canVote ? (
        <VoteForm pollId={view.id} options={view.options} myVote={view.myVote} t={t} />
      ) : (
        <p>{t.noOptions}</p>
      )}
    </main>
  );
}
