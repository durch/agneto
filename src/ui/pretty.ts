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

  const emitParagraph = (paragraph: string[]) => {
    if (!paragraph.length) return;

    if (paragraph.length === 1 && isHorizontalRule(paragraph[0])) {
      out.push(indent + chalk.dim('─'.repeat(Math.min(width - indent.length, 120))), "");
      return;
    }

    if (paragraph.some(isHeader)) {
      let hasHeaders = false;
      for (let i = 0; i < paragraph.length; i++) {
        const line = paragraph[i];
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
          out.push("");
        } else {
          const enhanced = enhanceInlineFormatting(line);
          const wrapped = wrapAnsi(enhanced, width - indent.length, { hard: false, trim: true });
          const indented = wrapped.split("\n").map(ln => indent + ln).join("\n");
          out.push(indented);
        }
      }
      if (hasHeaders) out.push("");
      return;
    }

    if (paragraph.some(isBullet)) {
      for (const line of paragraph) {
        const m = line.match(/^(\s*)([-*•]|\d+\.)\s+(.*)$/);
        if (m) {
          const [, lead = "", bullet, rest] = m;
          const bulletChar = bullet.includes('.') ? bullet : '•';
          const bulletLabel = `${bulletChar} `;
          const firstPrefix = indent + lead + bulletLabel;
          const availableWidth = Math.max(1, width - visibleWidth(firstPrefix));
          const enhanced = enhanceInlineFormatting(rest);
          const wrappedLines = wrapAnsi(enhanced, availableWidth, {
            hard: false,
            trim: true
          }).split("\n");
          const continuationPrefix = indent + lead + " ".repeat(visibleWidth(bulletLabel));
          const formatted = wrappedLines
            .map((ln, i) => (i === 0 ? firstPrefix : continuationPrefix) + ln)
            .join("\n");
          out.push(formatted);
        } else {
          const enhanced = enhanceInlineFormatting(line.trim());
          const wrapped = wrapAnsi(enhanced, Math.max(1, width - indent.length), {
            hard: false,
            trim: true
          }).split("\n").map(ln => indent + ln).join("\n");
          out.push(wrapped);
        }
      }
      out.push("");
      return;
    }

    if (paragraph.every(isQuote)) {
      const stripped = paragraph.map(l => l.replace(/^\s*>\s?/, "")).join("\n");
      const enhanced = enhanceInlineFormatting(stripped);
      const quotePrefix = indent + chalk.gray("│ ");
      const availableWidth = Math.max(1, width - visibleWidth(quotePrefix));
      const wrapped = wrapAnsi(enhanced, availableWidth, { hard: false, trim: true })
        .split("\n").map(ln => quotePrefix + ln).join("\n");
      out.push(wrapped, "");
      return;
    }

    const text = paragraph.join(" ").replace(/\s+/g, " ").trim();
    if (text.length > 0) {
      const enhanced = enhanceInlineFormatting(text);
      const wrapped = wrapAnsi(enhanced, width - indent.length, { hard: false, trim: true });
      const indented = wrapped.split("\n").map(ln => indent + ln).join("\n");
      out.push(indented, "");
    }
  };

  for (const p of paras) {
    // Handle code fences spanning multiple paragraphs
    if (p.some(line => isCodeFence(line))) {
      const pending: string[] = [];
      for (let line of p) {
        const trimmed = line.trim();
        if (isCodeFence(trimmed)) {
          if (!inFence) {
            if (pending.length) {
              emitParagraph(pending);
              pending.length = 0;
            }
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
          // accumulate code lines without dropping prior output
          const sentinelIndex = out.length - 1;
          const sentinel = out[sentinelIndex];
          if (sentinel?.startsWith("\u0000CODE:")) {
            out[sentinelIndex] = "\u0000CODE:" + sentinel.slice("\u0000CODE:".length) + "\n" + line;
          } else {
            out.push("\u0000CODE:" + line);
          }
        } else {
          pending.push(line);
        }
      }
      if (pending.length) emitParagraph(pending);
      continue;
    }

    if (inFence) {
      // Continue collecting fenced code lines
      for (const line of p) {
        const sentinelIndex = out.length - 1;
        const sentinel = out[sentinelIndex];
        if (sentinel?.startsWith("\u0000CODE:")) {
          out[sentinelIndex] = "\u0000CODE:" + sentinel.slice("\u0000CODE:".length) + "\n" + line;
        } else {
          out.push("\u0000CODE:" + line);
        }
      }
      continue;
    }

    emitParagraph(p);
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

  const codeIndent = "    ";
  const availableWidth = Math.max(1, width - (boxed ? 4 : codeIndent.length));
  const wrapped = highlighted
    .split("\n")
    .map(line => wrapAnsi(line, availableWidth, { hard: false, trim: false }))
    .join("\n");

  if (!boxed) {
    // Add simple indentation for code blocks
    return wrapped.split('\n').map(line => codeIndent + line).join('\n');
  }

  return boxen(wrapped, {
    padding: { top: 0, right: 1, bottom: 0, left: 1 },
    borderStyle: "round",
    borderColor: "gray"
  });
}
