import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html", host: "localhost" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) }, DB: { prepare() { throw new Error("Landing page must not query the database"); } } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the finished Onyx landing page", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /Onyx/);
  assert.match(html, /Your server, under control\./);
  assert.match(html, /Discord management, considered/);
  assert.match(html, /Appeal a decision/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("ships product metadata and a bespoke social card", async () => {
  const response = await render();
  const html = await response.text();
  assert.match(html, /Onyx — Discord management, without the clutter/);
  assert.match(html, /http:\/\/localhost\/og\.png/);
  assert.match(html, /summary_large_image/);
});
