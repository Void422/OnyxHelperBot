import type { Metadata } from "next";
import { AuditPage } from "@/components/audit-page";
export const metadata: Metadata = { title: "Audit log" };
export default async function Page({ params }: { params: Promise<{ guildId: string }> }) { const { guildId } = await params; return <AuditPage guildId={guildId} />; }
