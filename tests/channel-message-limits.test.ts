import assert from "node:assert/strict";
import test from "node:test";
import { countMemberMessages, isMessageWithinLimit } from "../packages/core/src/channel-message-limits";

test("channel message history counts only the selected human member", () => {
  const messages = [
    { author: { id: "member", bot: false } },
    { author: { id: "other", bot: false } },
    { author: { id: "member", bot: true } },
    { author: { id: "member", bot: false } },
  ];
  assert.equal(countMemberMessages(messages, "member", 10), 2);
});

test("channel history scanning stops once the configured maximum is known", () => {
  const messages = Array.from({ length: 20 }, () => ({ author: { id: "member", bot: false } }));
  assert.equal(countMemberMessages(messages, "member", 3), 3);
  assert.equal(countMemberMessages(messages, "member", 5, 4), 5);
});

test("the final allowed message stays and only overflow is rejected", () => {
  assert.equal(isMessageWithinLimit(3, 3), true);
  assert.equal(isMessageWithinLimit(4, 3), false);
});
