import { Suspense } from "react";
import { DiscardButton, SendPendingButton, SendTestButton } from "@/components/mail-actions";
import { PageIntro } from "@/components/page-intro";
import { SettingsForm } from "@/components/settings-form";
import { ShelfSkeleton } from "@/components/shelf-skeleton";
import { composeMessage } from "@/lib/compose";
import { listMessages } from "@/lib/inventory";
import { liveDb } from "@/lib/live";
import { publicSettings, readSettings } from "@/lib/settings";
import { formatWhen } from "@/lib/time";
import type { MessageRecord } from "@/lib/types";

export const metadata = {
  title: "Setup",
};

const statusLabel: Record<MessageRecord["status"], string> = {
  held: "Waiting",
  sent: "Sent",
  failed: "Not sent",
  cancelled: "Cancelled",
};

export default function SettingsPage() {
  return (
    <Suspense fallback={<ShelfSkeleton title="setup" />}>
      <Settings />
    </Suspense>
  );
}

async function Settings() {
  const db = await liveDb();
  const full = readSettings(db);
  const visible = publicSettings(db);
  const messages = listMessages(db, 15);

  return (
    <>
      <PageIntro
        eyebrow="Mail and the clock"
        title="Setup"
        lede="When stock hits a reorder line, PartSync emails the addresses here. Until a mail server is filled in, those notes wait in the outbox below."
      />
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <SettingsForm values={visible.values} locked={visible.locked} />
        <div className="space-y-6">
          <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
            <h2 className="font-heading text-2xl tracking-tight">Outbox</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              A low-stock email is sent once per dip below the line. Restocking above the line
              arms it again. Anyone who can open this address can change these settings — keep
              PartSync on your own network.
            </p>
            <div className="mt-4 flex flex-col items-start gap-4">
              <SendPendingButton />
              <SendTestButton />
            </div>
            {messages.length === 0 ? (
              <p className="mt-5 text-sm text-muted-foreground">
                No reorder mail yet. Take a part below its line and the note will wait here until mail is set up.
              </p>
            ) : (
              <ol className="mt-5 divide-y divide-border">
                {messages.map((message) => {
                  const stored =
                    message.subject && message.body
                      ? { subject: message.subject, text: message.body }
                      : null;
                  const live =
                    message.status === "cancelled"
                      ? null
                      : (stored ?? composeMessage(db, message.id, full.values));
                  return (
                    <li key={message.id} className="py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">
                            {statusLabel[message.status]}
                            <span className="font-normal text-muted-foreground">
                              {" "}
                              · {message.kind === "test" ? "Test" : message.kind === "digest" ? "Order list" : "Item"}
                            </span>
                          </p>
                          <p className="text-xs text-muted-foreground tabular-nums">
                            {formatWhen(message.sentAt ?? message.createdAt, full.values.timeZone)}
                          </p>
                        </div>
                        {message.status === "held" || message.status === "failed" ? (
                          <DiscardButton id={message.id} />
                        ) : null}
                      </div>
                      {message.detail ? (
                        <p className="mt-2 text-sm text-muted-foreground">{message.detail}</p>
                      ) : null}
                      {live ? (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-sm">{live.subject}</summary>
                          <pre className="mt-2 overflow-x-auto font-sans text-xs leading-5 whitespace-pre-wrap text-muted-foreground">
                            {live.text}
                          </pre>
                        </details>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
          <section className="rounded-xl border border-border bg-card p-4 text-sm leading-6 text-muted-foreground sm:p-5">
            Counts live in <span className="text-foreground">data/partsync.db</span> on this
            machine. Stop PartSync and copy that file, or run{" "}
            <span className="text-foreground">npm run backup</span>, to keep a spare.
          </section>
        </div>
      </div>
    </>
  );
}
