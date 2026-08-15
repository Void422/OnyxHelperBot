import assert from "node:assert/strict";
import test from "node:test";
import { renderTemplate, unknownTemplatePlaceholders } from "../packages/core/src/template";

test("message templates replace only supported placeholders", () => {
  assert.equal(
    renderTemplate("Welcome {mention} to {server}. Ticket {ticket}. {unknown}", {
      mention: "<@123>",
      server: "Onyx",
      ticket: 42,
    }),
    "Welcome <@123> to Onyx. Ticket 42. {unknown}",
  );
});

test("message templates report unsupported placeholders once", () => {
  assert.deepEqual(unknownTemplatePlaceholders("{server} {oops} {oops} {bad}"), ["oops", "bad"]);
});
