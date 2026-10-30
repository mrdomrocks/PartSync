import Link from "next/link";
import { Suspense } from "react";
import { BomEditor } from "@/components/bom-editor";
import { PageIntro } from "@/components/page-intro";
import { ShelfSkeleton } from "@/components/shelf-skeleton";
import { listItems } from "@/lib/inventory";
import { liveDb } from "@/lib/live";

export const metadata = {
  title: "New group",
};

export default function NewBomPage() {
  return (
    <Suspense fallback={<ShelfSkeleton title="a new group" />}>
      <NewBom />
    </Suspense>
  );
}

async function NewBom() {
  const db = await liveDb();
  const items = listItems(db);
  return (
    <>
      <p className="mb-3 text-sm text-muted-foreground">
        <Link href="/boms" className="underline-offset-4 hover:underline">
          Bills of materials
        </Link>
      </p>
      <PageIntro
        title="New group"
        lede="Choose the catalogue lines that have to go out together, and how many of each."
      />
      <BomEditor items={items} />
    </>
  );
}
