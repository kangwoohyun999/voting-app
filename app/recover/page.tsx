import { getMessages } from "@/lib/server";
import { RecoverForm } from "./recover-form";

export default async function RecoverPage() {
  const t = await getMessages();
  return (
    <main className="page">
      <h1 className="text-2xl font-semibold">{t.recoverTitle}</h1>
      <p className="text-zinc-600 dark:text-zinc-400">{t.recoverIntro}</p>
      <RecoverForm t={t} />
    </main>
  );
}
