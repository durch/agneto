import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';

/**
 * Ntfy Notification Service
 *
 * Provides simple push notifications via ntfy.sh or custom ntfy servers.
 * Implements fire-and-forget delivery with graceful failure handling.
 *
 * @example
 * ```typescript
 * import { sendNotification } from './utils/ntfy-notifier.js';
 *
 * // Send a simple notification
 * sendNotification('Task completed successfully');
 *
 * // Send notification with context
 * sendNotification('All tests passed', 'CI/CD');
 * ```
 */

/**
 * Configuration interface for ntfy notifications
 */
interface NtfyConfig {
    topic: string;
    server: string;
    enabled: boolean;
}

/**
 * Get and validate ntfy configuration from environment variables
 *
 * @returns Configuration object with validation status
 */
function getNtfyConfig(): NtfyConfig {
    const topic = process.env.NTFY_TOPIC;
    const server = process.env.NTFY_SERVER || 'https://ntfy.sh';

    // Topic is required for ntfy to work
    if (!topic) {
        return {
            topic: '',
            server,
            enabled: false
        };
    }

    // Check for explicit disable values
    if (topic.toLowerCase() === 'none' || topic.toLowerCase() === 'disabled') {
        return {
            topic,
            server,
            enabled: false
        };
    }

    // Validate server URL
    try {
        const url = new URL(server);

        // Only support HTTP/HTTPS protocols
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            if (process.env.DEBUG) {
                console.warn(`[NtfyNotifier] Invalid protocol '${url.protocol}' in server URL. Only http and https are supported. Notifications disabled.`);
            }
            return {
                topic,
                server,
                enabled: false
            };
        }

        return {
            topic,
            server,
            enabled: true
        };
    } catch (error) {
        if (process.env.DEBUG) {
            console.warn(`[NtfyNotifier] Invalid server URL '${server}'. Notifications disabled.`);
        }
        return {
            topic,
            server,
            enabled: false
        };
    }
}

/**
 * Send a notification via ntfy
 *
 * This function implements fire-and-forget HTTP delivery with comprehensive error handling.
 * All errors are caught and logged as warnings only in debug mode - the function never throws.
 *
 * Environment Variables:
 * - NTFY_TOPIC: Required. The ntfy topic to send notifications to
 * - NTFY_SERVER: Optional. Custom ntfy server URL (defaults to https://ntfy.sh)
 *
 * @param message - The notification message to send
 * @param context - Optional context prefix for the message (e.g., "CI/CD", "Build")
 * @returns Promise that resolves immediately (fire-and-forget)
 */
export async function sendNotification(message: string, context?: string): Promise<void> {
    const config = getNtfyConfig();

    // Early exit if notifications are disabled or misconfigured
    if (!config.enabled) {
        return;
    }

    try {
        // Format the message with optional context
        const formattedMessage = context ? `[${context}] ${message}` : message;

        // Parse the server URL
        const url = new URL(`${config.server}/${config.topic}`);

        // Determine which HTTP module to use based on protocol
        const httpModule = url.protocol === 'https:' ? https : http;

        // Prepare request data (ntfy expects plain text body)
        const postData = formattedMessage;

        // Setup request options for ntfy API
        const requestOptions = {
            hostname: url.hostname,
            port: url.port || (url.protocol === 'https:' ? 443 : 80),
            path: url.pathname + url.search,
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        // Create and send the HTTP request
        const req = httpModule.request(requestOptions, (res) => {
            // Fire-and-forget: We don't process the response
            // Just consume the response data to prevent memory leaks
            res.on('data', () => {});
            res.on('end', () => {});
        });

        // Handle request errors
        req.on('error', (error) => {
            // Only log in debug mode to reduce noise in development
            if (process.env.DEBUG) {
                console.warn(`[NtfyNotifier] Failed to send notification to ${config.server}/${config.topic}:`, error.message);
            }
        });

        // Set a timeout to prevent hanging requests
        req.setTimeout(5000, () => {
            // Only log in debug mode to reduce noise in development
            if (process.env.DEBUG) {
                console.warn(`[NtfyNotifier] Request timeout while sending notification to ${config.server}/${config.topic}`);
            }
            req.destroy();
        });

        // Send the request
        req.write(postData);
        req.end();

    } catch (error) {
        // Catch any synchronous errors (URL parsing, etc.)
        // Only log in debug mode to reduce noise in development
        if (process.env.DEBUG) {
            console.warn(`[NtfyNotifier] Error preparing notification request:`, error instanceof Error ? error.message : String(error));
        }
    }
}