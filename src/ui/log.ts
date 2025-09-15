import chalk from "chalk";
export const log = {
    planner: (s: string) => console.log(chalk.cyan("📝 Planner:"), s),
    coder:   (s: string) => console.log(chalk.magenta("🤖 Coder:  "), s),
    review:  (s: string) => console.log(chalk.yellow("👀 Reviewer:"), s),
    human:   (s: string) => console.log(chalk.green("🙋 Human:  "), s),
};
