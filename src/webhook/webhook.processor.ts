import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';
import { createHmac, timingSafeEqual } from 'crypto';

export const WEBHOOK_QUEUE = 'webhook-delivery';

@Processor(WEBHOOK_QUEUE)
@Injectable()
export class WebhookProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookProcessor.name);

  constructor(private prisma: PrismaService) {
    super();
  }

  async process(job: Job): Promise<any> {
    const { endpointUrl, secret, payload } = job.data;

    // Sign payload
    const body = JSON.stringify(payload);
    const timestamp = Date.now();
    const signature = this.sign(secret, `${timestamp}.${body}`);

    try {
      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Timestamp': String(timestamp),
          'X-Webhook-Signature': `sha256=${signature}`,
          'X-Webhook-Event': payload.type,
        },
        body,
        signal: AbortSignal.timeout(10000), // 10s timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      this.logger.log(`✅ Webhook delivered: ${payload.type} → ${endpointUrl}`);
      return { delivered: true, status: response.status };
    } catch (error) {
      this.logger.warn(
        `❌ Webhook failed (attempt ${job.attemptsMade}): ${payload.type} → ${endpointUrl}: ${error}`,
      );

      if (job.attemptsMade >= job.opts.attempts!) {
        this.logger.error(
          `🚨 Webhook permanently failed: ${payload.type} → ${endpointUrl}`,
        );
      }
      throw error; // BullMQ will retry with backoff
    }
  }

  private sign(secret: string, payload: string): string {
    return createHmac('sha256', secret).update(payload).digest('hex');
  }
}
