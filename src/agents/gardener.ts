import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { LLMProvider } from "../providers/index.js";
import { log } from "../ui/log.js";

/**
 * Parameters for Gardener agent invocation
 */
export interface GardenerParams {
  taskId: string;
  taskDescription: string;
  planSummary: string;
  workingDirectory: string;  // CLAUDE.md location derived from this
}

/**
 * Result from Gardener agent execution
 */
export interface GardenerResult {
  success: boolean;
  message: string;
  sectionsUpdated: string[];
  error?: string;
}

/**
 * Gardener agent - Updates CLAUDE.md with task completion insights
 *
 * This agent analyzes completed tasks and updates the project documentation
 * with relevant learnings, patterns, and insights. It reads the current
 * CLAUDE.md, determines which sections need updates, and applies targeted
 * changes to maintain an accurate project knowledge base.
 *
 * @param provider - LLM provider for Claude API access
 * @param params - Task context and metadata
 * @returns Result indicating success/failure and which sections were updated
 */
export async function runGardener(
  provider: LLMProvider,
  params: GardenerParams
): Promise<GardenerResult> {
  // Parameter validation
  if (!params.taskId || !params.taskDescription || !params.workingDirectory) {
    const error = `Invalid parameters: taskId=${!!params.taskId}, taskDescription=${!!params.taskDescription}, workingDirectory=${!!params.workingDirectory}`;
    log.warn(`Gardener parameter validation failed: ${error}`);

    return {
      success: false,
      message: 'Missing required parameters',
      sectionsUpdated: [],
      error
    };
  }

  // Derive CLAUDE.md path from working directory
  const claudeMdPath = join(params.workingDirectory, 'CLAUDE.md');

  // Check file size for informational purposes (Gardener LLM will decide if pruning is needed)
  try {
    const claudeMdContent = readFileSync(claudeMdPath, 'utf-8');
    const currentSize = claudeMdContent.length;

    log.info(`📏 CLAUDE.md size: ${currentSize} characters`);
  } catch (error) {
    // File might not exist or be readable - continue anyway
    log.warn(`Could not check CLAUDE.md size: ${error instanceof Error ? error.message : String(error)}`);
  }

  log.info(`🌱 Gardener: Analyzing task completion for ${params.taskId}`);
  log.info(`📖 Reading CLAUDE.md from: ${claudeMdPath}`);

  // Load system prompt from external file
  const systemPrompt = readFileSync(
    new URL("../prompts/gardener.md", import.meta.url),
    "utf8"
  );

  // Construct user message with all task context
  const userMessage = `Task ID: ${params.taskId}

Task Description:
${params.taskDescription}

Plan Summary:
${params.planSummary}

CLAUDE.md Location: ${claudeMdPath}

Please analyze this completed task and update CLAUDE.md with relevant insights. Read the current documentation, identify which sections need updates based on what was accomplished, and apply targeted edits to maintain an accurate project knowledge base.`;

  // Execute provider query with error handling
  try {
    log.startStreaming("Gardener");

    const response = await provider.query({
      cwd: params.workingDirectory,
      mode: "default", // Enable file operation tools
      allowedTools: ["ReadFile", "Edit", "Write", "Grep"],
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
      callbacks: {
        onProgress: log.streamProgress,
        onToolUse: (tool, input) => log.toolUse("Gardener", tool, input),
        onToolResult: (isError) => log.toolResult("Gardener", isError),
        onComplete: (cost, duration) => log.complete("Gardener", cost, duration)
      }
    });

    // Handle provider communication failure
    if (!response) {
      const error = 'Provider query returned no response';
      log.warn(`❌ Gardener failed: ${error}`);

      return {
        success: false,
        message: 'Provider query failed',
        sectionsUpdated: [],
        error
      };
    }

    // Parse response to extract sections updated
    // The response should be natural language describing what was done
    const sectionsUpdated = extractSectionsFromResponse(response);

    log.info(`✅ Updated CLAUDE.md sections: ${sectionsUpdated.join(', ')}`);

    return {
      success: true,
      message: 'Successfully updated CLAUDE.md',
      sectionsUpdated
    };

  } catch (error) {
    // Handle provider communication errors (timeouts, rate limits, network)
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.warn(`❌ Gardener provider error: ${errorMessage}`);

    if (process.env.DEBUG === 'true') {
      console.error('Full error context:', JSON.stringify(error, null, 2));
    }

    return {
      success: false,
      message: 'Provider communication error',
      sectionsUpdated: [],
      error: errorMessage
    };
  }
}

/**
 * Extract section names from the agent's natural language response
 * Looks for common patterns indicating which sections were updated
 */
function extractSectionsFromResponse(response: string): string[] {
  const sections: string[] = [];
  const patterns = [
    /updated?\s+["']?([^"'\n]+)["']?\s+section/gi,
    /modified?\s+["']?([^"'\n]+)["']?\s+section/gi,
    /added to\s+["']?([^"'\n]+)["']?/gi,
    /edited\s+["']?([^"'\n]+)["']?/gi
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(response)) !== null) {
      const section = match[1].trim();
      if (section && !sections.includes(section)) {
        sections.push(section);
      }
    }
  }

  // If no specific sections identified, return generic indicator
  if (sections.length === 0) {
    return ['CLAUDE.md'];
  }

  return sections;
}

