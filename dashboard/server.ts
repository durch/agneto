#!/usr/bin/env node

/**
 * Dashboard Server - Express HTTP Server with WebSocket Support
 *
 * Provides HTTP POST /events endpoint to receive events from DashboardEventEmitter
 * and WebSocket connections for real-time dashboard interface updates.
 *
 * AIDEV-NOTE: This server integrates with the existing DashboardEventEmitter
 * in src/dashboard/event-emitter.ts, accepting AuditEvent payloads via HTTP POST.
 */

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { AuditEvent } from '../src/audit/types.js';

// Server configuration
const PORT = 3000;
const MAX_EVENTS_PER_TASK = 1000;

// In-memory event storage: taskId -> AuditEvent[]
const eventStore = new Map<string, AuditEvent[]>();

// Initialize Express application
const app = express();

// Middleware setup
app.use(express.json({ limit: '10mb' }));
app.use(cors({
    origin: '*', // Allow all origins for development
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Static file serving for dashboard
app.use(express.static('dashboard/public'));

// Create HTTP server
const server = createServer(app);

// Create WebSocket server
const wss = new WebSocketServer({
    server,
    path: '/ws'
});

// Track connected WebSocket clients
const connectedClients = new Set<any>();

// WebSocket connection handling
wss.on('connection', (ws) => {
    console.log('Dashboard client connected');
    connectedClients.add(ws);

    // Send welcome message with current event counts
    const taskCounts = Array.from(eventStore.entries()).map(([taskId, events]) => ({
        taskId,
        eventCount: events.length
    }));

    ws.send(JSON.stringify({
        type: 'welcome',
        message: 'Connected to Agneto Dashboard',
        taskCounts
    }));

    // Handle client disconnection
    ws.on('close', () => {
        console.log('Dashboard client disconnected');
        connectedClients.delete(ws);
    });

    // Handle client errors
    ws.on('error', (error) => {
        console.warn('WebSocket client error:', error.message);
        connectedClients.delete(ws);
    });
});

/**
 * Broadcast event to all connected WebSocket clients
 */
function broadcastEvent(event: AuditEvent, taskId?: string) {
    if (connectedClients.size === 0) return;

    const message = JSON.stringify({
        type: 'new_event',
        event,
        taskId,
        timestamp: new Date().toISOString()
    });

    connectedClients.forEach((client) => {
        try {
            if (client.readyState === 1) { // WebSocket.OPEN
                client.send(message);
            }
        } catch (error) {
            console.warn('Failed to send message to WebSocket client:', error);
            connectedClients.delete(client);
        }
    });
}

/**
 * Prune events for a task if it exceeds the maximum limit
 */
function pruneTaskEvents(taskId: string) {
    const events = eventStore.get(taskId);
    if (!events || events.length <= MAX_EVENTS_PER_TASK) return;

    // Keep the most recent events
    const prunedEvents = events.slice(-MAX_EVENTS_PER_TASK);
    eventStore.set(taskId, prunedEvents);

    console.log(`Pruned events for task ${taskId}: ${events.length} -> ${prunedEvents.length}`);
}

/**
 * Validate AuditEvent structure
 */
function validateAuditEvent(event: any): event is AuditEvent {
    return event &&
           typeof event.id === 'string' &&
           typeof event.timestamp === 'string' &&
           typeof event.agent === 'string' &&
           typeof event.eventType === 'string' &&
           typeof event.message === 'string';
}

// POST /events endpoint - receives events from DashboardEventEmitter
app.post('/events', (req, res) => {
    try {
        const { taskId, ...eventData } = req.body;

        // Validate request structure
        if (!eventData || typeof eventData !== 'object') {
            return res.status(400).json({
                error: 'Invalid request body',
                details: 'Expected event data object'
            });
        }

        // Validate AuditEvent structure
        if (!validateAuditEvent(eventData)) {
            return res.status(400).json({
                error: 'Invalid event data',
                details: 'Missing required fields: id, timestamp, agent, eventType, message'
            });
        }

        const event = eventData as AuditEvent;
        const taskKey = taskId || 'default';

        // Store event in task-specific array
        if (!eventStore.has(taskKey)) {
            eventStore.set(taskKey, []);
        }

        const taskEvents = eventStore.get(taskKey)!;
        taskEvents.push(event);

        // Prune if necessary
        pruneTaskEvents(taskKey);

        // Broadcast to WebSocket clients
        broadcastEvent(event, taskId);

        // Log successful storage
        console.log(`Stored event ${event.id} for task ${taskKey} (${taskEvents.length} total events)`);

        // Return success response (DashboardEventEmitter uses fire-and-forget)
        res.status(200).json({
            success: true,
            eventId: event.id,
            taskId: taskKey,
            totalEvents: taskEvents.length
        });

    } catch (error) {
        console.error('Error processing event:', error);
        res.status(500).json({
            error: 'Internal server error',
            details: 'Failed to process event'
        });
    }
});

// GET /events/:taskId - retrieve events for a specific task
app.get('/events/:taskId', (req, res) => {
    try {
        const { taskId } = req.params;
        const { limit, offset } = req.query;

        const events = eventStore.get(taskId) || [];

        // Apply pagination if requested
        const startIndex = offset ? parseInt(offset as string, 10) : 0;
        const endIndex = limit ? startIndex + parseInt(limit as string, 10) : events.length;
        const paginatedEvents = events.slice(startIndex, endIndex);

        res.json({
            taskId,
            totalEvents: events.length,
            events: paginatedEvents,
            pagination: {
                offset: startIndex,
                limit: endIndex - startIndex,
                total: events.length
            }
        });

    } catch (error) {
        console.error('Error retrieving events:', error);
        res.status(500).json({
            error: 'Internal server error',
            details: 'Failed to retrieve events'
        });
    }
});

// GET /tasks - list all tasks with event counts
app.get('/tasks', (req, res) => {
    try {
        const tasks = Array.from(eventStore.entries()).map(([taskId, events]) => ({
            taskId,
            eventCount: events.length,
            lastEvent: events.length > 0 ? events[events.length - 1] : null
        }));

        res.json({
            totalTasks: tasks.length,
            tasks
        });

    } catch (error) {
        console.error('Error retrieving tasks:', error);
        res.status(500).json({
            error: 'Internal server error',
            details: 'Failed to retrieve tasks'
        });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        uptime: process.uptime(),
        totalTasks: eventStore.size,
        totalEvents: Array.from(eventStore.values()).reduce((sum, events) => sum + events.length, 0),
        connectedClients: connectedClients.size
    });
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\nReceived SIGINT, gracefully shutting down...');

    // Close WebSocket connections
    connectedClients.forEach((client) => {
        try {
            client.close();
        } catch (error) {
            // Ignore cleanup errors
        }
    });

    // Close server
    server.close(() => {
        console.log('Dashboard server stopped');
        process.exit(0);
    });
});

// Start the server
server.listen(PORT, () => {
    console.log(`🚀 Agneto Dashboard Server started successfully!`);
    console.log(`📡 HTTP Server: http://localhost:${PORT}`);
    console.log(`🔌 WebSocket Server: ws://localhost:${PORT}/ws`);
    console.log(`📊 Event endpoint: http://localhost:${PORT}/events`);
    console.log(`💾 Max events per task: ${MAX_EVENTS_PER_TASK}`);
    console.log('');
    console.log('Ready to receive events from DashboardEventEmitter...');
});