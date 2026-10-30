import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const source = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "partsync.db");

if (!fs.existsSync(source)) {
  console.error(`No database at ${source}. Open PartSync once before backing up.`);
  process.exit(1);
}

const stamp = new Date().toISOString().slice(0, 10);
const dest = process.argv[2] ?? path.join(process.cwd(), "data", `partsync-${stamp}.db`);
fs.mkdirSync(path.dirname(path.resolve(dest)), { recursive: true });

const db = new Database(source);
await db.backup(dest);
db.close();
console.log(`Backed up to ${dest}`);
