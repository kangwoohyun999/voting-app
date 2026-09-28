import Link from "next/link";
import { getMessages, getVoterId, polls } from "@/lib/server";
import { PollBody } from "../../poll-parts";

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
      <PollBody view={view} t={t} />
    </main>
  );
}
