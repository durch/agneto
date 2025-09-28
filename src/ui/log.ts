import chalk from "chalk";
import { prettyPrint } from "./pretty.js";

// Log level types and hierarchy
type LogLevel = 'debug' | 'verbose' | 'info';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  verbose: 1,
  info: 2
};

/**
 * LogUI class for managing console output with configurable log levels
 * Provides structured logging with color-coded agent messages and level-based filtering
 */
class LogUI {
  private logLevel: LogLevel;
  private logLevelValue: number;

  // Message consolidation state
  private rawResponseBuffer: string | null = null;
  private bufferTimer: NodeJS.Timeout | null = null;
  private bufferAgentType: string | null = null;
  private readonly BUFFER_TIMEOUT = 100; // 100ms window for interpretation to arrive

  // Phase tracking for automatic dividers
  private currentPhase: string | null = null;
  private readonly DIVIDER_WIDTH = 70;

  // Tree-style indentation tracking
  private indentLevel: number = 0;
  private isLastItem: boolean = false;

  // Sprint/chunk counter tracking for badges
  private currentChunkNumber: number | null = null;
  private currentSprintNumber: number | null = null;

  constructor() {
    // Initialize log level from environment variable, default to 'info'
    const envLevel = (process.env.LOG_LEVEL || 'info').toLowerCase();
    this.logLevel = this.isValidLogLevel(envLevel) ? envLevel as LogLevel : 'info';
    this.logLevelValue = LOG_LEVELS[this.logLevel];

    // Bind all public methods to maintain 'this' context when used as callbacks
    this.planner = this.planner.bind(this);
    this.curmudgeon = this.curmudgeon.bind(this);
    this.coder = this.coder.bind(this);
    this.review = this.review.bind(this);
    this.beanCounter = this.beanCounter.bind(this);
    this.orchestrator = this.orchestrator.bind(this);
    this.streamProgress = this.streamProgress.bind(this);
    this.toolUse = this.toolUse.bind(this);
    this.toolResult = this.toolResult.bind(this);
    this.complete = this.complete.bind(this);
    this.info = this.info.bind(this);
    this.warn = this.warn.bind(this);
    this.logDivider = this.logDivider.bind(this);
    this.startStreaming = this.startStreaming.bind(this);
    this.setChunkNumber = this.setChunkNumber.bind(this);
    this.setSprintNumber = this.setSprintNumber.bind(this);
    this.indent = this.indent.bind(this);
    this.outdent = this.outdent.bind(this);
    this.setLastItem = this.setLastItem.bind(this);
  }

  /**
   * Check if a message should be logged based on current log level
   */
  private shouldLog(requiredLevel: LogLevel): boolean {
    return LOG_LEVELS[requiredLevel] >= this.logLevelValue;
  }

  /**
   * Update the current chunk number (called when Bean Counter provides updates)
   */
  setChunkNumber(chunkNum: number | null): void {
    this.currentChunkNumber = chunkNum;
  }

  /**
   * Update the current sprint number (called when Bean Counter provides updates)
   */
  setSprintNumber(sprintNum: number | null): void {
    this.currentSprintNumber = sprintNum;
  }

  /**
   * Increase indentation level for nested operations
   */
  indent(): void {
    this.indentLevel++;
  }

  /**
   * Decrease indentation level after nested operations
   */
  outdent(): void {
    if (this.indentLevel > 0) {
      this.indentLevel--;
    }
  }

  /**
   * Set whether the next logged item is the last in its group
   */
  setLastItem(isLast: boolean): void {
    this.isLastItem = isLast;
  }

  /**
   * Generate tree-style indentation prefix based on current level
   */
  private getIndentPrefix(): string {
    if (this.indentLevel === 0) {
      return '';
    }

    let prefix = '';

    // Build up the prefix for each level of indentation
    for (let i = 0; i < this.indentLevel - 1; i++) {
      prefix += '│  '; // Vertical line with spacing for intermediate levels
    }

    // Add the final branch character
    if (this.isLastItem) {
      prefix += '└─ '; // Last item in group
      this.isLastItem = false; // Reset after use
    } else {
      prefix += '├─ '; // Regular item in group
    }

    return chalk.dim(prefix);
  }

  /**
   * Apply indentation to multi-line message strings
   */
  private applyIndentToMultiline(message: string): string {
    if (this.indentLevel === 0) {
      return message;
    }

    // Apply continuation prefix to subsequent lines
    const lines = message.split('\n');
    if (lines.length <= 1) {
      return message;
    }

    const continuationPrefix = chalk.dim('│  '.repeat(this.indentLevel));

    return lines
      .map((line, index) => {
        if (index === 0) {
          return line; // First line already has the prefix from the caller
        }
        return continuationPrefix + line;
      })
      .join('\n');
  }

  /**
   * Validate if a string is a valid log level
   */
  private isValidLogLevel(level: string): boolean {
    return level in LOG_LEVELS;
  }

  /**
   * Buffer a raw response message and start a flush timer
   */
  private bufferRawMessage(message: string, agentType: string): void {
    // Clear any existing timer
    if (this.bufferTimer) {
      clearTimeout(this.bufferTimer);
    }

    // Store the message and agent type
    this.rawResponseBuffer = message;
    this.bufferAgentType = agentType;

    // Start a timer to flush if no interpretation arrives
    this.bufferTimer = setTimeout(() => {
      this.flushBuffer();
    }, this.BUFFER_TIMEOUT);
  }

  /**
   * Flush any buffered raw message
   */
  private flushBuffer(): void {
    if (this.rawResponseBuffer && this.bufferAgentType) {
      // Output the buffered message normally based on agent type
      const agentFormatters: Record<string, (s: string) => void> = {
        'coder': (s) => console.log(chalk.magenta("🤖 Coder:"), "\n" + prettyPrint(s, { indent: 2 })),
        'curmudgeon': (s) => console.log(chalk.red("🎭 Curmudgeon:"), "\n" + prettyPrint(s, { indent: 2 })),
        'review': (s) => console.log(chalk.yellow("👀 Reviewer:"), "\n" + prettyPrint(s, { indent: 2 })),
        'beanCounter': (s) => console.log(chalk.blue("🧮 Bean Counter:"), "\n" + prettyPrint(s, { indent: 2 })),
        'orchestrator': (s) => console.log(chalk.green("🙋 Orchestrator:"), "\n" + prettyPrint(s, { indent: 2 }))
      };

      const formatter = agentFormatters[this.bufferAgentType];
      if (formatter) {
        if (this.indentLevel === 0) {
          // No indentation needed for buffered messages - they'll be handled in consolidation
          formatter(this.rawResponseBuffer);
        } else {
          // Apply indentation to buffered message
          const prefix = this.getIndentPrefix();
          const indentedMessage = this.applyIndentToMultiline(this.rawResponseBuffer);
          const agentPrefix = this.bufferAgentType === 'coder' ? chalk.magenta("🤖 Coder:") :
                             this.bufferAgentType === 'curmudgeon' ? chalk.red("🎭 Curmudgeon:") :
                             this.bufferAgentType === 'review' ? chalk.yellow("👀 Reviewer:") :
                             this.bufferAgentType === 'beanCounter' ? chalk.blue("🧮 Bean Counter:") :
                             chalk.green("🙋 Orchestrator:");
          console.log(prefix + agentPrefix, indentedMessage);
        }
      }
    }

    // Clear the buffer state
    this.rawResponseBuffer = null;
    this.bufferAgentType = null;
    if (this.bufferTimer) {
      clearTimeout(this.bufferTimer);
      this.bufferTimer = null;
    }
  }

  /**
   * Consolidate buffered raw message with interpretation
   */
  private consolidateWithInterpretation(interpretation: string, agentType: string): boolean {
    // Check if we have a buffered raw message for the same agent
    if (this.rawResponseBuffer && this.bufferAgentType === agentType) {
      // Clear the timer
      if (this.bufferTimer) {
        clearTimeout(this.bufferTimer);
        this.bufferTimer = null;
      }

      // Extract the essential parts from the messages
      const rawPart = this.rawResponseBuffer.replace(/^Raw .* response:\s*/, '');
      const interpretedPart = interpretation.replace(/^Interpreted .* as:\s*/, '');

      // Create consolidated message with concise format
      const consolidated = `Raw response → interpreted as: ${interpretedPart}`;

      // Output with appropriate agent formatting
      const agentFormatters: Record<string, (s: string) => void> = {
        'coder': (s) => console.log(chalk.magenta("🤖 Coder:"), "\n" + prettyPrint(s, { indent: 2 })),
        'curmudgeon': (s) => console.log(chalk.red("🎭 Curmudgeon:"), "\n" + prettyPrint(s, { indent: 2 })),
        'review': (s) => console.log(chalk.yellow("👀 Reviewer:"), "\n" + prettyPrint(s, { indent: 2 })),
        'beanCounter': (s) => console.log(chalk.blue("🧮 Bean Counter:"), "\n" + prettyPrint(s, { indent: 2 })),
        'orchestrator': (s) => console.log(chalk.green("🙋 Orchestrator:"), "\n" + prettyPrint(s, { indent: 2 }))
      };

      const formatter = agentFormatters[agentType];
      if (formatter) {
        if (this.indentLevel === 0) {
          // No indentation for consolidated messages at root level
          formatter(consolidated);
        } else {
          // Apply indentation to consolidated message
          const prefix = this.getIndentPrefix();
          const indentedMessage = this.applyIndentToMultiline(consolidated);
          const agentPrefix = agentType === 'coder' ? chalk.magenta("🤖 Coder:") :
                             agentType === 'curmudgeon' ? chalk.red("🎭 Curmudgeon:") :
                             agentType === 'review' ? chalk.yellow("👀 Reviewer:") :
                             agentType === 'beanCounter' ? chalk.blue("🧮 Bean Counter:") :
                             chalk.green("🙋 Orchestrator:");
          console.log(prefix + agentPrefix, indentedMessage);
        }
      }

      // Clear the buffer
      this.rawResponseBuffer = null;
      this.bufferAgentType = null;

      return true; // Consolidation successful
    }

    return false; // No buffered message to consolidate
  }

  // Agent start messages (info level - always shown in normal operation)
  planner(s: string): void {
    if (this.shouldLog('info')) {
      this.clearToolStatus();
      this.checkPhaseTransition('PLANNING');
      const badge = this.generatePhaseBadge();
      const prefix = this.getIndentPrefix();
      const prettyMessage = prettyPrint(s, { indent: 2 });
      if (prefix) {
        console.log(prefix + badge + chalk.cyan("📝 Planner:"), "\n" + prettyMessage);
      } else {
        console.log(badge + chalk.cyan("📝 Planner:"), "\n" + prettyMessage);
      }
    }
  }

  curmudgeon(s: string, phase?: string): void {
    if (this.shouldLog('info')) {
      this.checkPhaseTransition('CURMUDGEONING');

      // Check for raw response pattern
      if (s.startsWith('Raw ') && s.includes(' response:')) {
        this.clearToolStatus(false); // Raw buffering - no meaningful content yet
        this.bufferRawMessage(s, 'curmudgeon');
        return;
      }

      // Check for interpretation pattern
      if (s.startsWith('Interpreted ') && s.includes(' as:')) {
        this.clearToolStatus(false); // Interpretation consolidation - no direct user content
        if (this.consolidateWithInterpretation(s, 'curmudgeon')) {
          return; // Successfully consolidated
        }
      }

      // Normal message output with badge and indentation - clear status for meaningful content
      this.clearToolStatus(); // Substantive content - clear status
      const badge = this.generatePhaseBadge();
      const prefix = this.getIndentPrefix();
      const prettyMessage = prettyPrint(s, { indent: 2 });
      if (prefix) {
        console.log(prefix + badge + chalk.red("🎭 Curmudgeon:"), "\n" + prettyMessage);
      } else {
        console.log(badge + chalk.red("🎭 Curmudgeon:"), "\n" + prettyMessage);
      }
    }
  }

  coder(s: string): void {
    if (this.shouldLog('info')) {
      this.checkPhaseTransition('CODING');

      // Check for raw response pattern
      if (s.startsWith('Raw ') && s.includes(' response:')) {
        this.clearToolStatus(false); // Raw buffering - no meaningful content yet
        this.bufferRawMessage(s, 'coder');
        return;
      }

      // Check for interpretation pattern
      if (s.startsWith('Interpreted ') && s.includes(' as:')) {
        this.clearToolStatus(false); // Interpretation consolidation - no direct user content
        if (this.consolidateWithInterpretation(s, 'coder')) {
          return; // Successfully consolidated
        }
      }

      // Normal message output with badge and indentation - clear status for meaningful content
      this.clearToolStatus(); // Substantive content - clear status
      const badge = this.generatePhaseBadge();
      const prefix = this.getIndentPrefix();
      const prettyMessage = prettyPrint(s, { indent: 2 });
      if (prefix) {
        console.log(prefix + badge + chalk.magenta("🤖 Coder:"), "\n" + prettyMessage);
      } else {
        console.log(badge + chalk.magenta("🤖 Coder:"), "\n" + prettyMessage);
      }
    }
  }

  review(s: string): void {
    if (this.shouldLog('info')) {
      this.checkPhaseTransition('REVIEW');

      // Check for raw response pattern
      if (s.startsWith('Raw ') && s.includes(' response:')) {
        this.clearToolStatus(false); // Raw buffering - no meaningful content yet
        this.bufferRawMessage(s, 'review');
        return;
      }

      // Check for interpretation pattern
      if (s.startsWith('Interpreted ') && s.includes(' as:')) {
        this.clearToolStatus(false); // Interpretation consolidation - no direct user content
        if (this.consolidateWithInterpretation(s, 'review')) {
          return; // Successfully consolidated
        }
      }

      // Normal message output with badge and indentation - clear status for meaningful content
      this.clearToolStatus(); // Substantive content - clear status
      const badge = this.generatePhaseBadge();
      const prefix = this.getIndentPrefix();
      const prettyMessage = prettyPrint(s, { indent: 2 });
      if (prefix) {
        console.log(prefix + badge + chalk.yellow("👀 Reviewer:"), "\n" + prettyMessage);
      } else {
        console.log(badge + chalk.yellow("👀 Reviewer:"), "\n" + prettyMessage);
      }
    }
  }

  beanCounter(s: string): void {
    if (this.shouldLog('info')) {
      this.checkPhaseTransition('CHUNKING');

      // Extract chunk/sprint info from Bean Counter messages
      this.extractChunkInfo(s);

      // Check for raw response pattern
      if (s.startsWith('Raw ') && s.includes(' response:')) {
        this.clearToolStatus(false); // Raw buffering - no meaningful content yet
        this.bufferRawMessage(s, 'beanCounter');
        return;
      }

      // Check for interpretation pattern
      if (s.startsWith('Interpreted ') && s.includes(' as:')) {
        this.clearToolStatus(false); // Interpretation consolidation - no direct user content
        if (this.consolidateWithInterpretation(s, 'beanCounter')) {
          return; // Successfully consolidated
        }
      }

      // Normal message output with badge and indentation - clear status for meaningful content
      this.clearToolStatus(); // Substantive content - clear status
      const badge = this.generatePhaseBadge();
      const prefix = this.getIndentPrefix();
      const prettyMessage = prettyPrint(s, { indent: 2 });
      if (prefix) {
        console.log(prefix + badge + chalk.blue("🧮 Bean Counter:"), "\n" + prettyMessage);
      } else {
        console.log(badge + chalk.blue("🧮 Bean Counter:"), "\n" + prettyMessage);
      }
    }
  }

  orchestrator(s: string): void {
    if (this.shouldLog('info')) {
      this.checkPhaseTransition('ORCHESTRATION');

      // Check for task completion markers
      if (s.toLowerCase().includes('task complete') ||
          s.toLowerCase().includes('all steps complete')) {
        this.currentPhase = 'COMPLETE';
      }

      // Check for raw response pattern
      if (s.startsWith('Raw ') && s.includes(' response:')) {
        this.clearToolStatus(false); // Raw buffering - no meaningful content yet
        this.bufferRawMessage(s, 'orchestrator');
        return;
      }

      // Check for interpretation pattern
      if (s.startsWith('Interpreted ') && s.includes(' as:')) {
        this.clearToolStatus(false); // Interpretation consolidation - no direct user content
        if (this.consolidateWithInterpretation(s, 'orchestrator')) {
          return; // Successfully consolidated
        }
      }

      // Normal message output with badge and indentation - clear status for meaningful content
      this.clearToolStatus(); // Substantive content - clear status
      const badge = this.generatePhaseBadge();
      const prefix = this.getIndentPrefix();
      const indentedMessage = this.applyIndentToMultiline(s);
      if (prefix) {
        console.log(prefix + badge + chalk.green("🙋 Orchestrator:"), indentedMessage);
      } else {
        console.log(badge + chalk.green("🙋 Orchestrator:"), indentedMessage);
      }
    }
  }

  // Real-time streaming functions (verbose level - shown in verbose and debug modes)
  streamProgress(text: string): void {
    if (!this.shouldLog('verbose')) return;

    // Handle streaming text with proper formatting
    // Add word wrapping and preserve readability while maintaining real-time feel
    const cleanText = text.trim();
    if (cleanText) {
      // Check if text ends with punctuation (sentence/paragraph boundary)
      const endsWithPunctuation = /[.!?]\s*$/.test(cleanText);

      if (endsWithPunctuation) {
        // Complete sentence/thought - add newline for readability
        process.stdout.write(cleanText + '\n');
      } else {
        // Partial text - write without newline to maintain flow
        process.stdout.write(cleanText + ' ');
      }
    }
  }

  // Tool usage tracking (debug level - only shown in debug mode)
  toolUse(agent: string, tool: string, input?: any): void {
    // Show real-time status at all log levels
    this.showToolStatus(agent, tool, input);

    if (!this.shouldLog('debug')) return;

    const paramSummary = this.summarizeToolParams(tool, input);
    const message = `🔧 ${agent} → ${tool}${paramSummary}`;
    const prefix = this.getIndentPrefix();
    if (prefix) {
      console.log(chalk.gray('\n' + prefix + message));
    } else {
      console.log(chalk.gray('\n' + message));
    }
  }

  toolResult(agent: string, isError: boolean): void {
    if (!this.shouldLog('debug')) return;

    const icon = isError ? '❌' : '✅';
    const message = `${icon} ${agent} tool completed`;
    const prefix = this.getIndentPrefix();
    if (prefix) {
      console.log(chalk.gray(prefix + message));
    } else {
      console.log(chalk.gray(message));
    }
  }

  complete(agent: string, cost: number, duration: number): void {
    if (!this.shouldLog('debug')) return;

    console.log(chalk.dim(`\n💰 ${agent}: $${cost.toFixed(4)} | ${duration}ms`));
  }

  // Utility functions (info level - always shown in normal operation)
  info(s: string): void {
    if (this.shouldLog('info')) {
      const badge = this.currentPhase ? this.generatePhaseBadge() : '';
      const prefix = this.getIndentPrefix();
      const indentedMessage = this.applyIndentToMultiline(s);
      if (prefix) {
        console.log(prefix + badge + chalk.blue("ℹ️ Info:"), indentedMessage);
      } else {
        console.log(badge + chalk.blue("ℹ️ Info:"), indentedMessage);
      }
    }
  }

  warn(s: string): void {
    if (this.shouldLog('info')) {
      const badge = this.currentPhase ? this.generatePhaseBadge() : '';
      const prefix = this.getIndentPrefix();
      const indentedMessage = this.applyIndentToMultiline(s);
      if (prefix) {
        console.log(prefix + badge + chalk.yellowBright("⚠️ Warning:"), indentedMessage);
      } else {
        console.log(badge + chalk.yellowBright("⚠️ Warning:"), indentedMessage);
      }
    }
  }

  /**
   * Public method to explicitly insert a divider
   */
  logDivider(label?: string): void {
    if (this.shouldLog('info')) {
      console.log('\n' + this.renderDivider(label) + '\n');
    }
  }

  // Agent start with streaming setup (verbose level)
  startStreaming(agent: string): void {
    if (this.shouldLog('verbose')) {
      console.log(chalk.bold(`\n${this.getAgentIcon(agent)} ${agent}: `));
    }
  }

  /**
   * Get icon for a specific agent
   */
  private getAgentIcon(agent: string): string {
    switch (agent.toLowerCase()) {
      case 'planner': return '📝';
      case 'coder': return '🤖';
      case 'reviewer': return '👀';
      case 'bean counter': return '🧮';
      case 'super-reviewer': return '🔍';
      default: return '🤖';
    }
  }

  /**
   * Render a visual divider with optional centered label
   */
  private renderDivider(label?: string): string {
    const char = '═';

    if (!label) {
      // Simple divider without label
      return chalk.dim(char.repeat(this.DIVIDER_WIDTH));
    }

    // Divider with centered label
    const labelWithPadding = ` ${label} `;
    const labelLength = labelWithPadding.length;

    if (labelLength >= this.DIVIDER_WIDTH - 4) {
      // Label is too long, just show label
      return chalk.dim(`${char}${char} ${label} ${char}${char}`);
    }

    // Calculate padding for centering
    const totalPadding = this.DIVIDER_WIDTH - labelLength;
    const leftPadding = Math.floor(totalPadding / 2);
    const rightPadding = totalPadding - leftPadding;

    return chalk.dim(
      char.repeat(leftPadding) +
      chalk.bold(labelWithPadding) +
      char.repeat(rightPadding)
    );
  }

  /**
   * Determine the execution phase from agent type
   */
  private getPhaseFromAgent(agent: string): string {
    const agentLower = agent.toLowerCase();

    if (agentLower.includes('planner') || agentLower.includes('refiner')) {
      return 'PLANNING';
    } else if (agentLower.includes('bean') || agentLower.includes('counter')) {
      return 'CHUNKING';
    } else if (agentLower === 'coder') {
      return 'CODING';
    } else if (agentLower.includes('review')) {
      return 'REVIEW';
    } else if (agentLower.includes('orchestrator')) {
      return 'ORCHESTRATION';
    }

    return 'EXECUTION';
  }

  /**
   * Check for phase transition and insert divider if needed
   */
  private checkPhaseTransition(newPhase: string): void {
    if (this.currentPhase && this.currentPhase !== newPhase) {
      // Phase has changed, insert a divider
      if (this.shouldLog('info')) {
        console.log('\n' + this.renderDivider(newPhase) + '\n');
      }
    }
    this.currentPhase = newPhase;
  }

  /**
   * Generate a phase-specific status badge with optional counters
   */
  private generatePhaseBadge(phase?: string): string {
    // Use provided phase or current phase
    const phaseToUse = phase || this.currentPhase;
    if (!phaseToUse) return '';

    let badge = '';

    // Generate the main phase badge with appropriate coloring
    switch (phaseToUse) {
      case 'PLANNING':
        badge = chalk.cyan('[PLANNING]');
        break;
      case 'CURMUDGEONING':
        badge = chalk.red('[CURMUDGEONING]');
        break;
      case 'CHUNKING':
        badge = chalk.blue('[CHUNKING]');
        // Add chunk counter if available
        if (this.currentChunkNumber !== null) {
          badge += chalk.dim(` [CHUNK ${this.currentChunkNumber}]`);
        }
        break;
      case 'CODING':
        badge = chalk.magenta('[CODING]');
        // Add chunk counter if available during coding phase
        if (this.currentChunkNumber !== null) {
          badge += chalk.dim(` [CHUNK ${this.currentChunkNumber}]`);
        }
        break;
      case 'REVIEW':
        badge = chalk.yellow('[REVIEW]');
        // Add chunk counter if available during review
        if (this.currentChunkNumber !== null) {
          badge += chalk.dim(` [CHUNK ${this.currentChunkNumber}]`);
        }
        break;
      case 'ORCHESTRATION':
        badge = chalk.green('[ORCHESTRATION]');
        break;
      case 'COMPLETE':
        badge = chalk.greenBright('[COMPLETE]');
        break;
      default:
        badge = chalk.gray(`[${phaseToUse}]`);
    }

    // Add sprint counter if available (for any phase)
    if (this.currentSprintNumber !== null && phaseToUse !== 'PLANNING') {
      badge += chalk.dim(` [SPRINT ${this.currentSprintNumber}]`);
    }

    return badge + ' ';
  }

  /**
   * Parse Bean Counter messages to extract chunk/sprint information
   */
  private extractChunkInfo(message: string): void {
    // Look for patterns like "Chunk 3:", "Sprint 2:", "chunk #3", etc.
    const chunkMatch = message.match(/chunk\s*#?\s*(\d+)/i);
    if (chunkMatch) {
      this.currentChunkNumber = parseInt(chunkMatch[1], 10);
    }

    const sprintMatch = message.match(/sprint\s*#?\s*(\d+)/i);
    if (sprintMatch) {
      this.currentSprintNumber = parseInt(sprintMatch[1], 10);
    }

    // Check for completion indicators
    if (message.toLowerCase().includes('all chunks complete') ||
        message.toLowerCase().includes('task complete')) {
      this.currentPhase = 'COMPLETE';
    }
  }

  /**
   * Summarize tool parameters into concise, human-readable format
   */
  private summarizeToolParams(tool: string, params?: any): string {
    if (!params) return '';

    // Handle common tool types with smart formatting
    switch (tool.toLowerCase()) {
      case 'readfile':
      case 'read':
        return params.file_path ? `: ${params.file_path}` : '';

      case 'write':
      case 'edit':
      case 'multiedit':
        return params.file_path ? `: ${params.file_path}` : '';

      case 'grep':
        if (params.pattern) {
          const pattern = params.pattern.length > 30
            ? params.pattern.slice(0, 27) + '...'
            : params.pattern;
          const scope = params.glob || params.path || 'all files';
          return `: '${pattern}' in ${scope}`;
        }
        return '';

      case 'bash':
        if (params.command) {
          const command = params.command.length > 50
            ? params.command.slice(0, 47) + '...'
            : params.command;
          return `: ${command}`;
        }
        return '';

      case 'listdir':
      case 'ls':
        return params.path ? `: ${params.path}` : '';

      case 'todowrite':
        if (params.todos && Array.isArray(params.todos)) {
          return `: ${params.todos.length} todos`;
        }
        return '';

      default:
        // Fallback for unknown tools - truncate JSON at reasonable length
        try {
          const jsonStr = JSON.stringify(params);
          if (jsonStr.length > 50) {
            return ` (${jsonStr.slice(0, 47)}...)`;
          }
          return ` (${jsonStr})`;
        } catch {
          return ' (complex params)';
        }
    }
  }

  /**
   * Show persistent tool status that overwrites itself on each call
   * Creates a single updating status line using ANSI escape codes
   */
  showToolStatus(agent: string, tool: string, input?: any): void {
    // Clear any existing status line first
    process.stdout.write('\r\x1b[K');

    const paramSummary = this.summarizeToolParams(tool, input);
    const statusLine = `⚙️ [${agent}] → ${tool}${paramSummary}`;

    // Write status line and ensure it ends properly positioned
    process.stdout.write(statusLine);
  }

  /**
   * Clear the current tool status line and reset cursor position
   * Uses ANSI escape codes to clear the current line and return cursor to start
   *
   * Call this method when:
   * - A tool operation has completed
   * - Before outputting normal logging messages to ensure clean lines
   * - When switching between different types of output to prevent status line interference
   * - At the end of a task or when cleaning up the display
   */
  clearToolStatus(hasContent: boolean = true): void {
    // Only clear the tool status when hasContent is true
    if (hasContent) {
      // Use carriage return to move cursor to line start, then clear to end of line, then newline
      process.stdout.write('\r\x1b[K\n');
    }
  }
}

// Export singleton instance for backward compatibility
// All existing imports of { log } will continue to work
export const log = new LogUI();