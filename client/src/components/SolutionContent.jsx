function normalizeText(value) {
  return String(value || "")
    .replace(/\*+olution\*+/gi, "**Solution**")
    .replace(/\*+Correct Answer:\*+/gi, "\n**Correct Answer:**")
    .replace(/\\omega\s*[_{]?0\}?/gi, "ω₀")
    .replace(/\\omega/gi, "ω")
    .replace(/\\infty/gi, "∞")
    .replace(/\\to|\\rightarrow/gi, "→")
    .replace(/\\pi/gi, "π")
    .replace(/\$([^$]+)\$/g, "$1")
    .replace(/\b([Rr])[_{]?([1234])\}?/g, (_, letter, number) => `${letter}${"₀₁₂₃₄"[Number(number)]}`);
}

function inlineParts(text) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => part.startsWith("**") && part.endsWith("**")
    ? <strong key={index}>{part.slice(2, -2)}</strong>
    : part);
}

export default function SolutionContent({ text }) {
  const lines = normalizeText(text).replace(/\r/g, "").split("\n");
  const content = [];
  let bullets = [];

  function flushBullets() {
    if (!bullets.length) return;
    content.push(<ul className="solution-list" key={`list-${content.length}`}>{bullets.map((item, index) => <li key={index}>{inlineParts(item)}</li>)}</ul>);
    bullets = [];
  }

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushBullets();
      return;
    }
    const bullet = trimmed.match(/^(?:[-*]|\d+[.)])\s+(.*)$/);
    if (bullet) {
      bullets.push(bullet[1]);
      return;
    }
    flushBullets();
    const heading = trimmed.replace(/^#{1,4}\s*/, "").replace(/:$/, "");
    const isHeading = /^\*\*[^*]+\*\*:?$/.test(trimmed) || /^(Solution|Answer|Correct answer|Concept|Reasoning|Working|Explanation|Conclusion|Final answer|At low frequencies|At high frequencies|At intermediate frequencies)/i.test(heading);
    content.push(isHeading
      ? <h4 key={`heading-${index}`}>{inlineParts(heading)}</h4>
      : <p key={`paragraph-${index}`}>{inlineParts(trimmed)}</p>);
  });
  flushBullets();

  return <div className="solution-content">{content}</div>;
}
