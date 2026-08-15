import assert from "node:assert/strict";
import test from "node:test";
import { chunksOf } from "../lib/server/batch";

test("chunksOf splits large Discord guild lists into database-safe batches", () => {
  const guildIds = Array.from({ length: 92 }, (_, index) => String(index));
  const batches = chunksOf(guildIds, 10);

  assert.equal(batches.length, 10);
  assert.deepEqual(
    batches.map((batch) => batch.length),
    [10, 10, 10, 10, 10, 10, 10, 10, 10, 2],
  );
  assert.deepEqual(batches.flat(), guildIds);
});

test("chunksOf handles empty input and rejects invalid sizes", () => {
  assert.deepEqual(chunksOf([], 10), []);
  assert.throws(() => chunksOf(["guild"], 0), RangeError);
});
