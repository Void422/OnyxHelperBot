import type { Metadata } from "next";
import { OverviewPage } from "@/components/overview-page";

export const metadata: Metadata = { title: "Overview" };
export default async function GuildOverview({ params }: { params: Promise<{ guildId: string }> }) { const { guildId } = await params; return <OverviewPage guildId={guildId} />; }
