import "server-only";
import type { Database } from "better-sqlite3";
import nodemailer from "nodemailer";
import { composeMessage } from "@/lib/compose";
import { StockError } from "@/lib/errors";
import { getMessage, markMessage } from "@/lib/inventory";
import { recipientList, readSettings, sendBlocker } from "@/lib/settings";
import type { MessageKind, MessageStatus, Settings } from "@/lib/types";

export type Delivery = {
  status: MessageStatus;
  detail: string;
  userNote: string;
};

function noteFor(
  kind: MessageKind,
  status: MessageStatus,
  recipients: string[],
  detail: string,
): string {
  const who =
    recipients.length === 0
      ? ""
      : recipients.length === 1
        ? recipients[0]
        : `${recipients.length} addresses`;
  const noun = kind === "test" ? "Test email" : "Reorder email";
  if (status === "sent") return who ? `${noun} sent to ${who}.` : `${noun} sent.`;
  if (status === "failed") return `${noun} didn't go out. ${detail} It's kept in Settings.`;
  if (status === "cancelled") return `${noun} wasn't sent. ${detail}`;
  return detail
    ? `${noun} is waiting in Settings. ${detail}`
    : `${noun} is waiting in Settings.`;
}

function safeError(error: unknown, secret: string): string {
  const raw = error instanceof Error ? error.message : "The mail server refused the message.";
  if (secret && raw.includes(secret)) return "The mail server rejected the login.";
  return raw.slice(0, 300);
}

async function sendMail(
  settings: Settings,
  message: { subject: string; text: string },
  recipients: string[],
): Promise<void> {
  const secure = settings.smtpSecure === "ssl";
  const transport = nodemailer.createTransport({
    host: settings.smtpHost,
    port: Number(settings.smtpPort),
    secure,
    requireTLS: settings.smtpSecure === "starttls",
    auth: settings.smtpUser
      ? { user: settings.smtpUser, pass: settings.smtpPass }
      : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  await transport.sendMail({
    from: `"${settings.siteName}" <${settings.smtpFrom}>`,
    to: recipients,
    subject: message.subject,
    text: message.text,
  });
}

export async function deliverMessage(db: Database, messageId: string): Promise<Delivery> {
  const message = getMessage(db, messageId);
  if (!message) throw new StockError("That email is no longer in the outbox.");
  const settings = readSettings(db).values;
  const recipients = recipientList(settings.notifyEmails);
  if (message.status === "sent" || message.status === "cancelled") {
    return {
      status: message.status,
      detail: message.detail,
      userNote: noteFor(message.kind, message.status, recipients, message.detail),
    };
  }

  const blocker = sendBlocker(settings);
  if (blocker) {
    markMessage(db, message.id, { status: "held", detail: blocker });
    return {
      status: "held",
      detail: blocker,
      userNote: noteFor(message.kind, "held", recipients, blocker),
    };
  }

  const composed = composeMessage(db, message.id, settings);
  if (!composed) {
    const detail = "Nothing on that note is still below its reorder line.";
    markMessage(db, message.id, { status: "cancelled", detail });
    return {
      status: "cancelled",
      detail,
      userNote: noteFor(message.kind, "cancelled", recipients, detail),
    };
  }

  try {
    await sendMail(settings, composed, recipients);
    const sentAt = new Date().toISOString();
    markMessage(db, message.id, {
      status: "sent",
      detail: "",
      subject: composed.subject,
      body: composed.text,
      sentAt,
    });
    return {
      status: "sent",
      detail: "",
      userNote: noteFor(message.kind, "sent", recipients, ""),
    };
  } catch (error) {
    const detail = safeError(error, settings.smtpPass);
    console.error(`PartSync mail to ${settings.smtpHost} failed: ${detail}`);
    markMessage(db, message.id, {
      status: "failed",
      detail,
      subject: composed.subject,
      body: composed.text,
    });
    return {
      status: "failed",
      detail,
      userNote: noteFor(message.kind, "failed", recipients, detail),
    };
  }
}
