import type { Database } from "better-sqlite3";
import { StockError } from "@/lib/errors";
import {
  parseEmails,
  parsePort,
  parsePublicUrl,
  parseSecureMode,
  parseTimeZone,
} from "@/lib/parse";
import type { SecureMode, Settings } from "@/lib/types";

export const DEFAULT_SETTINGS: Settings = {
  siteName: "PartSync",
  timeZone: "Europe/London",
  notifyEmails: "",
  smtpHost: "",
  smtpPort: "587",
  smtpSecure: "starttls",
  smtpUser: "",
  smtpPass: "",
  smtpFrom: "",
  publicUrl: "",
};

const ENV_KEYS: Record<keyof Settings, string> = {
  siteName: "PARTSYNC_SITE_NAME",
  timeZone: "PARTSYNC_TIME_ZONE",
  notifyEmails: "PARTSYNC_NOTIFY_EMAIL",
  smtpHost: "PARTSYNC_SMTP_HOST",
  smtpPort: "PARTSYNC_SMTP_PORT",
  smtpSecure: "PARTSYNC_SMTP_SECURE",
  smtpUser: "PARTSYNC_SMTP_USER",
  smtpPass: "PARTSYNC_SMTP_PASS",
  smtpFrom: "PARTSYNC_SMTP_FROM",
  publicUrl: "PARTSYNC_PUBLIC_URL",
};

function storedSettings(db: Database): Partial<Record<keyof Settings, string>> {
  const rows = db.prepare("SELECT key, value FROM settings").all() as {
    key: string;
    value: string;
  }[];
  const found: Partial<Record<keyof Settings, string>> = {};
  for (const row of rows) {
    if (row.key in DEFAULT_SETTINGS) {
      found[row.key as keyof Settings] = row.value;
    }
  }
  return found;
}

function envValue(key: keyof Settings): string | undefined {
  const raw = process.env[ENV_KEYS[key]];
  if (raw == null) return undefined;
  const trimmed = raw.trim();
  return trimmed ? trimmed : undefined;
}

export function readSettings(db: Database): {
  values: Settings;
  locked: Record<keyof Settings, boolean>;
} {
  const stored = storedSettings(db);
  const locked = {} as Record<keyof Settings, boolean>;
  const values = { ...DEFAULT_SETTINGS };
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
    const fromEnv = envValue(key);
    locked[key] = fromEnv != null;
    const raw = fromEnv ?? stored[key] ?? DEFAULT_SETTINGS[key];
    if (key === "smtpSecure") {
      const mode = raw.toLowerCase();
      values.smtpSecure =
        mode === "ssl" || mode === "none" || mode === "starttls" ? mode : "starttls";
    } else {
      values[key] = raw;
    }
  }
  return { values, locked };
}

export function publicSettings(db: Database): {
  values: Omit<Settings, "smtpPass"> & { hasPassword: boolean };
  locked: Record<keyof Settings, boolean>;
} {
  const { values, locked } = readSettings(db);
  const { smtpPass, ...rest } = values;
  return {
    values: { ...rest, hasPassword: smtpPass.trim().length > 0 },
    locked,
  };
}

export type SettingsInput = {
  siteName: string;
  timeZone: string;
  notifyEmails: string;
  smtpHost: string;
  smtpPort: string;
  smtpSecure: string;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
  publicUrl: string;
};

export function writeSettings(db: Database, input: SettingsInput): Settings {
  const current = readSettings(db);
  const next: Settings = { ...current.values };

  if (!current.locked.siteName) {
    const siteName = input.siteName.trim();
    if (!siteName) throw new StockError("Give this stock room a name.");
    if (siteName.length > 60) throw new StockError("That name is too long.");
    next.siteName = siteName;
  }
  if (!current.locked.timeZone) next.timeZone = parseTimeZone(input.timeZone);
  if (!current.locked.notifyEmails) {
    next.notifyEmails = parseEmails(input.notifyEmails).join(", ");
  }
  if (!current.locked.smtpHost) {
    const host = input.smtpHost.trim();
    if (host.length > 200) throw new StockError("That SMTP host is too long.");
    next.smtpHost = host;
  }
  if (!current.locked.smtpPort) next.smtpPort = parsePort(input.smtpPort || "587");
  if (!current.locked.smtpSecure) {
    next.smtpSecure = parseSecureMode(input.smtpSecure) as SecureMode;
  }
  if (!current.locked.smtpUser) {
    const user = input.smtpUser.trim();
    if (user.length > 200) throw new StockError("That SMTP username is too long.");
    next.smtpUser = user;
  }
  if (!current.locked.smtpPass && input.smtpPass.trim()) {
    if (input.smtpPass.length > 400) throw new StockError("That SMTP password is too long.");
    next.smtpPass = input.smtpPass;
  }
  if (!current.locked.smtpFrom) {
    const from = input.smtpFrom.trim();
    if (from) parseEmails(from);
    if (from.length > 200) throw new StockError("That From address is too long.");
    next.smtpFrom = from;
  }
  if (!current.locked.publicUrl) next.publicUrl = parsePublicUrl(input.publicUrl);

  const upsert = db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  );
  const save = db.transaction(() => {
    for (const key of Object.keys(next) as (keyof Settings)[]) {
      if (current.locked[key]) continue;
      upsert.run(key, next[key]);
    }
  });
  save();
  return readSettings(db).values;
}

export function recipientList(value: string): string[] {
  return value
    .split(/[,;\n]+/)
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

export function sendBlocker(settings: Settings): string | null {
  if (recipientList(settings.notifyEmails).length === 0) {
    return "Add the email address that should hear when stock is low.";
  }
  if (!settings.smtpHost.trim()) return "Add the SMTP server that will send the mail.";
  if (!settings.smtpFrom.trim()) return "Add the From address the mail should use.";
  const port = Number(settings.smtpPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return "The SMTP port looks wrong.";
  }
  return null;
}
