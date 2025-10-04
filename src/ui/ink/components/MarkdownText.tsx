import React from 'react';
import { Text, Box } from 'ink';

/**
 * Ink-native markdown renderer
 * Parses markdown and renders using Ink Text components with proper props
 */

interface MarkdownTextProps {
  children: string;
  maxLines?: number;
}

// Markdown detection helpers
const isCodeFence = (line: string) => /^```/.test(line.trim());
const isBullet = (line: string) => /^(\s*)([-*•]|\d+\.)\s+/.test(line);
const isHeader = (line: string) => /^#{1,6}\s+/.test(line);
const isHorizontalRule = (line: string) => /^(\*{3,}|-{3,}|_{3,})\s*$/.test(line.trim());

// Parse inline formatting
interface InlineSegment {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  color?: string;
}

function parseInline(text: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  let current = '';
  let i = 0;

  // Simple state-based parser for inline formatting
  while (i < text.length) {
    // Bold: **text**
    if (text[i] === '*' && text[i + 1] === '*') {
      if (current) {
        segments.push({ text: current });
        current = '';
      }
      i += 2;
      const start = i;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '*')) {
        i++;
      }
      if (i < text.length) {
        segments.push({ text: text.substring(start, i), bold: true });
        i += 2;
      }
      continue;
    }

    // Italic: *text*
    if (text[i] === '*' && text[i + 1] !== '*') {
      if (current) {
        segments.push({ text: current });
        current = '';
      }
      i += 1;
      const start = i;
      while (i < text.length && text[i] !== '*') {
        i++;
      }
      if (i < text.length) {
        segments.push({ text: text.substring(start, i), italic: true });
        i += 1;
      }
      continue;
    }

    // Inline code: `code`
    if (text[i] === '`') {
      if (current) {
        segments.push({ text: current });
        current = '';
      }
      i += 1;
      const start = i;
      while (i < text.length && text[i] !== '`') {
        i++;
      }
      if (i < text.length) {
        segments.push({ text: text.substring(start, i), code: true });
        i += 1;
      }
      continue;
    }

    current += text[i];
    i++;
  }

  if (current) {
    segments.push({ text: current });
  }

  return segments;
}

// Highlight special keywords
function highlightKeywords(segment: InlineSegment): InlineSegment {
  const keywordPatterns = [
    { pattern: /^(Intent|Files|Verification|Verify):/, color: 'green' },
    { pattern: /^(Risk|Warning|Note|Error):/, color: 'red' },
    { pattern: /^(Context|Background|Summary):/, color: 'blue' },
    { pattern: /^(Steps?|Actions?|Tasks?):/, color: 'cyan' },
    { pattern: /^(Acceptance Criteria|Success Criteria|Requirements?):/, color: 'magenta' },
  ];

  for (const { pattern, color } of keywordPatterns) {
    if (pattern.test(segment.text)) {
      return { ...segment, color, bold: true };
    }
  }

  return segment;
}

export const MarkdownText: React.FC<MarkdownTextProps> = ({ children, maxLines }) => {
  const lines = children.split('\n');
  const displayLines = maxLines ? lines.slice(0, maxLines) : lines;
  const isTruncated = maxLines && lines.length > maxLines;

  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];
  let codeLang = '';

  displayLines.forEach((line, idx) => {
    const key = `line-${idx}`;

    // Code blocks
    if (isCodeFence(line)) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeLang = line.trim().replace(/```+/, '').trim();
      } else {
        // End of code block - render accumulated lines
        inCodeBlock = false;
        elements.push(
          <Box key={key} flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1} marginY={1}>
            {codeLines.map((codeLine, cIdx) => (
              <Text key={`code-${idx}-${cIdx}`} dimColor>
                {codeLine}
              </Text>
            ))}
          </Box>
        );
        codeLines = [];
        codeLang = '';
      }
      return;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      return;
    }

    // Headers
    if (isHeader(line)) {
      const match = line.match(/^(#{1,6})\s+(.*)$/);
      if (match) {
        const level = match[1].length;
        const text = match[2];
        const segments = parseInline(text);

        const color = level === 1 ? 'cyan' : level === 2 ? 'yellow' : level === 3 ? 'blue' : 'white';
        elements.push(
          <Box key={key} marginTop={level === 1 ? 1 : 0}>
            <Text>
              {segments.map((seg, sIdx) => (
                <Text key={`seg-${sIdx}`} color={color} bold italic={seg.italic}>
                  {seg.text}
                </Text>
              ))}
            </Text>
          </Box>
        );
      }
      return;
    }

    // Horizontal rules
    if (isHorizontalRule(line)) {
      elements.push(
        <Box key={key} marginY={1}>
          <Text dimColor>{'─'.repeat(40)}</Text>
        </Box>
      );
      return;
    }

    // Bullet lists
    if (isBullet(line)) {
      const match = line.match(/^(\s*)([-*•]|\d+\.)\s+(.*)$/);
      if (match) {
        const indent = match[1].length;
        const text = match[3];
        const segments = parseInline(text);

        elements.push(
          <Box key={key} paddingLeft={Math.floor(indent / 2)}>
            <Text>• </Text>
            <Text>
              {segments.map((seg, sIdx) => {
                const highlighted = highlightKeywords(seg);
                return (
                  <Text
                    key={`seg-${sIdx}`}
                    bold={highlighted.bold}
                    italic={highlighted.italic}
                    color={highlighted.code ? 'yellow' : highlighted.color}
                    dimColor={highlighted.code}
                  >
                    {highlighted.text}
                  </Text>
                );
              })}
            </Text>
          </Box>
        );
      }
      return;
    }

    // Empty lines
    if (line.trim() === '') {
      elements.push(<Text key={key}> </Text>);
      return;
    }

    // Regular paragraphs
    const segments = parseInline(line);
    elements.push(
      <Box key={key}>
        <Text>
          {segments.map((seg, sIdx) => {
            const highlighted = highlightKeywords(seg);
            return (
              <Text
                key={`seg-${sIdx}`}
                bold={highlighted.bold}
                italic={highlighted.italic}
                color={highlighted.code ? 'yellow' : highlighted.color}
                dimColor={highlighted.code}
              >
                {highlighted.text}
              </Text>
            );
          })}
        </Text>
      </Box>
    );
  });

  // Add truncation indicator
  if (isTruncated) {
    elements.push(
      <Box key="truncated" marginTop={1}>
        <Text dimColor>...</Text>
      </Box>
    );
  }

  return <Box flexDirection="column">{elements}</Box>;
};
