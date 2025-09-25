import chalk from "chalk";

// Real-time streaming display functions
export const log = {
  // Agent start messages
  planner: (s: string) => console.log(chalk.cyan("📝 Planner:"), s),
  coder: (s: string) => console.log(chalk.magenta("🤖 Coder:"), s),
  review: (s: string) => console.log(chalk.yellow("👀 Reviewer:"), s),
  beanCounter: (s: string) => console.log(chalk.blue("🧮 Bean Counter:"), s),
  orchestrator: (s: string) => console.log(chalk.green("🙋 Orchestrator:"), s),

  // Real-time streaming functions
  streamProgress: (text: string) => {
    // Stream text as it arrives, no prefix to avoid cluttering
    process.stdout.write(text);
  },

  toolUse: (agent: string, tool: string, input?: any) => {
    const inputStr = input ? ` (${JSON.stringify(input).slice(0, 80)}${Object.keys(input).length > 0 ? '...' : ''})` : '';
    console.log(chalk.gray(`\n🔧 ${agent} → ${tool}${inputStr}`));
  },

  toolResult: (agent: string, isError: boolean) => {
    const icon = isError ? '❌' : '✅';
    console.log(chalk.gray(`${icon} ${agent} tool completed`));
  },

  complete: (agent: string, cost: number, duration: number) => {
    console.log(chalk.dim(`\n💰 ${agent}: $${cost.toFixed(4)} | ${duration}ms`));
  },

  // Utility functions
  info: (s: string) => console.log(chalk.blue("ℹ️ Info:"), s),
  warn: (s: string) => console.log(chalk.yellowBright("⚠️ Warning:"), s),

  // Agent start with streaming setup
  startStreaming: (agent: string) => {
    console.log(chalk.bold(`\n${getAgentIcon(agent)} ${agent}: `));
  }
};

function getAgentIcon(agent: string): string {
  switch (agent.toLowerCase()) {
    case 'planner': return '📝';
    case 'coder': return '🤖';
    case 'reviewer': return '👀';
    case 'bean counter': return '🧮';
    case 'super-reviewer': return '🔍';
    default: return '🤖';
  }
}
