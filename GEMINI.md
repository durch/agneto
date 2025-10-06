# Project Overview

This project, named "Agneto", is an AI-powered development system that automates software development tasks. It uses a team of AI agents to handle the entire development lifecycle, from planning and coding to reviewing and testing. The system is designed to work with human oversight, allowing developers to approve plans and review changes before they are merged.

The project is a command-line tool built with Node.js and TypeScript. It uses the `commander` library for command-line parsing, `simple-git` for Git operations, and `ink` and `react` for the user interface. The AI agents are powered by a large language model, likely Anthropic's Claude, as indicated by the presence of a `CLAUDE.md` file and references to the Claude CLI in the `README.md`.

The core of the system is an orchestrator that manages a team of AI agents with specialized roles:

*   **Planner:** Creates a high-level implementation plan.
*   **Curmudgeon:** Reviews the plan for over-engineering and simplifies it.
*   **Bean Counter:** Breaks down the work into small, manageable chunks.
*   **Coder:** Implements each chunk.
*   **Reviewer:** Validates each implementation.
*   **SuperReviewer:** Performs a final quality check.
*   **Scribe:** Generates commit messages.
*   **Summarizer:** Summarizes the output of the Coder and Reviewer agents.
*   **Gardener:** Updates the documentation.

The system uses a state machine to manage the development process, which ensures that each step is completed in the correct order. All work is done in isolated Git worktrees to avoid interfering with the main branch.

# Building and Running

## Prerequisites

*   Node.js >= 18.0.0
*   Git
*   Claude CLI

## Installation

The project can be run without installation using `npx`:

```bash
npx agneto "describe your task"
```

Alternatively, it can be installed globally:

```bash
npm install -g agneto
agneto "your task description"
```

## Building

To build the project from source, run the following command:

```bash
npm run build
```

This will compile the TypeScript code and copy the prompt files to the `dist` directory.

## Running

To run the project from source, use the `start` script:

```bash
npm start -- "your task description"
```

## Testing

The project uses `vitest` for testing. To run the tests, use the following command:

```bash
npm test
```

# Development Conventions

The project follows standard TypeScript and Node.js development conventions. The code is well-structured and organized into modules. The use of a state machine to manage the development process is a key architectural pattern.

The project also has a strong emphasis on testing, with a dedicated `test` directory and a comprehensive test suite. The use of `vitest` for testing allows for fast and efficient test execution.

The project uses a custom, source-available license that permits personal, educational, and research use, but prohibits commercial use without a separate license. Contributions are not being accepted at this time.
