export interface CountableMessage {
  author: { id: string; bot: boolean };
}

export function countMemberMessages(messages: Iterable<CountableMessage>, userId: string, maximum: number, startingCount = 0) {
  let count = startingCount;
  for (const message of messages) {
    if (!message.author.bot && message.author.id === userId) count += 1;
    if (count >= maximum) return maximum;
  }
  return count;
}

export function isMessageWithinLimit(messageCount: number, maximum: number) {
  return messageCount <= maximum;
}

export function channelMessageLimitNotice(userId: string, maximum: number) {
  const amount = maximum.toLocaleString("en-US");
  return `<@${userId}>, only **${amount} message${maximum === 1 ? "" : "s"}** ${maximum === 1 ? "is" : "are"} allowed in this channel.`;
}
