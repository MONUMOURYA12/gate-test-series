import assert from "node:assert/strict";
import { test } from "node:test";
import { calculate } from "../src/lib/calculator.js";

test("calculator supports arithmetic, precedence, constants, and degrees without code evaluation", () => {
  for (const [expression, expected] of [
    ["2+3×4", "14"], ["(2+3)×4", "20"], ["12÷3−5", "-1"],
    ["2^3^2", "512"], ["-2^2", "-4"], ["2^-2", "0.25"], ["3x²", "9"],
    ["sin(30)+cos(60)", "1"], ["tan(45)", "1"], ["sqrt(81)", "9"],
    ["log(1000)", "3"], ["ln(e)", "1"], ["π-π", "0"], [".5+0.25", "0.75"],
  ]) assert.equal(calculate(expression), expected, expression);
});

test("calculator rejects executable input, unknown functions, malformed arithmetic, and non-finite results", () => {
  for (const expression of [
    "window.alert(1)", "globalThis", "fetch(1)", "constructor(1)", "sin.constructor(1)",
    "1;2", "1[0]", "Math.PI", "1,2", "(2+3", "2 3", "1..2", "2**3", "",
    "sqrt(-1)", "log(0)", "1/0", "sin()", "2+", "2+3)",
  ]) assert.throws(() => calculate(expression), undefined, expression);
});

test("calculator bounds input size and nesting", () => {
  assert.throws(() => calculate("1".repeat(513)));
  assert.throws(() => calculate(`${"(".repeat(65)}1${")".repeat(65)}`));
  assert.throws(() => calculate("1+".repeat(128) + "1"));
});
