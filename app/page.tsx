import Link from "next/link";
import { getMessages } from "@/lib/server";
import { CreatePollForm } from "./create-poll-form";

export default async function Home() {
  const t = await getMessages();
  return (
    <main className="page">
      <h1 className="text-2xl font-semibold">{t.createTitle}</h1>
      <CreatePollForm t={t} />
      <Link href="/recover" className="text-sm text-zinc-500 underline">{t.recoverLink}</Link>
    </main>
  );
}
