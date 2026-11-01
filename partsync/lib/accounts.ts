import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import type Database from "better-sqlite3";

export const SESSION_COOKIE = "partsync_session";
export const SESSION_MS = 12 * 60 * 60 * 1000;
export const MAX_FAILURES = 8;
export const LOCK_MS = 15 * 60 * 1000;

export type Account = { id: string; email: string; name: string };

type AccountRow = Account & { password_hash: string; created_at: string };

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("base64url");
  const hash = scryptSync(password, salt, 32).toString("base64url");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const actual = scryptSync(password, salt, 32);
  const expected = Buffer.from(hash, "base64url");
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

// Checked against unknown emails so a wrong address takes as long as a wrong password.
const DUMMY_HASH = hashPassword(randomBytes(16).toString("base64url"));

export function passwordProblem(password: string): string | null {
  if (password.length < 10) return "Use at least 10 characters.";
  if (password.length > 200) return "That password is too long.";
  return null;
}

export function normalizeEmail(value: string): string | null {
  const email = value.trim().toLowerCase();
  if (email.length < 3 || email.length > 200) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

/** Only same-site paths, so the login page cannot bounce someone to another host. */
export function safeNext(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
  if (value.startsWith("/login")) return "/";
  return value;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
}

export function listAccounts(db: Database.Database): (Account & { createdAt: string })[] {
  const rows = db
    .prepare("SELECT id, email, name, created_at FROM users ORDER BY email")
    .all() as AccountRow[];
  return rows.map((row) => ({ id: row.id, email: row.email, name: row.name, createdAt: row.created_at }));
}

export function accountCount(db: Database.Database): number {
  return (db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number }).n;
}

export function findAccount(db: Database.Database, email: string): Account | null {
  const row = db.prepare("SELECT id, email, name FROM users WHERE email = ?").get(email) as
    | Account
    | undefined;
  return row ?? null;
}

export function addAccount(db: Database.Database, email: string, name: string, password: string): Account {
  const account = { id: randomUUID(), email, name: name.trim().slice(0, 80) };
  db.prepare(
    "INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)",
  ).run(account.id, account.email, account.name, hashPassword(password), new Date().toISOString());
  return account;
}

/** Also signs that account out everywhere. */
export function setAccountPassword(db: Database.Database, id: string, password: string): void {
  db.transaction(() => {
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(password), id);
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(id);
  })();
}

export function removeAccount(db: Database.Database, id: string): void {
  db.prepare("DELETE FROM users WHERE id = ?").run(id);
}

export function clearFailures(db: Database.Database, email: string): void {
  db.prepare("DELETE FROM login_failures WHERE email = ?").run(email);
}

export function sessionAccount(db: Database.Database, token: string, now = Date.now()): Account | null {
  const row = db
    .prepare(
      `SELECT users.id, users.email, users.name FROM sessions
       JOIN users ON users.id = sessions.user_id
       WHERE sessions.token_hash = ? AND sessions.expires_at > ?`,
    )
    .get(hashToken(token), now) as Account | undefined;
  return row ?? null;
}

export function endSession(db: Database.Database, token: string): void {
  db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token));
}

export type SignIn =
  | { ok: true; account: Account; token: string; expiresAt: number }
  | { ok: false; reason: "locked" | "wrong" };

export function signIn(db: Database.Database, typedEmail: string, password: string, now = Date.now()): SignIn {
  const email = normalizeEmail(typedEmail) ?? typedEmail.trim().toLowerCase().slice(0, 200);
  db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(now);
  db.prepare("DELETE FROM login_failures WHERE at <= ?").run(now - LOCK_MS);
  const failures = (
    db.prepare("SELECT COUNT(*) AS n FROM login_failures WHERE email = ?").get(email) as { n: number }
  ).n;
  if (failures >= MAX_FAILURES) return { ok: false, reason: "locked" };

  const row = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as AccountRow | undefined;
  const matches = verifyPassword(password, row?.password_hash ?? DUMMY_HASH) && Boolean(row);
  if (!row || !matches) {
    db.prepare("INSERT INTO login_failures (email, at) VALUES (?, ?)").run(email, now);
    return { ok: false, reason: "wrong" };
  }

  clearFailures(db, email);
  const token = randomBytes(32).toString("base64url");
  const expiresAt = now + SESSION_MS;
  db.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)").run(
    hashToken(token),
    row.id,
    expiresAt,
  );
  return { ok: true, account: { id: row.id, email: row.email, name: row.name }, token, expiresAt };
}
