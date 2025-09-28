import { createHash } from 'crypto';
import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';
import { AuditEvent } from '../audit/types';

/**
 * Dashboard Event Emitter
 *
 * Handles forwarding of audit events to external dashboard systems.
 * Integrates with the existing AuditLogger to send events to configured endpoints.
 */
export class DashboardEventEmitter {
    private readonly endpoint?: string;
    private readonly enabled: boolean;

    /**
     * Initialize the DashboardEventEmitter
     *
     * @param endpoint - Optional dashboard endpoint URL. If not provided, will use environment variable or disable forwarding
     */
    constructor(endpoint?: string) {
        this.endpoint = endpoint || process.env.AGNETO_DASHBOARD_ENDPOINT;
        this.enabled = this.validateAndSetEnabled();
    }

    /**
     * Validate the endpoint URL and determine if forwarding should be enabled
     */
    private validateAndSetEnabled(): boolean {
        if (!this.endpoint) {
            return false;
        }

        // Check for explicit disable values
        if (this.endpoint.toLowerCase() === 'none' || this.endpoint.toLowerCase() === 'disabled') {
            return false;
        }

        try {
            const url = new URL(this.endpoint);

            // Only support HTTP/HTTPS protocols
            if (url.protocol !== 'http:' && url.protocol !== 'https:') {
                console.warn(`[DashboardEventEmitter] Invalid protocol '${url.protocol}' in endpoint. Only http and https are supported. Dashboard forwarding disabled.`);
                return false;
            }

            return true;
        } catch (error) {
            console.warn(`[DashboardEventEmitter] Invalid dashboard endpoint URL '${this.endpoint}'. Dashboard forwarding disabled.`);
            return false;
        }
    }

    /**
     * Check if dashboard event forwarding is enabled
     */
    public isEnabled(): boolean {
        return this.enabled;
    }

    /**
     * Get the configured endpoint URL
     */
    public getEndpoint(): string | undefined {
        return this.endpoint;
    }

    /**
     * Forward an audit event to the configured dashboard endpoint
     *
     * This method implements fire-and-forget HTTP forwarding with comprehensive error handling.
     * All errors are caught and logged as warnings only - the method never throws.
     *
     * @param event - The audit event to forward
     * @param taskId - Optional task identifier to include in the payload
     */
    public async forwardEvent(event: AuditEvent, taskId?: string): Promise<void> {
        // Early exit if forwarding is disabled
        if (!this.enabled || !this.endpoint) {
            return;
        }

        try {
            // Transform payload to include taskId
            const payload = {
                ...event,
                taskId
            };

            // Parse the endpoint URL
            const url = new URL(this.endpoint);

            // Determine which HTTP module to use based on protocol
            const httpModule = url.protocol === 'https:' ? https : http;

            // Prepare request data
            const postData = JSON.stringify(payload);

            // Setup request options
            const requestOptions = {
                hostname: url.hostname,
                port: url.port || (url.protocol === 'https:' ? 443 : 80),
                path: url.pathname + url.search,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
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
                    console.warn(`[DashboardEventEmitter] Failed to forward event to ${this.endpoint}:`, error.message);
                }
            });

            // Set a timeout to prevent hanging requests
            req.setTimeout(5000, () => {
                // Only log in debug mode to reduce noise in development
                if (process.env.DEBUG) {
                    console.warn(`[DashboardEventEmitter] Request timeout while forwarding to ${this.endpoint}`);
                }
                req.destroy();
            });

            // Send the request
            req.write(postData);
            req.end();

        } catch (error) {
            // Catch any synchronous errors (URL parsing, JSON stringify, etc.)
            // Only log in debug mode to reduce noise in development
            if (process.env.DEBUG) {
                console.warn(`[DashboardEventEmitter] Error preparing request to ${this.endpoint}:`, error instanceof Error ? error.message : String(error));
            }
        }
    }
}