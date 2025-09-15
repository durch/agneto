#!/usr/bin/env tsx

import anthropic from "./src/providers/anthropic.js";

async function testProvider() {
    console.log("Testing Claude CLI Provider\n");
    console.log("=============================");

    // Test 1: Simple user message only
    console.log("\nTest 1: Simple user message");
    const result1 = await anthropic.query({
        cwd: process.cwd(),
        messages: [
            { role: "user", content: "Just respond with 'OK' to test the connection" }
        ],
        mode: "plan"
    });
    console.log("Result 1:", JSON.stringify(result1));
    console.log("Length:", result1.length);

    // Test 2: With system message
    console.log("\n\nTest 2: System + user message");
    const result2 = await anthropic.query({
        cwd: process.cwd(),
        messages: [
            { role: "system", content: "You are a helpful assistant." },
            { role: "user", content: "Just respond with 'OK' to test the connection" }
        ],
        mode: "plan"
    });
    console.log("Result 2:", JSON.stringify(result2));
    console.log("Length:", result2.length);

    // Test 3: Complex planner prompt
    console.log("\n\nTest 3: Planner-style prompt");
    const result3 = await anthropic.query({
        cwd: process.cwd(),
        messages: [
            {
                role: "system",
                content: "You are the Planner. Create a simple plan with one step."
            },
            {
                role: "user",
                content: "Task: Add a hello world function\n\nProduce ONLY the Markdown plan."
            }
        ],
        mode: "plan"
    });
    console.log("Result 3:", JSON.stringify(result3));
    console.log("Length:", result3.length);

    // Test 4: With allowed tools
    console.log("\n\nTest 4: With allowed tools");
    const result4 = await anthropic.query({
        cwd: process.cwd(),
        messages: [
            { role: "user", content: "Just respond with 'OK' to test the connection" }
        ],
        mode: "default",
        allowedTools: ["ReadFile", "ListDir"]
    });
    console.log("Result 4:", JSON.stringify(result4));
    console.log("Length:", result4.length);
}

// Run with: DEBUG=true tsx test-provider.ts
testProvider().catch(console.error);