import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import {
  LOCK_MS,
  MAX_FAILURES,
  SESSION_COOKIE,
  SESSION_MS,
  addAccount,
  endSession,
  findAccount,
  hashPassword,
  safeNext,
  sessionAccount,
  setAccountPassword,
  signIn,
  verifyPassword,
} from "../lib/accounts";
import { openDatabase } from "../lib/db";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "partsync-auth-"));
after(() => fs.rmSync(dir, { recursive: true, force: true }));

let count = 0;
function freshDb() {
  count += 1;
  const db = openDatabase(path.join(dir, `auth-${count}.db`));
  addAccount(db, "sam@workshop.test", "Sam", "correct horse battery");
  return db;
}

describe("accounts", () => {
  it("hashes passwords with a fresh salt", () => {
    const stored = hashPassword("a long enough password");
    assert.match(stored, /^scrypt\$/);
    assert.ok(verifyPassword("a long enough password", stored));
    assert.ok(!verifyPassword("a long enough passwore", stored));
    assert.ok(!verifyPassword("anything", "not-a-hash"));
    assert.notEqual(hashPassword("same"), hashPassword("same"));
  });

  it("signs in, and the session token finds the account until it expires", () => {
    const db = freshDb();
    const now = 1_000_000;
    const outcome = signIn(db, " Sam@Workshop.test ", "correct horse battery", now);
    assert.ok(outcome.ok);
    assert.equal(outcome.expiresAt, now + SESSION_MS);
    assert.equal(sessionAccount(db, outcome.token, now + 1)?.email, "sam@workshop.test");
    assert.equal(sessionAccount(db, outcome.token, now + SESSION_MS), null);
    assert.equal(sessionAccount(db, "made-up-token", now), null);
  });

  it("gives the same answer for a wrong password and an unknown email", () => {
    const db = freshDb();
    assert.deepEqual(signIn(db, "sam@workshop.test", "nope nope nope"), { ok: false, reason: "wrong" });
    assert.deepEqual(signIn(db, "nobody@workshop.test", "nope nope nope"), { ok: false, reason: "wrong" });
  });

  it("locks an email after eight wrong passwords, for fifteen minutes", () => {
    const db = freshDb();
    const now = 5_000_000;
    for (let i = 0; i < MAX_FAILURES; i += 1) {
      assert.equal(signIn(db, "sam@workshop.test", "wrong password", now).ok, false);
    }
    assert.deepEqual(signIn(db, "sam@workshop.test", "correct horse battery", now), {
      ok: false,
      reason: "locked",
    });
    assert.ok(signIn(db, "sam@workshop.test", "correct horse battery", now + LOCK_MS + 1).ok);
  });

  it("ends a session on sign-out and every session on a password change", () => {
    const db = freshDb();
    const first = signIn(db, "sam@workshop.test", "correct horse battery");
    const second = signIn(db, "sam@workshop.test", "correct horse battery");
    assert.ok(first.ok && second.ok);
    endSession(db, first.token);
    assert.equal(sessionAccount(db, first.token), null);
    assert.ok(sessionAccount(db, second.token));
    setAccountPassword(db, findAccount(db, "sam@workshop.test")!.id, "a brand new password");
    assert.equal(sessionAccount(db, second.token), null);
    assert.ok(signIn(db, "sam@workshop.test", "a brand new password").ok);
  });

  it("only sends people back to pages on this site", () => {
    assert.equal(safeNext("/ledger?day=2"), "/ledger?day=2");
    for (const target of ["//evil.example/", "https://evil.example/", "/\\evil.example", "/login", "", null]) {
      assert.equal(safeNext(target), "/");
    }
  });
});

describe("the gate", () => {
  it("checks the session at the top of every server action", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "app/actions.ts"), "utf8").replace(/\r\n/g, "\n");
    const actions = source.split("export async function ").slice(1);
    assert.ok(actions.length >= 10);
    for (const action of actions) {
      const name = action.slice(0, action.indexOf("("));
      const body = action.slice(action.indexOf("{\n") + 2).trimStart();
      assert.ok(body.startsWith("await requireAccount();"), `${name} does not check the session first`);
    }
  });

  it("sends people without a session to the login page", async () => {
    process.env.DATABASE_PATH = path.join(dir, "proxy.db");
    const { NextRequest } = await import("next/server");
    const { proxy } = await import("../proxy");
    const { getDb } = await import("../lib/db");
    addAccount(getDb(), "sam@workshop.test", "Sam", "correct horse battery");

    const page = proxy(new NextRequest("http://pi.local:4747/ledger?day=2"));
    assert.equal(page.status, 303);
    assert.equal(page.headers.get("location"), "http://pi.local:4747/login?next=%2Fledger%3Fday%3D2");

    const action = proxy(new NextRequest("http://pi.local:4747/settings", { method: "POST" }));
    assert.equal(action.status, 303);
    assert.equal(action.headers.get("location"), "http://pi.local:4747/login");

    const call = new NextRequest("http://pi.local:4747/settings", {
      method: "POST",
      headers: { "next-action": "abc" },
    });
    assert.equal(proxy(call).headers.get("location"), null, "server actions do their own check");

    const forged = new NextRequest("http://pi.local:4747/", { headers: { cookie: `${SESSION_COOKIE}=forged` } });
    assert.equal(proxy(forged).status, 303);

    assert.equal(proxy(new NextRequest("http://pi.local:4747/login")).headers.get("location"), null);

    const outcome = signIn(getDb(), "sam@workshop.test", "correct horse battery");
    assert.ok(outcome.ok);
    const signed = new NextRequest("http://pi.local:4747/ledger", {
      headers: { cookie: `${SESSION_COOKIE}=${outcome.token}` },
    });
    assert.equal(proxy(signed).headers.get("location"), null);
  });
});

describe("console accounts", () => {
  const env = { ...process.env, DATABASE_PATH: path.join(dir, "console.db") };
  const run = (args: string[], input = "") => {
    try {
      return {
        code: 0,
        out: execFileSync(process.execPath, ["--import", "tsx", "scripts/user.ts", ...args], {
          env,
          input,
          encoding: "utf8",
          stdio: ["pipe", "pipe", "pipe"],
        }),
      };
    } catch (error) {
      const failed = error as { status: number; stderr: string };
      return { code: failed.status, out: failed.stderr };
    }
  };

  it("adds, lists, changes, and removes an account", () => {
    assert.match(run(["add", "--email", "Ali@Workshop.test", "--name", "Ali"], "short\nfirst password\nfirst password\n").out, /Added ali@workshop.test/);
    assert.equal(run(["add", "--email", "ali@workshop.test"], "x\n").code, 1);
    assert.match(run(["list"]).out, /ali@workshop.test\tAli/);
    assert.match(run(["passwd", "--email", "ali@workshop.test"], "second password\nsecond password\n").out, /Changed/);
    const db = openDatabase(env.DATABASE_PATH);
    assert.ok(signIn(db, "ali@workshop.test", "second password").ok);
    db.close();
    assert.match(run(["remove", "--email", "ali@workshop.test"]).out, /No accounts are left/);
    assert.equal(run(["remove", "--email", "ali@workshop.test"]).code, 1);
    assert.equal(run(["add", "--email", "not-an-email"]).code, 2);
  });
});
