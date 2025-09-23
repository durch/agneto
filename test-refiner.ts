#!/usr/bin/env npx tsx
/**
 * Test script for the Task Refiner agent
 * Verifies that the refiner can analyze and structure a vague task description
 */

import { RefinerAgent } from "./src/agents/refiner.js";
import { selectProvider } from "./src/providers/index.js";
import { log } from "./src/ui/log.js";

async function testRefiner() {
    log.info("Testing Task Refiner agent...\n");

    // Test with a deliberately vague task
    const vagueTasks = [
        "fix the bug",
        "make it faster",
        "add user authentication"
    ];

    const provider = await selectProvider();
    const refiner = new RefinerAgent(provider);
    const cwd = process.cwd();

    for (const task of vagueTasks) {
        log.info(`\nTesting with vague task: "${task}"`);
        log.info("-".repeat(50));

        try {
            const refined = await refiner.refine(cwd, task, "test-refiner");
            
            console.log("\n📎 Goal:", refined.goal);
            console.log("📝 Context:", refined.context);
            console.log("⚠️ Constraints:", refined.constraints);
            console.log("✅ Success Criteria:", refined.successCriteria);
            
            // Verify the refiner produced structured output
            if (refined.goal && refined.goal.length > 0) {
                log.human("✅ Refiner successfully structured the task");
            } else {
                log.warn("⚠️ Refiner did not produce a goal");
            }
        } catch (error) {
            log.warn(`❌ Error refining task: ${error}`);
        }
    }

    log.info("\n✨ Task Refiner test complete!");
}

// Run the test
testRefiner().catch(console.error);