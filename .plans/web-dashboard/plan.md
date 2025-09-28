# Create Web Dashboard Interface for Agneto Task Monitoring

## Context
Based on my analysis of the existing infrastructure, I have comprehensive understanding of the audit system, event flow, and server foundation. The task is to complete the frontend web interface that leverages the robust backend already in place.

## Acceptance Criteria
- Single HTML file at `dashboard/public/index.html` with inline CSS/JavaScript
- Real-time event stream via WebSocket connection to `/ws` endpoint
- Task list showing all active/completed tasks with status indicators  
- Phase progress visualization for TaskState enums: TASK_INIT, TASK_REFINING, TASK_PLANNING, TASK_CURMUDGEONING, TASK_EXECUTING, TASK_SUPER_REVIEWING, TASK_FINALIZING, TASK_COMPLETE
- Bean Counter chunk/sprint counters extracted from event metadata
- Task filtering and search functionality for multiple concurrent tasks
- Mobile-responsive design optimized for iPhone viewing
- Integration with existing REST API endpoints (`/events/:taskId`, `/tasks`, `/health`)
- NPM script addition to package.json for `npm run dashboard`

## Steps

1. **Create the main dashboard HTML interface**
   - **Intent**: Build single-page web interface with real-time monitoring capabilities
   - **Files**: `dashboard/public/index.html`
   - **Verify**: File exists and contains complete HTML structure with embedded CSS/JS

2. **Implement WebSocket event streaming**
   - **Intent**: Connect to existing `/ws` endpoint for real-time event updates
   - **Files**: `dashboard/public/index.html` (WebSocket JavaScript section)
   - **Verify**: WebSocket connection established and receives events in browser console

3. **Add task phase progress visualization**
   - **Intent**: Display TaskState progression using discovered enums from task-state-machine.ts
   - **Files**: `dashboard/public/index.html` (CSS and JavaScript for phase indicators)
   - **Verify**: Phase indicators show current state and progression through 8 TaskState phases

4. **Implement task list and filtering**
   - **Intent**: Display task overview with search/filter capabilities
   - **Files**: `dashboard/public/index.html` (task list JavaScript and UI components)
   - **Verify**: Tasks display with filtering and search working locally

5. **Add mobile-responsive design**
   - **Intent**: Optimize layout for iPhone screens with responsive CSS
   - **Files**: `dashboard/public/index.html` (responsive CSS media queries)
   - **Verify**: Interface adapts properly to mobile viewport using browser dev tools

6. **Integrate REST API endpoints**
   - **Intent**: Connect to existing `/events/:taskId`, `/tasks`, `/health` endpoints
   - **Files**: `dashboard/public/index.html` (API integration JavaScript)
   - **Verify**: API calls return expected data structure from existing server

7. **Add npm dashboard script**
   - **Intent**: Enable `npm run dashboard` to start server easily
   - **Files**: `package.json` 
   - **Verify**: `npm run dashboard` command starts server successfully on port 3000

8. **Test complete integration**
   - **Intent**: Verify end-to-end functionality with real audit events
   - **Files**: Test with actual Agneto task execution
   - **Verify**: Dashboard receives and displays real events from audit system, phase transitions work correctly

## Risks & Rollbacks

**Risks:**
- WebSocket connection issues if server implementation changes
- Mobile responsive design may need iteration for optimal iPhone experience  
- Phase detection relies on consistent event structure from audit system

**Rollbacks:**
- Remove `dashboard/public/index.html` if interface is non-functional
- Revert package.json changes if script conflicts exist
- Fall back to server-only mode if WebSocket integration fails

**Confidence Level:** I'm confident this approach will work well. The existing backend infrastructure is comprehensive and well-designed. The main technical challenge is ensuring the frontend correctly interprets the TaskState enums and event structure, which I've researched thoroughly in the codebase.

---
_Plan created after 1 iteration(s) with human feedback_
