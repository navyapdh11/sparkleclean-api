import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { v4 as uuidv4 } from 'uuid';
import { EventType, EventPayload } from './event.types';
import { PrismaService } from '../config/prisma.service';

export const WEBHOOK_QUEUE = 'webhook-delivery';

@Injectable()
export class EventPublisher {
  constructor(
    private prisma: PrismaService,
    @InjectQueue(WEBHOOK_QUEUE) private webhookQueue: Queue,
  ) {}

  async emit(payload: Omit<EventPayload, 'timestamp'>): Promise<void> {
    const event: EventPayload = {
      ...payload,
      timestamp: new Date().toISOString(),
      correlationId: payload.correlationId ?? uuidv4(),
    };

    // 1. Persist to audit log
    await this.prisma.auditLog.create({
      data: {
        eventType: this.mapEventType(event.type),
        entity: event.entity,
        entityId: event.entityId,
        after: event.data as any,
      },
    });

    // 2. Enqueue webhook deliveries for active endpoints
    const endpoints = await this.prisma.webhookEndpoint.findMany({
      where: { isActive: true, events: { has: event.type as any } },
    });

    for (const ep of endpoints) {
      await this.webhookQueue.add('deliver', {
        endpointUrl: ep.url,
        secret: ep.secret,
        payload: event,
      }, {
        attempts: 5,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { age: 3600, count: 100 },
        removeOnFail: { age: 86400 },
      });
    }
  }

  private mapEventType(type: string): any {
    const map: Record<string, string> = {
      'booking.created': 'BOOKING_CREATED',
      'booking.confirmed': 'BOOKING_CONFIRMED',
      'booking.cancelled': 'BOOKING_CANCELLED',
      'booking.completed': 'BOOKING_COMPLETED',
      'cleaner.assigned': 'BOOKING_CREATED',
      'payment.received': 'PAYMENT_RECEIVED',
      'payment.failed': 'BOOKING_CREATED',
      'review.submitted': 'REVIEW_SUBMITTED',
      'customer.created': 'CUSTOMER_CREATED',
      'customer.updated': 'CUSTOMER_UPDATED',
    };
    return map[type] ?? 'BOOKING_CREATED';
  }
}
