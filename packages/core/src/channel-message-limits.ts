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
