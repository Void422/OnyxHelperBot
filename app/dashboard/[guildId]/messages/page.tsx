import { MessageStudio } from "@/components/message-studio";

export default async function MessagesRoute({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  return <MessageStudio guildId={guildId} />;
}
