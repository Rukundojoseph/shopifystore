import Link from "next/link";
export default function Suspended() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-2xl font-semibold">This store has been suspended</h1>
      <p className="max-w-md text-zinc-600">Please contact StoreHub support to resolve this.</p>
      <Link href="/login" className="text-brand-700 underline">Back</Link>
    </div>
  );
}
