import chalk from "chalk";
import { marked } from "marked";
import TerminalRenderer from "marked-terminal";

// Configure marked with terminal renderer
const renderer = new TerminalRenderer({
    // Configure colors to work well with existing chalk styling
    heading: chalk.cyan.bold,
    strong: chalk.bold,
    em: chalk.italic,
    codespan: chalk.yellow,
    code: chalk.yellow,
    blockquote: chalk.gray.italic,
    list: chalk.white,
    listitem: chalk.white,
    paragraph: chalk.white,
    href: chalk.blue.underline,
    // Configure indentation and spacing
    width: 80,
    showSectionPrefix: false,
    unescape: true,
    emoji: false,
    tableOptions: {},
});

// Set the renderer globally for marked
marked.setOptions({
    renderer: renderer as any, // Type assertion to work around API changes
});

/**
 * Renders markdown text as formatted terminal output
 * @param markdownText The markdown string to render
 * @returns Formatted terminal output string compatible with existing chalk styling
 */
export function renderMarkdown(markdownText: string): string {
    try {
        const result = marked(markdownText);
        // Handle both sync and async results from marked
        if (typeof result === 'string') {
            return result;
        } else {
            // If async, fall back to raw text for now (synchronous context)
            return markdownText;
        }
    } catch (error) {
        // Fallback to raw text if markdown parsing fails
        console.error("Error rendering markdown:", error);
        return markdownText;
    }
}