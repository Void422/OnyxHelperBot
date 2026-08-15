import { env } from "cloudflare:workers";
import { apiFailure, json } from "@/lib/server/http";

export async function GET() {
  try {
    await env.DB.prepare("SELECT 1 AS ok").first();
    return json({ status: "ok", database: "available", timestamp: new Date().toISOString() });
  } catch (error) {
    return apiFailure(error);
  }
}
