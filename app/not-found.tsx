import Link from "next/link";

export default function NotFound() {
  return (
    <div className="max-w-lg">
      <h1 className="font-heading text-4xl tracking-tight">That page isn’t on the shelf</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        The item may have been removed, or the address is wrong.
      </p>
      <Link href="/" className="mt-5 inline-block text-sm underline underline-offset-4">
        Back to the board
      </Link>
    </div>
  );
}
