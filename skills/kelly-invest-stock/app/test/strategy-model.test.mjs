import assert from "node:assert/strict";
import test from "node:test";

import { createRegressionSnapshot, createStrategyDesk } from "../app/js/strategy-model.js";

const record = (id, baseKey, fields) => ({ id, baseKey, fields });

test("groups strategies into L1, L2, and L3 and sorts each stage by confidence", () => {
  const desk = createStrategyDesk([
    record("low", "strategies", { key: "low", name: "低分", status: "L1", confidence: 45 }),
    record("high", "strategies", { key: "high", name: "高分", status: "L1", confidence: 76 }),
    record("advanced", "strategies", { key: "advanced", name: "进阶", status: "L2", confidence: 62 }),
    record("confidence", "strategies", { key: "confidence", name: "高置信", status: "L3", confidence: 80 }),
  ]);

  assert.deepEqual(
    desk.levels.L1.map((strategy) => strategy.key),
    ["high", "low"],
  );
  assert.equal(desk.levels.L2.length, 1);
  assert.equal(desk.levels.L3.length, 1);
  assert.equal(desk.attention.l1, 2);
});

test("summarizes virtual accounts without treating them as real holdings", () => {
  const desk = createStrategyDesk([
    record("strategy-a", "strategies", { key: "a", name: "A" }),
    record("strategy-b", "strategies", { key: "b", name: "B" }),
    record("account-a", "ledger-accounts", {
      strategy_key: "a",
      nominal_capital: 100000,
      nav: 108000,
      cash: 20000,
      benchmark_return: 0.03,
    }),
    record("account-b", "ledger-accounts", {
      strategy_key: "b",
      nominal_capital: 50000,
      nav: 48000,
      cash: 10000,
    }),
    record("position-a", "ledger-positions", {
      strategy_key: "a",
      code: "AAA",
      quantity: 10,
      entry_price: 80,
      latest_price: 100,
    }),
  ]);

  assert.equal(desk.ledger.nominalCapital, 150000);
  assert.equal(desk.ledger.nav, 156000);
  assert.equal(desk.ledger.pnl, 6000);
  assert.ok(Math.abs(desk.ledger.returnRate - 0.04) < Number.EPSILON);
  assert.ok(Math.abs(desk.ledger.benchmarkReturn - 0.02) < Number.EPSILON);
  assert.ok(Math.abs(desk.ledger.excessReturn - 0.02) < Number.EPSILON);
  assert.equal(desk.ledger.cash, 30000);
  assert.equal(desk.strategies[0].stage, "L1");
  assert.equal(desk.strategies[0].key, "a");
  assert.equal(desk.strategies[0].positions[0].pnl, 200);
});

test("surfaces missing, duplicate, and orphan virtual-ledger records", () => {
  const desk = createStrategyDesk([
    record("strategy-a", "strategies", { key: "a", name: "A" }),
    record("strategy-b", "strategies", { key: "b", name: "B" }),
    record("account-a-1", "ledger-accounts", {
      strategy_key: "a",
      nominal_capital: 100000,
      nav: 105000,
      cash: 25000,
    }),
    record("account-a-2", "ledger-accounts", {
      strategy_key: "a",
      nominal_capital: 100000,
      nav: 99000,
      cash: 50000,
    }),
    record("account-orphan", "ledger-accounts", {
      strategy_key: "missing",
      nominal_capital: 100000,
      nav: 250000,
    }),
    record("position-orphan", "ledger-positions", { strategy_key: "missing", code: "NOPE", quantity: 1 }),
  ]);

  assert.deepEqual(desk.integrity.missingAccountStrategyKeys, ["b"]);
  assert.deepEqual(desk.integrity.duplicateAccountStrategyKeys, ["a"]);
  assert.deepEqual(desk.integrity.orphanAccountIds, ["account-orphan"]);
  assert.deepEqual(desk.integrity.orphanPositionIds, ["position-orphan"]);
  assert.equal(desk.integrity.issueCount, 4);
  assert.equal(desk.integrity.isComplete, false);
  assert.equal(desk.strategies.find((strategy) => strategy.key === "a").accountCount, 2);
  assert.equal(desk.strategies.find((strategy) => strategy.key === "b").account, null);
  assert.equal(desk.ledger.nominalCapital, 100000);
  assert.equal(desk.ledger.nav, 105000);
});

test("marks one virtual account per strategy as complete", () => {
  const desk = createStrategyDesk([
    record("strategy-a", "strategies", { key: "a", name: "A" }),
    record("account-a", "ledger-accounts", { strategy_key: "a", nominal_capital: 100, nav: 101 }),
  ]);

  assert.equal(desk.integrity.isComplete, true);
  assert.equal(desk.integrity.issueCount, 0);
  assert.equal(desk.strategies[0].accountCount, 1);
});

test("calculates one strategy contribution and the total-book return without it", () => {
  const desk = createStrategyDesk([
    record("strategy-a", "strategies", { key: "a", name: "A" }),
    record("strategy-b", "strategies", { key: "b", name: "B" }),
    record("account-a", "ledger-accounts", { strategy_key: "a", nominal_capital: 100, nav: 120 }),
    record("account-b", "ledger-accounts", { strategy_key: "b", nominal_capital: 300, nav: 270 }),
  ]);
  const strategy = desk.strategies.find((item) => item.key === "a");
  const snapshot = createRegressionSnapshot(desk, strategy);

  assert.ok(Math.abs(snapshot.totalReturn + 0.025) < Number.EPSILON);
  assert.ok(Math.abs(snapshot.strategyReturn - 0.2) < Number.EPSILON);
  assert.ok(Math.abs(snapshot.contribution - 0.05) < Number.EPSILON);
  assert.ok(Math.abs(snapshot.capitalWeight - 0.25) < Number.EPSILON);
  assert.ok(Math.abs(snapshot.returnWithoutStrategy + 0.1) < Number.EPSILON);
});
