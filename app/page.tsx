import { Suspense } from "react";
import { CatalogueBrowser } from "@/components/catalogue-browser";
import { ItemForm } from "@/components/item-form";
import { PageIntro } from "@/components/page-intro";
import { ShelfSkeleton } from "@/components/shelf-skeleton";
import { listItems, suggestions } from "@/lib/inventory";
import { liveDb } from "@/lib/live";
import { readSettings } from "@/lib/settings";

export const metadata = {
  title: { absolute: "PartSync" },
};

export default function HomePage() {
  return (
    <Suspense fallback={<ShelfSkeleton title="the parts" />}>
      <Parts />
    </Suspense>
  );
}

async function Parts() {
  const db = await liveDb();
  const settings = readSettings(db).values;
  const items = listItems(db);
  const hints = suggestions(db);
  const low = items.filter((item) => item.lowStockAt != null && item.quantity <= item.lowStockAt);

  return (
    <>
      <PageIntro
        eyebrow={
          items.length === 0
            ? "Nothing counted yet"
            : `${items.length} ${items.length === 1 ? "part" : "parts"} · ${low.length} need ordering`
        }
        title="Parts"
        lede="Everything you count, the unit you count it in, and the line where it needs ordering."
      />
      <div className="mb-6">
        <ItemForm mode="create" hints={hints} />
      </div>
      {items.length === 0 ? (
        <p className="max-w-lg text-sm leading-6 text-muted-foreground">
          Add the first part you count. Give it a unit and, if you want a warning, the count
          where it needs ordering.
        </p>
      ) : (
        <CatalogueBrowser items={items} timeZone={settings.timeZone} />
      )}
    </>
  );
}
