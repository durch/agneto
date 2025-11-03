import { execSync } from "node:child_process";

export function setTmuxPaneTitle(title: string): void {
    // Only run if inside a tmux session
    if (!process.env.TMUX) {
        return;
    }

    // Escape double quotes to prevent command injection
    const escapedTitle = title.replace(/"/g, '\\"');

    // Set the pane title, silently ignoring any errors
    try {
        execSync(`tmux select-pane -T "${escapedTitle}"`, { stdio: "ignore" });
    } catch {
        // Silently fail if tmux command errors
    }
}
