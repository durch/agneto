import * as fs from 'fs';
import * as path from 'path';
import { AuditEvent, TaskAuditMetadata } from './types';

/**
 * Comprehensive audit data structure for machine-readable export
 * Optimized for analytics queries and debugging workflows
 */
export interface AuditExport {
  /** Task metadata and summary statistics */
  metadata: {
    taskId: string;
    description: string;
    startTime: string;
    endTime?: string;
    duration?: number; // milliseconds
    status: 'active' | 'completed' | 'failed';
    auditVersion: string;
    exportTime: string;
  };

  /** Execution statistics and aggregations */
  analytics: {
    /** Total events captured */
    totalEvents: number;

    /** Agent performance breakdown */
    agentStats: {
      [agent: string]: {
        messageCount: number;
        toolUsageCount: number;
        completionCount: number;
        totalCost: number;
        totalDuration: number;
        avgCostPerCompletion: number;
        avgDurationPerCompletion: number;
      };
    };

    /** Phase and chunk progression tracking */
    execution: {
      phases: string[];
      totalChunks: number;
      totalSprints: number;
      chunkProgression: Array<{
        chunkNumber: number;
        sprintNumber?: number;
        startTime: string;
        endTime?: string;
        duration?: number;
        agentInvolved: string[];
        eventCount: number;
      }>;
    };

    /** Tool usage patterns */
    toolUsage: {
      [tool: string]: {
        count: number;
        successRate: number;
        agents: string[];
      };
    };

    /** Cost and performance metrics */
    performance: {
      totalCost: number;
      totalDuration: number;
      costByAgent: { [agent: string]: number };
      durationByAgent: { [agent: string]: number };
      costPerEvent: number;
      costPerChunk: number;
    };

    /** Human intervention tracking */
    humanInteraction: {
      interventionCount: number;
      interventionPoints: Array<{
        timestamp: string;
        agent: string;
        context: string;
        chunkNumber?: number;
      }>;
    };
  };

  /** Complete chronological event timeline */
  events: AuditEvent[];

  /** Session tracking for context correlation */
  sessions: {
    [agent: string]: {
      startTime: string;
      endTime?: string;
      eventCount: number;
      firstEventId: string;
      lastEventId?: string;
    };
  };
}

/**
 * JSONExporter class for generating machine-readable audit exports
 *
 * AIDEV-NOTE: This creates structured data optimized for:
 * - Performance analytics and cost optimization
 * - Debugging execution patterns and bottlenecks
 * - Team coordination and workflow analysis
 * - Programmatic querying and reporting
 */
export class JSONExporter {
  private taskId: string;
  private auditDir: string;
  private eventsDir: string;
  private metadataFile: string;

  constructor(taskId: string) {
    this.taskId = taskId;
    this.auditDir = path.join('.agneto', `task-${taskId}`);
    this.eventsDir = path.join(this.auditDir, 'events');
    this.metadataFile = path.join(this.auditDir, 'metadata.json');
  }

  /**
   * Generate comprehensive machine-readable audit export
   */
  generateAuditJSON(): void {
    try {
      // Verify audit directory exists
      if (!fs.existsSync(this.auditDir)) {
        console.warn(`⚠️ Audit directory not found: ${this.auditDir}`);
        return;
      }

      // Load metadata
      const metadata = this.loadMetadata();
      if (!metadata) {
        console.warn(`⚠️ Could not load audit metadata for task ${this.taskId}`);
        return;
      }

      // Load and sort all events chronologically
      const events = this.loadAllEvents();

      // Generate comprehensive analytics
      const analytics = this.generateAnalytics(events, metadata);

      // Track session information
      const sessions = this.generateSessionTracking(events);

      // Create final export structure
      const auditExport: AuditExport = {
        metadata: {
          taskId: metadata.taskId,
          description: metadata.description,
          startTime: metadata.startTime,
          endTime: metadata.endTime,
          duration: metadata.endTime ?
            new Date(metadata.endTime).getTime() - new Date(metadata.startTime).getTime() :
            undefined,
          status: metadata.status,
          auditVersion: metadata.auditVersion,
          exportTime: new Date().toISOString()
        },
        analytics,
        events,
        sessions
      };

      // Write audit.json to task directory
      const auditFile = path.join(this.auditDir, 'audit.json');
      fs.writeFileSync(auditFile, JSON.stringify(auditExport, null, 2));

      console.log(`📊 Generated machine-readable audit: ${auditFile}`);
    } catch (error) {
      console.warn(`⚠️ JSON audit export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Load task metadata from metadata.json
   */
  private loadMetadata(): TaskAuditMetadata | null {
    try {
      if (!fs.existsSync(this.metadataFile)) {
        return null;
      }

      const metadataContent = fs.readFileSync(this.metadataFile, 'utf8');
      return JSON.parse(metadataContent) as TaskAuditMetadata;
    } catch (error) {
      console.warn(`⚠️ Failed to load metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }

  /**
   * Load all event files and return sorted chronologically
   */
  private loadAllEvents(): AuditEvent[] {
    try {
      if (!fs.existsSync(this.eventsDir)) {
        return [];
      }

      const eventFiles = fs.readdirSync(this.eventsDir)
        .filter(file => file.endsWith('.json'))
        .sort(); // Files are timestamped, so sorting gives chronological order

      const events: AuditEvent[] = [];

      for (const file of eventFiles) {
        try {
          const eventPath = path.join(this.eventsDir, file);
          const eventContent = fs.readFileSync(eventPath, 'utf8');
          const event = JSON.parse(eventContent) as AuditEvent;
          events.push(event);
        } catch (error) {
          console.warn(`⚠️ Failed to load event file ${file}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Sort by timestamp to ensure chronological order
      return events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    } catch (error) {
      console.warn(`⚠️ Failed to load events: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return [];
    }
  }

  /**
   * Generate comprehensive analytics from event data
   */
  private generateAnalytics(events: AuditEvent[], metadata: TaskAuditMetadata): AuditExport['analytics'] {
    const agentStats: { [agent: string]: any } = {};
    const toolUsage: { [tool: string]: any } = {};
    const phases = new Set<string>();
    const chunks = new Map<number, any>();
    let totalCost = 0;
    let totalDuration = 0;
    const interventions: any[] = [];

    // Process each event for analytics
    for (const event of events) {
      const agent = event.agent;

      // Initialize agent stats
      if (!agentStats[agent]) {
        agentStats[agent] = {
          messageCount: 0,
          toolUsageCount: 0,
          completionCount: 0,
          totalCost: 0,
          totalDuration: 0,
          avgCostPerCompletion: 0,
          avgDurationPerCompletion: 0
        };
      }

      // Track phases
      if (event.phase) {
        phases.add(event.phase);
      }

      // Process by event type
      switch (event.eventType) {
        case 'message':
          agentStats[agent].messageCount++;

          // Detect human interventions
          if (event.message.includes('needs-human') ||
              event.message.includes('human review') ||
              event.message.includes('requires human')) {
            interventions.push({
              timestamp: event.timestamp,
              agent: event.agent,
              context: event.message,
              chunkNumber: event.chunkNumber
            });
          }
          break;

        case 'tool_use':
          agentStats[agent].toolUsageCount++;

          if (event.toolInfo?.tool) {
            const tool = event.toolInfo.tool;
            if (!toolUsage[tool]) {
              toolUsage[tool] = { count: 0, successRate: 0, agents: new Set() };
            }
            toolUsage[tool].count++;
            toolUsage[tool].agents.add(agent);
          }
          break;

        case 'completion':
          agentStats[agent].completionCount++;

          if (event.metrics) {
            const cost = event.metrics.cost || 0;
            const duration = event.metrics.duration || 0;

            agentStats[agent].totalCost += cost;
            agentStats[agent].totalDuration += duration;
            totalCost += cost;
            totalDuration += duration;
          }
          break;
      }

      // Track chunk progression
      if (event.chunkNumber !== undefined) {
        if (!chunks.has(event.chunkNumber)) {
          chunks.set(event.chunkNumber, {
            chunkNumber: event.chunkNumber,
            sprintNumber: event.sprintNumber,
            startTime: event.timestamp,
            agentInvolved: new Set(),
            eventCount: 0
          });
        }

        const chunk = chunks.get(event.chunkNumber)!;
        chunk.agentInvolved.add(event.agent);
        chunk.eventCount++;
        chunk.endTime = event.timestamp;
      }
    }

    // Calculate averages for agent stats
    for (const agent in agentStats) {
      const stats = agentStats[agent];
      if (stats.completionCount > 0) {
        stats.avgCostPerCompletion = stats.totalCost / stats.completionCount;
        stats.avgDurationPerCompletion = stats.totalDuration / stats.completionCount;
      }
    }

    // Convert chunk Map to Array and calculate durations
    const chunkProgression = Array.from(chunks.values()).map(chunk => ({
      ...chunk,
      agentInvolved: Array.from(chunk.agentInvolved),
      duration: chunk.endTime ?
        new Date(chunk.endTime).getTime() - new Date(chunk.startTime).getTime() :
        undefined
    }));

    // Convert tool usage Sets to Arrays
    const processedToolUsage: { [tool: string]: any } = {};
    for (const [tool, usage] of Object.entries(toolUsage)) {
      processedToolUsage[tool] = {
        ...usage,
        agents: Array.from(usage.agents),
        successRate: 1.0 // TODO: Calculate based on tool_result events
      };
    }

    // Calculate performance metrics
    const costByAgent: { [agent: string]: number } = {};
    const durationByAgent: { [agent: string]: number } = {};

    for (const [agent, stats] of Object.entries(agentStats)) {
      costByAgent[agent] = stats.totalCost;
      durationByAgent[agent] = stats.totalDuration;
    }

    return {
      totalEvents: events.length,
      agentStats,
      execution: {
        phases: Array.from(phases),
        totalChunks: chunks.size,
        totalSprints: Math.max(...Array.from(chunks.values()).map(c => c.sprintNumber || 0), 0),
        chunkProgression
      },
      toolUsage: processedToolUsage,
      performance: {
        totalCost,
        totalDuration,
        costByAgent,
        durationByAgent,
        costPerEvent: events.length > 0 ? totalCost / events.length : 0,
        costPerChunk: chunks.size > 0 ? totalCost / chunks.size : 0
      },
      humanInteraction: {
        interventionCount: interventions.length,
        interventionPoints: interventions
      }
    };
  }

  /**
   * Generate session tracking information
   */
  private generateSessionTracking(events: AuditEvent[]): AuditExport['sessions'] {
    const sessions: { [agent: string]: any } = {};

    for (const event of events) {
      const agent = event.agent;

      if (!sessions[agent]) {
        sessions[agent] = {
          startTime: event.timestamp,
          eventCount: 0,
          firstEventId: event.id
        };
      }

      sessions[agent].eventCount++;
      sessions[agent].endTime = event.timestamp;
      sessions[agent].lastEventId = event.id;
    }

    return sessions;
  }
}