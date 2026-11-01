import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import {
  accountCount,
  addAccount,
  clearFailures,
  findAccount,
  listAccounts,
  normalizeEmail,
  passwordProblem,
  removeAccount,
  setAccountPassword,
} from "../lib/accounts";
import { databasePath, openDatabase } from "../lib/db";

const USAGE = `Manage PartSync accounts:
  npm run user -- add --email you@example.com [--name "Your name"]
  npm run user -- passwd --email you@example.com
  npm run user -- remove --email you@example.com
  npm run user -- list`;

let piped: string[] | null = null;

async function readLine(prompt: string): Promise<string> {
  const stdin = process.stdin;
  if (!stdin.isTTY) {
    if (!piped) piped = fs.readFileSync(0, "utf8").split(/\r?\n/);
    return piped.shift() ?? "";
  }
  process.stdout.write(prompt);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");
  return new Promise((resolve) => {
    let typed = "";
    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === "\u0003") {
          process.stdout.write("\n");
          process.exit(130);
        }
        if (char === "\r" || char === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          process.stdout.write("\n");
          resolve(typed);
          return;
        }
        if (char === "\u007f" || char === "\b") typed = typed.slice(0, -1);
        else typed += char;
      }
    };
    stdin.on("data", onData);
  });
}

async function askPassword(): Promise<string> {
  for (let tries = 0; tries < 5; tries += 1) {
    const first = await readLine("New password: ");
    const problem = passwordProblem(first);
    if (problem) {
      console.error(problem);
      continue;
    }
    if ((await readLine("Type it again: ")) !== first) {
      console.error("Those did not match.");
      continue;
    }
    return first;
  }
  console.error("No password set.");
  process.exit(1);
}

function openDb() {
  const file = databasePath();
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  if (process.getuid?.() === 0 && fs.statSync(dir).uid !== 0) {
    // Root-owned SQLite journal files would stop the service from writing.
    console.error(`Run this as the user that owns ${dir}, not with sudo.`);
    process.exit(1);
  }
  return openDatabase(file);
}

async function main(): Promise<number> {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { email: { type: "string" }, name: { type: "string", default: "" } },
  });
  const command = positionals[0];
  if (!["add", "passwd", "remove", "list"].includes(command ?? "")) {
    console.error(USAGE);
    return 2;
  }

  const db = openDb();
  try {
    if (command === "list") {
      const rows = listAccounts(db);
      if (rows.length === 0) console.log("No accounts yet.");
      for (const row of rows) console.log(`${row.email}\t${row.name}\t${row.createdAt}`);
      return 0;
    }

    const email = normalizeEmail(values.email ?? "");
    if (!email) {
      console.error("Give a valid --email.");
      return 2;
    }
    const account = findAccount(db, email);

    if (command === "add") {
      if (account) {
        console.error(`${email} already has an account. Use passwd to change its password.`);
        return 1;
      }
      addAccount(db, email, values.name ?? "", await askPassword());
      console.log(`Added ${email}.`);
      return 0;
    }

    if (!account) {
      console.error(`There is no account for ${email}.`);
      return 1;
    }
    if (command === "passwd") {
      setAccountPassword(db, account.id, await askPassword());
      clearFailures(db, email);
      console.log(`Changed the password for ${email}. Its open sessions are signed out.`);
      return 0;
    }
    removeAccount(db, account.id);
    console.log(`Removed ${email}.`);
    if (accountCount(db) === 0) console.log("No accounts are left. Nobody can sign in until you add one.");
    return 0;
  } finally {
    db.close();
  }
}

main().then((code) => {
  process.exitCode = code;
});
