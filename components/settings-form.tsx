"use client";

import { useActionState } from "react";
import { saveSettingsAction } from "@/app/actions";
import { StatusNote } from "@/components/status-note";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TIME_ZONES } from "@/lib/time";
import type { Settings } from "@/lib/types";

type PublicValues = Omit<Settings, "smtpPass"> & { hasPassword: boolean };

function LockNote({ locked }: { locked: boolean }) {
  if (!locked) return null;
  return (
    <p className="text-xs text-muted-foreground">Set on the server, so this field is locked.</p>
  );
}

export function SettingsForm({
  values,
  locked,
}: {
  values: PublicValues;
  locked: Record<keyof Settings, boolean>;
}) {
  const [state, action, pending] = useActionState(saveSettingsAction, null);
  const zones = TIME_ZONES.includes(values.timeZone)
    ? TIME_ZONES
    : [values.timeZone, ...TIME_ZONES];

  return (
    <form action={action} className="space-y-8">
      <StatusNote state={state} />
      <fieldset className="space-y-4" disabled={pending}>
        <legend className="font-heading text-2xl tracking-tight">The room</legend>
        <div className="space-y-1.5">
          <Label htmlFor="siteName">Name</Label>
          <Input
            id="siteName"
            name="siteName"
            defaultValue={values.siteName}
            disabled={locked.siteName}
            required
            maxLength={60}
            className="h-11 text-base"
          />
          <LockNote locked={locked.siteName} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="timeZone">Time zone</Label>
          <select
            id="timeZone"
            name="timeZone"
            defaultValue={values.timeZone}
            disabled={locked.timeZone}
            className="h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-base"
          >
            {zones.map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </select>
          <LockNote locked={locked.timeZone} />
          <p className="text-xs leading-5 text-muted-foreground">
            “Taken today” follows this clock, even if the Pi itself is set to UTC.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="publicUrl">Address on the network</Label>
          <Input
            id="publicUrl"
            name="publicUrl"
            defaultValue={values.publicUrl}
            disabled={locked.publicUrl}
            placeholder="http://192.168.1.20:4747"
            className="h-11 text-base"
            inputMode="url"
          />
          <LockNote locked={locked.publicUrl} />
          <p className="text-xs leading-5 text-muted-foreground">
            Put in the order emails so the link opens on a phone. Leave blank if you don’t want a link.
          </p>
        </div>
      </fieldset>

      <fieldset className="space-y-4" disabled={pending}>
        <legend className="font-heading text-2xl tracking-tight">Who to tell</legend>
        <div className="space-y-1.5">
          <Label htmlFor="notifyEmails">Email addresses</Label>
          <Textarea
            id="notifyEmails"
            name="notifyEmails"
            defaultValue={values.notifyEmails}
            disabled={locked.notifyEmails}
            placeholder="stores@example.com"
            className="text-base"
          />
          <LockNote locked={locked.notifyEmails} />
          <p className="text-xs leading-5 text-muted-foreground">
            One address, or several separated by commas. They get a mail when an item crosses its reorder line, and not again until it is restocked above that line.
          </p>
        </div>
      </fieldset>

      <fieldset className="space-y-4" disabled={pending}>
        <legend className="font-heading text-2xl tracking-tight">Mail server</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="smtpHost">SMTP host</Label>
            <Input
              id="smtpHost"
              name="smtpHost"
              defaultValue={values.smtpHost}
              disabled={locked.smtpHost}
              placeholder="smtp.example.com"
              className="h-11 text-base"
              autoComplete="off"
            />
            <LockNote locked={locked.smtpHost} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="smtpPort">Port</Label>
            <Input
              id="smtpPort"
              name="smtpPort"
              defaultValue={values.smtpPort}
              disabled={locked.smtpPort}
              inputMode="numeric"
              className="h-11 text-base"
            />
            <LockNote locked={locked.smtpPort} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="smtpSecure">Encryption</Label>
          <select
            id="smtpSecure"
            name="smtpSecure"
            defaultValue={values.smtpSecure}
            disabled={locked.smtpSecure}
            className="h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-base"
          >
            <option value="starttls">STARTTLS (usually port 587)</option>
            <option value="ssl">SSL (usually port 465)</option>
            <option value="none">None, for a relay on this network</option>
          </select>
          <LockNote locked={locked.smtpSecure} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="smtpUser">Username</Label>
            <Input
              id="smtpUser"
              name="smtpUser"
              defaultValue={values.smtpUser}
              disabled={locked.smtpUser}
              className="h-11 text-base"
              autoComplete="off"
            />
            <LockNote locked={locked.smtpUser} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="smtpPass">Password</Label>
            <Input
              id="smtpPass"
              name="smtpPass"
              type="password"
              disabled={locked.smtpPass}
              placeholder={
                locked.smtpPass
                  ? "Set on the server"
                  : values.hasPassword
                    ? "Saved — leave blank to keep it"
                    : "SMTP password"
              }
              className="h-11 text-base"
              autoComplete="new-password"
            />
            <LockNote locked={locked.smtpPass} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="smtpFrom">From address</Label>
          <Input
            id="smtpFrom"
            name="smtpFrom"
            type="email"
            defaultValue={values.smtpFrom}
            disabled={locked.smtpFrom}
            placeholder="stores@example.com"
            className="h-11 text-base"
          />
          <LockNote locked={locked.smtpFrom} />
        </div>
      </fieldset>

      <Button type="submit" className="h-11 px-4" disabled={pending}>
        {pending ? "Saving…" : "Save setup"}
      </Button>
    </form>
  );
}
