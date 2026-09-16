const functions = new Map([
  ["sqrt", Math.sqrt],
  ["sin", input => Math.sin(input * Math.PI / 180)],
  ["cos", input => Math.cos(input * Math.PI / 180)],
  ["tan", input => Math.tan(input * Math.PI / 180)],
  ["log", Math.log10],
  ["ln", Math.log],
]);

// Parse only calculator operations. Do not evaluate JavaScript: production
// Content-Security-Policy deliberately disables eval and Function constructors.
export function calculate(expression) {
  if (typeof expression !== "string" || expression.length > 512) throw new Error("Invalid expression");
  const source = expression
    .replaceAll("×", "*")
    .replaceAll("÷", "/")
    .replaceAll("−", "-")
    .replaceAll("x²", "^2");
  const tokens = [];
  const pattern = /\s*(\d+(?:\.\d*)?|\.\d+|[a-z]+|[π+\-*/^()])/y;
  let position = 0;
  while (position < source.length) {
    if (!source.slice(position).trim()) break;
    pattern.lastIndex = position;
    const match = pattern.exec(source);
    if (!match || tokens.length >= 256) throw new Error("Invalid expression");
    tokens.push(match[1]);
    position = pattern.lastIndex;
  }

  let cursor = 0;
  let depth = 0;
  const consume = token => tokens[cursor] === token && Boolean(++cursor);

  function parseExpression() {
    let value = parseProduct();
    while (tokens[cursor] === "+" || tokens[cursor] === "-") {
      const operator = tokens[cursor++];
      const right = parseProduct();
      value = operator === "+" ? value + right : value - right;
    }
    return value;
  }

  function parseProduct() {
    let value = parseUnary();
    while (tokens[cursor] === "*" || tokens[cursor] === "/") {
      const operator = tokens[cursor++];
      const right = parseUnary();
      value = operator === "*" ? value * right : value / right;
    }
    return value;
  }

  function parseUnary() {
    if (++depth > 64) throw new Error("Expression is too complex");
    try {
      if (consume("+")) return parseUnary();
      if (consume("-")) return -parseUnary();
      const value = parsePrimary();
      return consume("^") ? value ** parseUnary() : value;
    } finally {
      depth -= 1;
    }
  }

  function parsePrimary() {
    const token = tokens[cursor++];
    if (token === "(") {
      const value = parseExpression();
      if (!consume(")")) throw new Error("Missing closing parenthesis");
      return value;
    }
    if (token === "π") return Math.PI;
    if (token === "e") return Math.E;
    if (functions.has(token)) {
      if (!consume("(")) throw new Error("Missing opening parenthesis");
      const value = parseExpression();
      if (!consume(")")) throw new Error("Missing closing parenthesis");
      return functions.get(token)(value);
    }
    if (token && /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(token)) return Number(token);
    throw new Error("Invalid expression");
  }

  const value = parseExpression();
  if (cursor !== tokens.length || !Number.isFinite(value)) throw new Error("Invalid result");
  return String(Number(value.toFixed(10)));
}
