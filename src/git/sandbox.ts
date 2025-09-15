import { execSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export function applyProposal(cwd: string, proposal: string) {
    // Expect "FILE: <path>\n---8<---\n<patch>\n---8<---"
    const m = proposal.match(/FILE:\s*(.+)\n---8<---\n([\s\S]*?)\n---8<---/);
    if (!m) throw new Error("Malformed proposal");
    const file = m[1].trim(), patch = m[2];

    // For v0: create file if missing and write contents when it's an additive stub.
    // In real life you'd use 'git apply -p0 -' with a real unified diff.
    mkdirSync(dirname(`${cwd}/${file}`), { recursive: true });
    writeFileSync(`${cwd}/${file}`, patch.includes("\n") ? patch : `${patch}\n`, { flag: "a" });

    execSync(`git -C "${cwd}" add -A && git -C "${cwd}" commit -m "agent: apply proposal for ${file}"`, { stdio: "inherit" });
}

export function revertLast(cwd: string) {
    execSync(`git -C "${cwd}" revert --no-edit HEAD`, { stdio: "inherit" });
}
