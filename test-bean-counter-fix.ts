#!/usr/bin/env npx tsx

/**
 * Test script to verify Bean Counter interpreter fixes false positive bug
 *
 * This tests that responses containing "complete" in partial words like
 * "completion" don't trigger task completion detection.
 */

import { interpretBeanCounterResponse } from "./src/protocol/interpreter.js";
import anthropic from "./src/providers/anthropic.js";

// Test cases that should NOT trigger completion
const falsePositiveTests = [
  "Next chunk: Hook writeEvent() into logging flow for completion tracking",
  "The completion of this feature requires adding error handling",
  "Complete timeline data will be captured in audit.json",
  "Task completion involves multiple steps. Next chunk: Add validation",
  "Implementing complete solution for authentication module",
  "Next chunk: Create comprehensive testing suite"
];

// Test cases that SHOULD trigger completion
const truePositiveTests = [
  "Task complete. All planned features have been implemented.",
  "All work done. The implementation is finished.",
  "Implementation finished. No more chunks needed.",
  "Task is complete and ready for review.",
  "TASK COMPLETE: Successfully implemented all requirements"
];

async function runTests() {
  console.log("🧪 Testing Bean Counter Interpreter Fix\n");
  console.log("=" .repeat(50));

  const provider = anthropic;
  const cwd = process.cwd();

  let passed = 0;
  let failed = 0;

  console.log("\n📋 Testing FALSE POSITIVES (should be WORK_CHUNK):");
  console.log("-".repeat(50));

  for (const testCase of falsePositiveTests) {
    try {
      const result = await interpretBeanCounterResponse(provider, testCase, cwd);
      const isCorrect = result?.type === "WORK_CHUNK";

      if (isCorrect) {
        console.log(`✅ PASS: "${testCase.substring(0, 50)}..."`);
        passed++;
      } else {
        console.log(`❌ FAIL: "${testCase.substring(0, 50)}..." -> Got: ${result?.type}`);
        failed++;
      }
    } catch (error) {
      console.log(`❌ ERROR: "${testCase.substring(0, 50)}..." -> ${error}`);
      failed++;
    }
  }

  console.log("\n🏁 Testing TRUE POSITIVES (should be TASK_COMPLETE):");
  console.log("-".repeat(50));

  for (const testCase of truePositiveTests) {
    try {
      const result = await interpretBeanCounterResponse(provider, testCase, cwd);
      const isCorrect = result?.type === "TASK_COMPLETE";

      if (isCorrect) {
        console.log(`✅ PASS: "${testCase.substring(0, 50)}..."`);
        passed++;
      } else {
        console.log(`❌ FAIL: "${testCase.substring(0, 50)}..." -> Got: ${result?.type}`);
        failed++;
      }
    } catch (error) {
      console.log(`❌ ERROR: "${testCase.substring(0, 50)}..." -> ${error}`);
      failed++;
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log(`📊 Results: ${passed} passed, ${failed} failed`);
  console.log("=".repeat(50));

  if (failed === 0) {
    console.log("\n🎉 All tests passed! The Bean Counter interpreter fix is working correctly.");
  } else {
    console.log("\n⚠️ Some tests failed. The interpreter may need adjustment.");
  }

  process.exit(failed === 0 ? 0 : 1);
}

// Run the tests
runTests().catch(console.error);