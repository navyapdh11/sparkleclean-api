export enum EventType {
  BOOKING_CREATED = 'booking.created',
  BOOKING_CONFIRMED = 'booking.confirmed',
  BOOKING_CANCELLED = 'booking.cancelled',
  BOOKING_COMPLETED = 'booking.completed',
  CLEANER_ASSIGNED = 'cleaner.assigned',
  PAYMENT_RECEIVED = 'payment.received',
  PAYMENT_FAILED = 'payment.failed',
  REVIEW_SUBMITTED = 'review.submitted',
  CUSTOMER_CREATED = 'customer.created',
  CUSTOMER_UPDATED = 'customer.updated',
}

export interface EventPayload {
  type: EventType;
  entity: string;
  entityId: string;
  data: Record<string, unknown>;
  timestamp: string; // ISO 8601
  correlationId?: string;
}
