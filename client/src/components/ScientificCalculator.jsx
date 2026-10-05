import { useMemo, useState } from "react";
import { calculate } from "../lib/calculator";

const buttons = [
  ["sin", "cos", "tan", "log", "ln"],
  ["(", ")", "√", "x²", "^"],
  ["7", "8", "9", "÷", "DEL"],
  ["4", "5", "6", "×", "AC"],
  ["1", "2", "3", "−", "π"],
  ["0", ".", "e", "+", "="],
];

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
