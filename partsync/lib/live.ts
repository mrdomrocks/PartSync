import { connection } from "next/server";
import { requireAccount } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function liveDb() {
  await connection();
  await requireAccount();
  return getDb();
}
