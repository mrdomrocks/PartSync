import { Suspense } from "react";
import { CatalogueBrowser } from "@/components/catalogue-browser";
import { ItemForm } from "@/components/item-form";
import { PageIntro } from "@/components/page-intro";
import { ShelfSkeleton } from "@/components/shelf-skeleton";
import { listItems, suggestions } from "@/lib/inventory";
import { liveDb } from "@/lib/live";
import { readSettings } from "@/lib/settings";

export const metadata = {
  title: "Items",
};

export default function CataloguePage() {
  return (
    <Suspense fallback={<ShelfSkeleton title="the catalogue" />}>
      <Catalogue />
    </Suspense>
  );
}

async function Catalogue() {
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
            : `${items.length} ${items.length === 1 ? "item" : "items"} · ${low.length} need ordering`
        }
        title="Catalogue"
        lede="Everything you count, the unit you count it in, and the line where it needs ordering."
      />
      <div className="mb-6">
        <ItemForm mode="create" hints={hints} />
      </div>
      {items.length === 0 ? (
        <p className="max-w-lg text-sm leading-6 text-muted-foreground">
          Add the first thing you count. Give it a unit and, if you want a warning, the count
          where it needs ordering.
        </p>
      ) : (
        <CatalogueBrowser items={items} timeZone={settings.timeZone} />
      )}
    </>
  );
}
