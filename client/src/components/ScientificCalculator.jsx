import { useMemo, useState } from "react";

const buttons = [
  ["sin", "cos", "tan", "log", "ln"],
  ["(", ")", "√", "x²", "^"],
  ["7", "8", "9", "÷", "DEL"],
  ["4", "5", "6", "×", "AC"],
  ["1", "2", "3", "−", "π"],
  ["0", ".", "e", "+", "="],
];

function calculate(expression) {
  const normalized = expression
    .replaceAll("×", "*")
    .replaceAll("÷", "/")
    .replaceAll("−", "-")
    .replaceAll("π", "Math.PI")
    .replaceAll("√", "sqrt(")
    .replaceAll("x²", "**2")
    .replaceAll("^", "**")
    .replaceAll("e", "Math.E");

  if (!/^[0-9+*/().\sA-Za-z_*]+$/.test(normalized) || /(?:constructor|prototype|__)/i.test(normalized)) {
    throw new Error("Invalid expression");
  }

  const value = Function("sqrt", "sin", "cos", "tan", "log", "ln", `"use strict"; return (${normalized})`)(
    Math.sqrt,
    (input) => Math.sin((input * Math.PI) / 180),
    (input) => Math.cos((input * Math.PI) / 180),
    (input) => Math.tan((input * Math.PI) / 180),
    Math.log10,
    Math.log,
  );

  if (!Number.isFinite(value)) throw new Error("Invalid result");
  return String(Number(value.toFixed(10)));
}

export default function ScientificCalculator() {
  const [expression, setExpression] = useState("");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const display = useMemo(() => result || expression || "0", [expression, result]);

  function press(label) {
    setError("");
    if (label === "AC") {
      setExpression("");
      setResult("");
      return;
    }
    if (label === "DEL") {
      setResult("");
      setExpression((value) => value.slice(0, -1));
      return;
    }
    if (label === "=") {
      try {
        setResult(calculate(expression));
        setExpression("");
      } catch {
        setResult("");
        setError("Check the expression");
      }
      return;
    }
    const token = label === "√"
      ? "sqrt("
      : ["sin", "cos", "tan", "log", "ln"].includes(label)
        ? `${label}(`
        : label;
    setResult("");
    setExpression((value) => `${value}${token}`);
  }

  return (
    <section className="calculator-panel" aria-label="Scientific calculator">
      <div className="calculator-display" aria-live="polite">
        <span>{error || "DEG mode"}</span>
        <strong>{display}</strong>
      </div>
      <div className="calculator-grid">
        {buttons.flat().map((label) => (
          <button className={label === "=" ? "calculator-key equals" : label === "AC" ? "calculator-key clear" : "calculator-key"} key={label} type="button" onClick={() => press(label)}>
            {label}
          </button>
        ))}
      </div>
      <p className="calculator-note">Angles use degrees, like the GATE on-screen calculator.</p>
    </section>
  );
}
