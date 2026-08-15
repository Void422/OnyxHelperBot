import type { Metadata } from "next";
import { CommunityConfigPage } from "@/components/community-config-page";

export const metadata: Metadata = { title: "Community" };
export default async function CommunityPage({ params }: { params: Promise<{ guildId: string }> }) { const { guildId } = await params; return <CommunityConfigPage guildId={guildId} />; }
