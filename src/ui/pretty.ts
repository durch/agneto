import chalk from "chalk";
import wrapAnsi from "wrap-ansi";
import boxen from "boxen";
import { highlight } from "cli-highlight";
import stripAnsi from "strip-ansi";

type PrettyOpts = {
  width?: number;          // default: process.stdout.columns || 80
  indent?: number;         // spaces for paragraph indent
  maxParagraphGap?: number;// max blank lines to keep between paragraphs
  codeBox?: boolean;       // put code-like blocks in a box
};

const isCodeFence = (line: string) => /^```/.test(line.trim());
const isBullet = (line: string) => /^(\s*)([-*•]|\d+\.)\s+/.test(line);
const isQuote  = (line: string) => /^\s*>/.test(line);
const isHeader = (line: string) => /^#{1,6}\s+/.test(line);
const isHorizontalRule = (line: string) => /^(\*{3,}|-{3,}|_{3,})\s*$/.test(line.trim());

/**
 * Enhance inline formatting (bold, italic, code, keywords)
 */
function enhanceInlineFormatting(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, chalk.bold('$1'))
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, chalk.italic('$1'))
    .replace(/`([^`]+)`/g, chalk.yellow('$1'))
    // Highlight special keywords
    .replace(/^(Intent|Files|Verification|Verify):/gm, chalk.green.bold('$1:'))
    .replace(/^(Risk|Warning|Note|Error):/gm, chalk.red.bold('$1:'))
    .replace(/^(Context|Background|Summary):/gm, chalk.blue.bold('$1:'))
    .replace(/^(Steps?|Actions?|Tasks?):/gm, chalk.cyan.bold('$1:'))
    .replace(/^(Acceptance Criteria|Success Criteria|Requirements?):/gm, chalk.magenta.bold('$1:'));
}

export function prettyPrint(raw: string, opts: PrettyOpts = {}): string {
  const width = Math.min(120, Math.max(40, opts.width ?? process.stdout.columns ?? 80));
  const indent = " ".repeat(opts.indent ?? 0);
  const paras = splitIntoParagraphs(raw, opts.maxParagraphGap ?? 1);

  const out: string[] = [];
  let inFence = false;
  let fenceLang = "";

  for (const p of paras) {
    // Handle code fences spanning multiple paragraphs
    if (p.some(line => isCodeFence(line))) {
      for (let line of p) {
        const trimmed = line.trim();
        if (isCodeFence(trimmed)) {
          if (!inFence) {
            inFence = true;
            fenceLang = trimmed.replace(/```+/, "").trim();
          } else {
            // close fence
            inFence = false;
            // Find the last accumulated code block and render it
            for (let i = out.length - 1; i >= 0; i--) {
              if (out[i].startsWith("\u0000CODE:")) {
                const payload = out[i].slice("\u0000CODE:".length);
                out[i] = renderCodeBlock(payload, fenceLang, width, !!opts.codeBox);
                break;
              }
            }
            fenceLang = "";
          }
        } else if (inFence) {
          // accumulate code lines
          const last = out.pop() ?? "";
          const payload = last.startsWith("\u0000CODE:")
            ? last.slice("\u0000CODE:".length) + "\n" + line
            : line;
          out.push("\u0000CODE:" + payload);
        }
      }
      continue;
    }

    if (inFence) {
      // Continue collecting fenced code lines
      for (const line of p) {
        const last = out.pop() ?? "";
        const payload = last.startsWith("\u0000CODE:")
          ? last.slice("\u0000CODE:".length) + "\n" + line
          : line;
        out.push("\u0000CODE:" + payload);
      }
      continue;
    }

    // Handle headers - check each line in the paragraph
    let hasHeaders = false;
    for (let i = 0; i < p.length; i++) {
      const line = p[i];
      if (isHeader(line)) {
        hasHeaders = true;
        const level = line.match(/^(#{1,6})/)?.[1].length || 1;
        const text = line.replace(/^#{1,6}\s+/, '');
        const enhanced = enhanceInlineFormatting(text);

        const styled = level === 1 ? chalk.cyan.bold(enhanced) :
                       level === 2 ? chalk.yellow.bold(enhanced) :
                       level === 3 ? chalk.blue.bold(enhanced) :
                       chalk.bold(enhanced);

        out.push(indent + styled);
      } else if (line.trim() === "") {
        out.push(""); // Preserve blank lines
      } else {
        // Regular text line in a paragraph with headers
        const enhanced = enhanceInlineFormatting(line);
        const wrapped = wrapAnsi(enhanced, width - indent.length, { hard: false, trim: true });
        out.push(indent + wrapped);
      }
    }
    if (hasHeaders) {
      out.push(""); // Add spacing after header paragraph
      continue;
    }

    // Handle horizontal rules
    if (p.length === 1 && isHorizontalRule(p[0])) {
      out.push(indent + chalk.dim('─'.repeat(Math.min(width - indent.length, 120))), "");
      continue;
    }

    // Handle bullet lists
    if (p.some(isBullet)) {
      for (const line of p) {
        const m = line.match(/^(\s*)([-*•]|\d+\.)\s+(.*)$/);
        if (m) {
          const [, lead, bullet, rest] = m;
          const bulletChar = bullet.includes('.') ? bullet : '•';
          const bulletPrefix = (lead ?? "") + bulletChar + " ";
          const enhanced = enhanceInlineFormatting(rest);
          const wrapped = wrapAnsi(enhanced, width - visibleWidth(bulletPrefix), {
            hard: false,
            trim: true
          }).split("\n").map((ln, i) => (i === 0 ? bulletPrefix + ln : " ".repeat(bulletPrefix.length) + ln));
          out.push(indent + wrapped.join("\n"));
        } else {
          // plain line inside a bullet group
          const enhanced = enhanceInlineFormatting(line.trim());
          const wrapped = wrapAnsi(enhanced, width - (indent.length), {
            hard: false, trim: true
          });
          out.push(indent + wrapped);
        }
      }
      out.push(""); // paragraph gap
      continue;
    }

    // Handle blockquotes
    if (p.every(isQuote)) {
      const stripped = p.map(l => l.replace(/^\s*>\s?/, "")).join("\n");
      const enhanced = enhanceInlineFormatting(stripped);
      const wrapped = wrapAnsi(enhanced, width - 2, { hard: false, trim: true })
        .split("\n").map(ln => chalk.gray("│ ") + ln).join("\n");
      out.push(indent + wrapped, "");
      continue;
    }

    // Normal paragraph: collapse to single line, then wrap
    const text = p.join(" ").replace(/\s+/g, " ").trim();
    if (text.length > 0) {
      const enhanced = enhanceInlineFormatting(text);
      const wrapped = wrapAnsi(enhanced, width - indent.length, { hard: false, trim: true });
      out.push(indent + wrapped, "");
    }
  }

  // Materialize any remaining code payloads
  for (let i = 0; i < out.length; i++) {
    if (out[i].startsWith("\u0000CODE:")) {
      const payload = out[i].slice("\u0000CODE:".length);
      out[i] = renderCodeBlock(payload, fenceLang, width, !!opts.codeBox);
    }
  }

  // Tidy ending
  while (out.length && out[out.length - 1] === "") out.pop();
  return out.join("\n");
}

function splitIntoParagraphs(raw: string, maxGap: number): string[][] {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const paras: string[][] = [];
  let cur: string[] = [];
  let blankRun = 0;

  for (const ln of lines) {
    if (ln.trim() === "") {
      blankRun++;
      if (blankRun <= maxGap) cur.push("");
      else if (cur.length) { paras.push(cur); cur = []; }
    } else {
      blankRun = 0;
      cur.push(ln);
    }
  }
  if (cur.length) paras.push(cur);
  return paras;
}

function visibleWidth(s: string): number {
  return Math.max(0, stripAnsi(s).length);
}

function renderCodeBlock(code: string, lang: string, width: number, boxed: boolean): string {
  let highlighted = code;

  try {
    highlighted = highlight(code, {
      language: lang || undefined,
      ignoreIllegals: true,
      theme: {}
    });
  } catch (error) {
    // Fall back to original code if highlighting fails
    highlighted = code;
  }

  const wrapped = highlighted.split("\n").map(line =>
    wrapAnsi(line, width - (boxed ? 4 : 0), { hard: false, trim: false })
  ).join("\n");

  if (!boxed) {
    // Add simple indentation for code blocks
    return wrapped.split('\n').map(line => '    ' + line).join('\n');
  }

  return boxen(wrapped, {
    padding: { top: 0, right: 1, bottom: 0, left: 1 },
    borderStyle: "round",
    borderColor: "gray"
  });
}