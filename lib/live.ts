import { connection } from "next/server";
import { getDb } from "@/lib/db";

export async function liveDb() {
  await connection();
  return getDb();
}
