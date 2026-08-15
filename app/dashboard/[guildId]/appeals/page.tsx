import type { Metadata } from "next";
import { AppealsDashboard } from "@/components/appeals-dashboard";
export const metadata: Metadata = { title: "Appeals" };
export default async function Page({ params }: { params: Promise<{ guildId: string }> }) { const { guildId } = await params; return <AppealsDashboard guildId={guildId} />; }
