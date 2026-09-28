import Link from "next/link";
import { getMessages, polls } from "@/lib/server";

export default async function PollPage({ params }: PageProps<"/p/[id]">) {
  const { id } = await params;
  const t = await getMessages();
  const view = await polls.viewPoll(id, null);

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
      <ul className="flex flex-col gap-2">
        {view.options.map((o) => (
          <li key={o.id} className="rounded border border-zinc-300 p-3 dark:border-zinc-700">
            {o.label}
          </li>
        ))}
      </ul>
    </main>
  );
}
