import { getMessages, getVoterId, polls } from "@/lib/server";
import { Gone } from "../../gone";
import { PollBody } from "../../poll-parts";

export default async function PollPage({ params }: PageProps<"/p/[id]">) {
  const { id } = await params;
  const t = await getMessages();
  const view = await polls.viewPoll(id, await getVoterId());

  if (view.kind === "not-found") return <Gone message={t.notFound} backHome={t.backHome} />;
  if (view.kind === "deleted") return <Gone message={t.deleted} backHome={t.backHome} />;

  return (
    <main className="page">
      <h1 className="text-2xl font-semibold">{view.question}</h1>
      <PollBody view={view} t={t} />
    </main>
  );
}
