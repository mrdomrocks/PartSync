import Link from "next/link";
import { Suspense } from "react";
import { BomList } from "@/components/bom-list";
import { PageIntro } from "@/components/page-intro";
import { ShelfSkeleton } from "@/components/shelf-skeleton";
import { listBoms } from "@/lib/inventory";
import { liveDb } from "@/lib/live";

export const metadata = {
  title: "BoM",
};

export default function BomsPage() {
  return (
    <Suspense fallback={<ShelfSkeleton title="bills of materials" />}>
      <Boms />
    </Suspense>
  );
}

async function Boms() {
  const db = await liveDb();
  const boms = listBoms(db);

  return (
    <>
      <PageIntro
        eyebrow={
          boms.length === 0
            ? "No groups yet"
            : `${boms.length} ${boms.length === 1 ? "group" : "groups"}`
        }
        title="Bills of materials"
        lede="Pick catalogue lines that have to leave the shelf together. A printed code opens that checkout, and the whole group leaves in one go."
      />
      <div className="mb-6">
        <Link
          href="/boms/new"
          className="inline-flex h-12 items-center rounded-lg bg-primary px-4 text-base font-medium text-primary-foreground hover:bg-primary/80"
        >
          New group
        </Link>
      </div>
      {boms.length === 0 ? (
        <p className="max-w-lg text-sm leading-6 text-muted-foreground">
          A group is a kit: the seal, the fasteners, the tube. Checking it out takes every line, or
          none of them, if one is short.
        </p>
      ) : (
        <BomList boms={boms} />
      )}
    </>
  );
}
