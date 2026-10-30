"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { getDb } from "@/lib/db";
import { StockError } from "@/lib/errors";
import {
  checkOutBom,
  createBom,
  createItem,
  deleteBom,
  deleteItem,
  discardMessage,
  fileTestMessage,
  moveStock,
  pendingMessages,
  queueDigest,
  updateBom,
  updateItem,
} from "@/lib/inventory";
import { deliverMessage } from "@/lib/mail";
import { bomDraftFromForm, itemDraftFromForm, parseAmount, parseKind } from "@/lib/parse";
import { writeSettings } from "@/lib/settings";
import { movementLine, stockLabel } from "@/lib/stock-rules";
import type { ActionState } from "@/lib/types";

function fail(error: unknown): ActionState {
  if (error instanceof StockError) return { ok: false, error: error.message };
  console.error(error);
  return { ok: false, error: "That didn't save. Try again in a moment." };
}

function revalidateStock(itemId?: string) {
  revalidatePath("/");
  revalidatePath("/catalogue");
  revalidatePath("/ledger");
  revalidatePath("/reorder");
  revalidatePath("/settings");
  revalidatePath("/boms");
  if (itemId) revalidatePath(`/items/${itemId}`);
}

async function sendNotice(messageId: string | null): Promise<string> {
  if (!messageId) return "";
  try {
    const delivery = await deliverMessage(getDb(), messageId);
    return ` ${delivery.userNote}`;
  } catch (error) {
    unstable_rethrow(error);
    console.error(error);
    return " The count was saved, but the reorder email could not be prepared.";
  }
}

export async function createItemAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let createdId: string | null = null;
  let noticeId: string | null = null;
  try {
    const draft = itemDraftFromForm(formData);
    const quantity = parseAmount(String(formData.get("quantity") ?? ""));
    const outcome = createItem(getDb(), { ...draft, quantity });
    createdId = outcome.item.id;
    noticeId = outcome.notice?.messageId ?? null;
  } catch (error) {
    unstable_rethrow(error);
    return fail(error);
  }
  await sendNotice(noticeId);
  revalidateStock(createdId ?? undefined);
  redirect(`/items/${createdId}`);
}

export async function updateItemAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  let noticeId: string | null = null;
  try {
    const outcome = updateItem(getDb(), id, itemDraftFromForm(formData));
    noticeId = outcome.notice?.messageId ?? null;
  } catch (error) {
    unstable_rethrow(error);
    return fail(error);
  }
  const extra = await sendNotice(noticeId);
  revalidateStock(id);
  return { ok: true, message: `Details saved.${extra}` };
}

export async function deleteItemAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  try {
    deleteItem(getDb(), id);
    revalidateStock(id);
  } catch (error) {
    unstable_rethrow(error);
    return fail(error);
  }
  redirect("/catalogue");
}

export async function moveAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let itemId = "";
  let summary = "";
  let noticeId: string | null = null;
  try {
    const outcome = moveStock(getDb(), {
      itemId: String(formData.get("itemId") ?? ""),
      kind: parseKind(formData.get("kind")),
      amount: parseAmount(String(formData.get("amount") ?? "")),
      person: String(formData.get("person") ?? ""),
      note: String(formData.get("note") ?? ""),
    });
    itemId = outcome.item.id;
    noticeId = outcome.notice?.messageId ?? null;
    summary = `${movementLine(outcome.movement.kind, outcome.movement.amount, outcome.item.unit, outcome.movement.newQuantity)}. ${stockLabel(outcome.item.quantity, outcome.item.unit)}.`;
  } catch (error) {
    unstable_rethrow(error);
    return fail(error);
  }
  const extra = await sendNotice(noticeId);
  revalidateStock(itemId);
  return { ok: true, message: `${summary}${extra}` };
}

export async function saveSettingsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    writeSettings(getDb(), {
      siteName: String(formData.get("siteName") ?? ""),
      timeZone: String(formData.get("timeZone") ?? ""),
      notifyEmails: String(formData.get("notifyEmails") ?? ""),
      smtpHost: String(formData.get("smtpHost") ?? ""),
      smtpPort: String(formData.get("smtpPort") ?? ""),
      smtpSecure: String(formData.get("smtpSecure") ?? ""),
      smtpUser: String(formData.get("smtpUser") ?? ""),
      smtpPass: String(formData.get("smtpPass") ?? ""),
      smtpFrom: String(formData.get("smtpFrom") ?? ""),
      publicUrl: String(formData.get("publicUrl") ?? ""),
    });
    revalidateStock();
    return { ok: true, message: "Setup saved." };
  } catch (error) {
    unstable_rethrow(error);
    return fail(error);
  }
}

export async function sendDigestAction(
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  try {
    const db = getDb();
    const notice = queueDigest(db);
    const delivery = await deliverMessage(db, notice.messageId);
    revalidateStock();
    if (delivery.status === "failed") return { ok: false, error: delivery.userNote };
    return { ok: true, message: delivery.userNote };
  } catch (error) {
    unstable_rethrow(error);
    return fail(error);
  }
}

export async function sendPendingAction(
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  try {
    const db = getDb();
    const waiting = pendingMessages(db);
    if (waiting.length === 0) {
      return { ok: true, message: "Nothing is waiting to be sent." };
    }
    let sent = 0;
    let failed = 0;
    let held = 0;
    for (const message of waiting) {
      const delivery = await deliverMessage(db, message.id);
      if (delivery.status === "sent") sent += 1;
      else if (delivery.status === "failed") failed += 1;
      else if (delivery.status === "held") held += 1;
    }
    revalidateStock();
    const parts = [`Sent ${sent}.`];
    if (failed) parts.push(`${failed} still failing.`);
    if (held) parts.push(`${held} still waiting on mail setup.`);
    const message = parts.join(" ");
    return failed && sent === 0 ? { ok: false, error: message } : { ok: true, message };
  } catch (error) {
    unstable_rethrow(error);
    return fail(error);
  }
}

export async function sendTestAction(
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  try {
    const db = getDb();
    const notice = fileTestMessage(db);
    const delivery = await deliverMessage(db, notice.messageId);
    revalidateStock();
    if (delivery.status === "failed") return { ok: false, error: delivery.userNote };
    return { ok: true, message: delivery.userNote };
  } catch (error) {
    unstable_rethrow(error);
    return fail(error);
  }
}

export async function createBomAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let createdId: string | null = null;
  try {
    const bom = createBom(getDb(), bomDraftFromForm(formData));
    createdId = bom.id;
  } catch (error) {
    unstable_rethrow(error);
    return fail(error);
  }
  revalidateStock();
  redirect(`/boms/${createdId}`);
}

export async function updateBomAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  try {
    updateBom(getDb(), id, bomDraftFromForm(formData));
  } catch (error) {
    unstable_rethrow(error);
    return fail(error);
  }
  revalidateStock();
  revalidatePath(`/boms/${id}`);
  return { ok: true, message: "Group saved." };
}

export async function deleteBomAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  try {
    deleteBom(getDb(), id);
  } catch (error) {
    unstable_rethrow(error);
    return fail(error);
  }
  revalidateStock();
  redirect("/boms");
}

export async function checkOutBomAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const bomId = String(formData.get("bomId") ?? "");
  let summary = "";
  let noticeIds: string[] = [];
  let itemIds: string[] = [];
  try {
    const outcome = checkOutBom(getDb(), {
      bomId,
      person: String(formData.get("person") ?? ""),
      note: String(formData.get("note") ?? ""),
    });
    noticeIds = outcome.notices.map((notice) => notice.messageId);
    itemIds = outcome.movements.flatMap((movement) =>
      movement.itemId ? [movement.itemId] : [],
    );
    const count = outcome.movements.length;
    summary = `Took ${outcome.bom.name} out. ${count} ${count === 1 ? "line" : "lines"} left the shelf.`;
  } catch (error) {
    unstable_rethrow(error);
    return fail(error);
  }
  let extra = "";
  for (const noticeId of noticeIds) {
    extra += await sendNotice(noticeId);
  }
  revalidateStock();
  revalidatePath(`/boms/${bomId}`);
  for (const itemId of itemIds) revalidatePath(`/items/${itemId}`);
  return { ok: true, message: `${summary}${extra}` };
}

export async function discardMessageAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    discardMessage(getDb(), String(formData.get("id") ?? ""));
    revalidateStock();
    return { ok: true, message: "Discarded." };
  } catch (error) {
    unstable_rethrow(error);
    return fail(error);
  }
}
