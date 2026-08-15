import { CommandCenter } from "@/components/command-center";

export default async function CommandsRoute({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  return <CommandCenter guildId={guildId} />;
}
