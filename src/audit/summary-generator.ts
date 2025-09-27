import * as fs from 'fs';
import * as path from 'path';
import { AuditEvent, TaskAuditMetadata } from './types';

/**
 * Summary metrics aggregated from audit events
 */
interface SummaryMetrics {
  totalCost: number;
  totalDuration: number;
  totalEvents: number;
  agentCounts: Record<string, number>;
  toolUsage: Record<string, number>;
  phaseBreakdown: Record<string, number>;
  chunkCount: number;
  sprintCount: number;
  humanInterventions: number;
  completionEvents: number;
}

/**
 * Grouped events for timeline analysis
 */
interface EventGroup {
  phase?: string;
  chunkNumber?: number;
  sprintNumber?: number;
  events: AuditEvent[];
  startTime: string;
  endTime: string;
  duration: number;
  cost: number;
}

/**
 * SummaryGenerator class for creating comprehensive task execution summaries
 *
 * AIDEV-NOTE: This class analyzes captured audit events to generate human-readable
 * summaries showing task progression, agent decisions, costs, and human interventions
 */
export class SummaryGenerator {
  private auditDir: string;
  private eventsDir: string;
  private metadataFile: string;
  private summaryFile: string;

  constructor(taskId: string) {
    this.auditDir = path.join('.agneto', `task-${taskId}`);
    this.eventsDir = path.join(this.auditDir, 'events');
    this.metadataFile = path.join(this.auditDir, 'metadata.json');
    this.summaryFile = path.join(this.auditDir, 'summary.md');
  }

  /**
   * Generate comprehensive summary from captured audit events
   */
  generateSummary(): void {
    try {
      // Check if audit directory exists
      if (!fs.existsSync(this.auditDir)) {
        console.warn('⚠️ No audit directory found for summary generation');
        return;
      }

      // Load metadata and events
      const metadata = this.loadMetadata();
      const events = this.loadEvents();

      if (events.length === 0) {
        console.warn('⚠️ No audit events found for summary generation');
        return;
      }

      // Analyze events and generate summary
      const metrics = this.calculateMetrics(events);
      const timeline = this.createTimeline(events);
      const markdownContent = this.generateMarkdown(metadata, metrics, timeline, events);

      // Write summary to file
      fs.writeFileSync(this.summaryFile, markdownContent);
      console.log(`✅ Task summary generated: ${this.summaryFile}`);

    } catch (error) {
      console.warn(`⚠️ Summary generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Load task metadata from JSON file
   */
  private loadMetadata(): TaskAuditMetadata | null {
    try {
      if (fs.existsSync(this.metadataFile)) {
        const content = fs.readFileSync(this.metadataFile, 'utf8');
        return JSON.parse(content);
      }
    } catch (error) {
      console.warn('⚠️ Failed to load metadata for summary');
    }
    return null;
  }

  /**
   * Load all audit events from the events directory
   */
  private loadEvents(): AuditEvent[] {
    const events: AuditEvent[] = [];

    try {
      if (!fs.existsSync(this.eventsDir)) {
        return events;
      }

      const eventFiles = fs.readdirSync(this.eventsDir)
        .filter(file => file.endsWith('.json'))
        .sort(); // Sort by filename (timestamp-based)

      for (const file of eventFiles) {
        try {
          const eventPath = path.join(this.eventsDir, file);
          const content = fs.readFileSync(eventPath, 'utf8');
          const event = JSON.parse(content);
          events.push(event);
        } catch (error) {
          console.warn(`⚠️ Failed to parse event file: ${file}`);
        }
      }

    } catch (error) {
      console.warn('⚠️ Failed to load audit events');
    }

    return events;
  }

  /**
   * Calculate aggregated metrics from events
   */
  private calculateMetrics(events: AuditEvent[]): SummaryMetrics {
    const metrics: SummaryMetrics = {
      totalCost: 0,
      totalDuration: 0,
      totalEvents: events.length,
      agentCounts: {},
      toolUsage: {},
      phaseBreakdown: {},
      chunkCount: 0,
      sprintCount: 0,
      humanInterventions: 0,
      completionEvents: 0
    };

    const chunks = new Set<number>();
    const sprints = new Set<number>();

    for (const event of events) {
      // Count by agent
      metrics.agentCounts[event.agent] = (metrics.agentCounts[event.agent] || 0) + 1;

      // Count by phase
      if (event.phase) {
        metrics.phaseBreakdown[event.phase] = (metrics.phaseBreakdown[event.phase] || 0) + 1;
      }

      // Track tool usage
      if (event.toolInfo?.tool) {
        metrics.toolUsage[event.toolInfo.tool] = (metrics.toolUsage[event.toolInfo.tool] || 0) + 1;
      }

      // Aggregate costs and durations
      if (event.metrics) {
        metrics.totalCost += event.metrics.cost || 0;
        metrics.totalDuration += event.metrics.duration || 0;
      }

      // Track completion events
      if (event.eventType === 'completion') {
        metrics.completionEvents++;
      }

      // Track human interventions (messages containing "human" or "needs-human")
      if (event.message.toLowerCase().includes('human') ||
          event.message.toLowerCase().includes('needs-human')) {
        metrics.humanInterventions++;
      }

      // Track unique chunks and sprints
      if (event.chunkNumber !== undefined) {
        chunks.add(event.chunkNumber);
      }
      if (event.sprintNumber !== undefined) {
        sprints.add(event.sprintNumber);
      }
    }

    metrics.chunkCount = chunks.size;
    metrics.sprintCount = sprints.size;

    return metrics;
  }

  /**
   * Create timeline of events grouped by phases and chunks
   */
  private createTimeline(events: AuditEvent[]): EventGroup[] {
    const groups: Map<string, EventGroup> = new Map();

    for (const event of events) {
      // Create grouping key based on phase and chunk
      const groupKey = `${event.phase || 'unknown'}-${event.chunkNumber || 0}-${event.sprintNumber || 0}`;

      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          phase: event.phase,
          chunkNumber: event.chunkNumber,
          sprintNumber: event.sprintNumber,
          events: [],
          startTime: event.timestamp,
          endTime: event.timestamp,
          duration: 0,
          cost: 0
        });
      }

      const group = groups.get(groupKey)!;
      group.events.push(event);

      // Update time bounds
      if (event.timestamp < group.startTime) {
        group.startTime = event.timestamp;
      }
      if (event.timestamp > group.endTime) {
        group.endTime = event.timestamp;
      }

      // Aggregate costs
      if (event.metrics?.cost) {
        group.cost += event.metrics.cost;
      }
    }

    // Calculate durations and sort by start time
    const timeline = Array.from(groups.values());
    for (const group of timeline) {
      const start = new Date(group.startTime);
      const end = new Date(group.endTime);
      group.duration = end.getTime() - start.getTime();
    }

    return timeline.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }

  /**
   * Generate markdown content for the summary
   */
  private generateMarkdown(
    metadata: TaskAuditMetadata | null,
    metrics: SummaryMetrics,
    timeline: EventGroup[],
    events: AuditEvent[]
  ): string {
    const taskId = metadata?.taskId || 'unknown';
    const description = metadata?.description || 'No description available';
    const startTime = metadata?.startTime || 'Unknown';
    const endTime = metadata?.endTime || 'Ongoing';
    const status = metadata?.status || 'unknown';

    // Calculate total task duration
    let totalDuration = 0;
    if (metadata?.startTime && metadata?.endTime) {
      totalDuration = new Date(metadata.endTime).getTime() - new Date(metadata.startTime).getTime();
    }

    const content = `# Task Audit Summary

**Task ID:** ${taskId}
**Description:** ${description}
**Started:** ${new Date(startTime).toLocaleString()}
**${status === 'completed' ? 'Completed' : status === 'failed' ? 'Failed' : 'Status'}:** ${status === 'completed' ? new Date(endTime).toLocaleString() : status}
**Total Duration:** ${this.formatDuration(totalDuration)}

## 📊 Executive Summary

- **Total Events:** ${metrics.totalEvents}
- **Agent Interactions:** ${Object.values(metrics.agentCounts).reduce((a, b) => a + b, 0)}
- **Tool Uses:** ${Object.values(metrics.toolUsage).reduce((a, b) => a + b, 0)}
- **Chunks Executed:** ${metrics.chunkCount}
- **Human Interventions:** ${metrics.humanInterventions}
- **Total Cost:** $${metrics.totalCost.toFixed(4)}
- **Completion Events:** ${metrics.completionEvents}

## 🤖 Agent Activity Breakdown

${Object.entries(metrics.agentCounts)
  .sort(([,a], [,b]) => b - a)
  .map(([agent, count]) => `- **${agent}:** ${count} events`)
  .join('\n')}

## 🛠️ Tool Usage Analysis

${Object.keys(metrics.toolUsage).length > 0
  ? Object.entries(metrics.toolUsage)
      .sort(([,a], [,b]) => b - a)
      .map(([tool, count]) => `- **${tool}:** ${count} uses`)
      .join('\n')
  : 'No tool usage recorded'
}

## 📈 Phase Breakdown

${Object.entries(metrics.phaseBreakdown)
  .sort(([,a], [,b]) => b - a)
  .map(([phase, count]) => `- **${phase}:** ${count} events`)
  .join('\n')}

## ⏱️ Task Timeline

${timeline.map(group => this.formatTimelineGroup(group)).join('\n\n')}

## 💰 Cost Analysis

**Total Cost:** $${metrics.totalCost.toFixed(4)}

${this.generateCostBreakdown(events)}

## 🙋 Human Interventions

${metrics.humanInterventions > 0
  ? this.formatHumanInterventions(events)
  : 'No human interventions detected'
}

## 📋 Event Details

<details>
<summary>Click to expand full event log (${metrics.totalEvents} events)</summary>

${events.map(event => this.formatEventDetail(event)).join('\n\n')}

</details>

---
*Summary generated on ${new Date().toLocaleString()}*
`;

    return content;
  }

  /**
   * Format a timeline group for markdown
   */
  private formatTimelineGroup(group: EventGroup): string {
    const startTime = new Date(group.startTime).toLocaleTimeString();
    const phaseInfo = group.phase ? `**${group.phase}**` : 'Unknown Phase';
    const chunkInfo = group.chunkNumber !== undefined ? ` - Chunk ${group.chunkNumber}` : '';
    const sprintInfo = group.sprintNumber !== undefined ? ` (Sprint ${group.sprintNumber})` : '';
    const cost = group.cost > 0 ? ` - Cost: $${group.cost.toFixed(4)}` : '';

    const eventSummary = group.events
      .map(e => `  - ${e.agent}: ${e.message}`)
      .join('\n');

    return `### ${startTime} - ${phaseInfo}${chunkInfo}${sprintInfo}${cost}

${eventSummary}`;
  }

  /**
   * Generate cost breakdown by agent
   */
  private generateCostBreakdown(events: AuditEvent[]): string {
    const costByAgent: Record<string, number> = {};

    for (const event of events) {
      if (event.metrics?.cost) {
        costByAgent[event.agent] = (costByAgent[event.agent] || 0) + event.metrics.cost;
      }
    }

    if (Object.keys(costByAgent).length === 0) {
      return 'No cost data available';
    }

    return Object.entries(costByAgent)
      .sort(([,a], [,b]) => b - a)
      .map(([agent, cost]) => `- **${agent}:** $${cost.toFixed(4)}`)
      .join('\n');
  }

  /**
   * Format human intervention events
   */
  private formatHumanInterventions(events: AuditEvent[]): string {
    const interventions = events.filter(event =>
      event.message.toLowerCase().includes('human') ||
      event.message.toLowerCase().includes('needs-human')
    );

    return interventions
      .map(event => `- **${new Date(event.timestamp).toLocaleTimeString()}** (${event.agent}): ${event.message}`)
      .join('\n');
  }

  /**
   * Format individual event details
   */
  private formatEventDetail(event: AuditEvent): string {
    const timestamp = new Date(event.timestamp).toLocaleTimeString();
    const phase = event.phase ? ` [${event.phase}]` : '';
    const chunk = event.chunkNumber !== undefined ? ` C${event.chunkNumber}` : '';
    const sprint = event.sprintNumber !== undefined ? ` S${event.sprintNumber}` : '';
    const cost = event.metrics?.cost ? ` ($${event.metrics.cost.toFixed(4)})` : '';
    const tool = event.toolInfo?.tool ? ` | Tool: ${event.toolInfo.tool}` : '';

    return `**${timestamp}**${phase}${chunk}${sprint} - **${event.agent}** (${event.eventType})${cost}${tool}
${event.message}`;
  }

  /**
   * Format duration in human-readable format
   */
  private formatDuration(milliseconds: number): string {
    if (milliseconds === 0) return 'N/A';

    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
}