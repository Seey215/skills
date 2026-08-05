import assert from "node:assert/strict";
import test from "node:test";

import { readAllPages } from "../app/js/providers/busabase-provider.js";

const base = { key: "strategies", baseId: "strategies-base", readLimit: 20 };

test("loads every Busabase record page for strategy-scale ledgers", async () => {
  const cursors = [];
  const client = {
    records: {
      async list({ cursor }) {
        cursors.push(cursor || null);
        if (!cursor) {
          return { records: [{ id: "strategy-1", fields: { key: "one" } }], nextCursor: "page-2" };
        }
        return { records: [{ id: "strategy-2", fields: { key: "two" } }], nextCursor: null };
      },
    },
  };

  const page = await readAllPages(client, base);

  assert.deepEqual(cursors, [null, "page-2"]);
  assert.deepEqual(
    page.records.map((record) => record.id),
    ["strategy-1", "strategy-2"],
  );
  assert.equal(page.pageCount, 2);
  assert.equal(page.nextCursor, null);
});

test("stops when Busabase repeats a pagination cursor", async () => {
  const client = {
    records: {
      async list() {
        return { records: [], nextCursor: "same-cursor" };
      },
    },
  };

  await assert.rejects(readAllPages(client, base), /PAGINATION_LOOP: strategies/);
});
