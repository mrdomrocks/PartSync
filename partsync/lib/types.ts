export type MovementKind = "out" | "in" | "set";

export type ShelfItem = {
  id: string;
  name: string;
  sku: string;
  category: string;
  unit: string;
  quantity: number;
  lowStockAt: number | null;
  supplier: string;
  notes: string;
  alertActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastOutAt: string | null;
};

export type MovementRecord = {
  id: string;
  itemId: string | null;
  itemName: string;
  itemUnit: string;
  kind: MovementKind;
  amount: number;
  previousQuantity: number;
  newQuantity: number;
  person: string;
  note: string;
  createdAt: string;
};

export type MessageStatus = "held" | "sent" | "failed" | "cancelled";
export type MessageKind = "item" | "digest" | "test";

export type MessageRecord = {
  id: string;
  kind: MessageKind;
  itemId: string | null;
  status: MessageStatus;
  detail: string;
  subject: string;
  body: string;
  payload: string;
  createdAt: string;
  sentAt: string | null;
};

export type Notice = {
  messageId: string;
};

export type ActionState = {
  ok: boolean;
  error?: string;
  message?: string;
} | null;

export type SecureMode = "starttls" | "ssl" | "none";

export type Settings = {
  siteName: string;
  timeZone: string;
  notifyEmails: string;
  smtpHost: string;
  smtpPort: string;
  smtpSecure: SecureMode;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
  publicUrl: string;
};

export type ItemDraft = {
  name: string;
  sku: string;
  category: string;
  unit: string;
  lowStockAt: number | null;
  supplier: string;
  notes: string;
};
