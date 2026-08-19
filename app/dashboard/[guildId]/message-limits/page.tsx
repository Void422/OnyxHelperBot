import { MessageLimitsPage } from "@/components/message-limits-page";

export default async function MessageLimitsRoute({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  return <MessageLimitsPage guildId={guildId} />;
}
