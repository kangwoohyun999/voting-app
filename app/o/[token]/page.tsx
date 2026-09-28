import { appOrigin, getMessages, getVoterId, polls } from "@/lib/server";
import { ownerAction } from "../../actions";
import { DeleteButton } from "../../delete-button";
import { Gone } from "../../gone";
import { PollBody } from "../../poll-parts";

export default async function OwnerPage({ params }: PageProps<"/o/[token]">) {
  const { token } = await params;
  const t = await getMessages();
  const view = await polls.viewAsOwner(token, await getVoterId());

  if (view.kind === "not-found") return <Gone message={t.ownerLinkNotFound} backHome={t.backHome} />;
  if (view.kind === "deleted") return <Gone message={t.deleted} backHome={t.backHome} />;

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

      <PollBody view={view} t={t} />

      <form action={ownerAction} className="flex gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <input type="hidden" name="token" value={token} />
        {view.status === "open" ? (
          <button name="intent" value="close" className="btn-secondary">{t.closePoll}</button>
        ) : (
          <button name="intent" value="reopen" className="btn-secondary">{t.reopenPoll}</button>
        )}
        <DeleteButton label={t.deletePoll} confirmText={t.confirmDelete} />
      </form>
    </main>
  );
}
