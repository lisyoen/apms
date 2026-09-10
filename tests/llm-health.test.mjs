import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import {
  checkLlmConnection,
  getDefaultLlmStatus,
} from "../src/lib/llm/health.ts";

let server, base;
before(async () => {
  server = http.createServer((req, res) => {
    if (req.url?.startsWith("/unreachable")) {
      req.socket.destroy();
      return;
    }
    if (req.url?.startsWith("/auth")) {
      res.writeHead(401);
      res.end("unauthorized");
      return;
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        data: [
          {
            id: req.url?.startsWith("/missing")
              ? "another-model"
              : "wanted-model",
          },
        ],
      }),
    );
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  if (server)
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
});

for (const [path, reason] of [
  ["ok", "ok"],
  ["unreachable", "unreachable"],
  ["auth", "auth"],
  ["missing", "model_missing"],
]) {
  test(`health check classifies ${reason}`, async () => {
    const result = await checkLlmConnection(
      {
        provider: "compatible",
        base_url: `${base}/${path}`,
        model: "wanted-model",
        apiKey: "test-key",
      },
      { timeoutMs: 1000 },
    );
    assert.equal(result.reason, reason);
    assert.equal(result.ok, reason === "ok");
    assert.match(result.url, /\/v1\/models$/);
  });
}

test("default status classifies no_default", async () => {
  const db = { query: async () => ({ rows: [] }) };
  const result = await getDefaultLlmStatus(db);
  assert.equal(result.reason, "no_default");
  assert.equal(result.connection_id, null);
});
