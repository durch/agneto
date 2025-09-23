import chalk from "chalk";
export const log = {
  planner: (s: string) => console.log(chalk.cyan("📝 Planner:"), s),
  coder: (s: string) => console.log(chalk.magenta("🤖 Coder:"), s),
  review: (s: string) => console.log(chalk.yellow("👀 Reviewer:"), s),
  orchestrator: (s: string) =>
    console.log(chalk.green("🙋 Orchestrator:"), s),
  info: (s: string) => console.log(chalk.blue("ℹ️ Info:"), s),
  warn: (s: string) => console.log(chalk.yellowBright("⚠️ Warning:"), s),
};
