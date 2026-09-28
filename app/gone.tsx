import Link from "next/link";

export function Gone({ message, backHome }: { message: string; backHome: string }) {
  return (
    <main className="page">
      <p>{message}</p>
      <Link href="/" className="underline">{backHome}</Link>
    </main>
  );
}
