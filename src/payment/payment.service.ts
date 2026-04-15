import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/config/prisma.service';
import { EventPublisher } from '../common/events/event.publisher';
import { CreatePaymentDto } from './dto/create-payment.dto';
import Stripe from 'stripe';

@Injectable()
export class PaymentService {
  private stripe: Stripe;

  constructor(
    private prisma: PrismaService,
    private eventPublisher: EventPublisher,
  ) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? 'sk_test_placeholder', {
      apiVersion: '2024-12-18.acacia' as any,
    });
  }

  /**
   * Create a Stripe PaymentIntent and persist payment record
   */
  async createPayment(dto: CreatePaymentDto, customerId: string) {
    // 1. Validate booking belongs to customer
    const booking = await this.prisma.booking.findFirst({
      where: { id: dto.bookingId, customerId },
      include: { customer: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.status === 'CANCELLED') {
      throw new BadRequestException('Cannot pay for cancelled booking');
    }

    // 2. Check if already paid
    const existingPayment = await this.prisma.payment.findFirst({
      where: { bookingId: dto.bookingId, status: 'PAID' },
    });
    if (existingPayment) {
      throw new BadRequestException('Booking already paid');
    }

    // 3. Create Stripe PaymentIntent
    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: Math.round(booking.totalAmount * 100), // cents
      currency: 'aud',
      metadata: {
        bookingId: booking.id,
        bookingNumber: booking.bookingNumber,
        customerId: booking.customerId,
      },
      description: `SparkleClean — ${booking.bookingNumber}`,
      receipt_email: booking.customer.email,
    });

    // 4. Persist payment record
    const payment = await this.prisma.payment.create({
      data: {
        bookingId: dto.bookingId,
        stripePaymentId: paymentIntent.id,
        amount: booking.totalAmount,
        currency: 'AUD',
        gstAmount: booking.gstAmount,
        status: 'PENDING',
        method: 'STRIPE',
      },
    });

    return {
      clientSecret: paymentIntent.client_secret,
      paymentId: payment.id,
      amount: booking.totalAmount,
      currency: 'AUD',
    };
  }

  /**
   * Confirm payment after Stripe webhook callback
   */
  async confirmPayment(stripePaymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { stripePaymentId },
      include: { booking: true },
    });
    if (!payment) throw new NotFoundException('Payment not found');

    const updated = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'PAID',
        paidAt: new Date(),
      },
    });

    // Update booking status if first payment
    if (payment.booking.status === 'PENDING') {
      await this.prisma.booking.update({
        where: { id: payment.booking.id },
        data: { status: 'CONFIRMED' },
      });
    }

    // Create/update invoice
    await this.upsertInvoice(payment.booking);

    await this.eventPublisher.emit({
      type: 'payment.received' as any,
      entity: 'payment',
      entityId: payment.id,
      data: { amount: payment.amount, bookingNumber: payment.booking.bookingNumber },
    });

    return updated;
  }

  /**
   * Refund a payment (full or partial)
   */
  async refundPayment(paymentId: string, amount?: number) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { booking: true },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status !== 'PAID') {
      throw new BadRequestException('Can only refund paid payments');
    }

    const refundAmount = amount ?? payment.amount;
    if (refundAmount > payment.amount - payment.refundedAmount) {
      throw new BadRequestException('Refund amount exceeds remaining balance');
    }

    // Create Stripe refund
    const refund = await this.stripe.refunds.create({
      payment_intent: payment.stripePaymentId!,
      amount: Math.round(refundAmount * 100),
    });

    const totalRefunded = payment.refundedAmount + refundAmount;
    const newStatus = totalRefunded >= payment.amount ? 'REFUNDED' : 'PARTIALLY_REFUNDED';

    const updated = await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        refundedAmount: totalRefunded,
        status: newStatus,
        metadata: {
          ...(payment.metadata as any),
          refundId: refund.id,
          refundedAt: new Date().toISOString(),
        },
      },
    });

    return updated;
  }

  /**
   * Handle Stripe webhook events
   */
  async handleWebhookEvent(payload: string, signature: string) {
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!endpointSecret) throw new Error('STRIPE_WEBHOOK_SECRET not configured');

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(payload, signature, endpointSecret);
    } catch (err) {
      throw new BadRequestException(`Invalid webhook signature: ${err}`);
    }

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent;
        await this.confirmPayment(pi.id);
        break;
      }
      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent;
        await this.prisma.payment.updateMany({
          where: { stripePaymentId: pi.id },
          data: {
            status: 'FAILED',
            failureReason: pi.last_payment_error?.message ?? 'Unknown error',
          },
        });
        await this.eventPublisher.emit({
          type: 'payment.failed' as any,
          entity: 'payment',
          entityId: pi.id,
          data: { reason: pi.last_payment_error?.message },
        });
        break;
      }
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        await this.prisma.payment.updateMany({
          where: { stripePaymentId: charge.payment_intent as string },
          data: {
            status: charge.fully_refunded ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
            refundedAmount: (charge.amount_refunded ?? 0) / 100,
          },
        });
        break;
      }
    }

    return { received: true, type: event.type };
  }

  /**
   * Upsert invoice for a booking
   */
  private async upsertInvoice(booking: any) {
    const invoiceNumber = `INV-${booking.bookingNumber}`;
    const dueDate = new Date(booking.scheduledDate);
    dueDate.setDate(dueDate.getDate() - 1); // Due day before service

    await this.prisma.invoice.upsert({
      where: { invoiceNumber },
      update: {
        status: 'paid',
        paidAt: new Date(),
      },
      create: {
        invoiceNumber,
        customerId: booking.customerId,
        bookingId: booking.id,
        subtotal: booking.basePrice,
        gstAmount: booking.gstAmount,
        total: booking.totalAmount,
        status: 'paid',
        dueDate,
        paidAt: new Date(),
      },
    });
  }

  /**
   * Get payment history for a booking
   */
  async getBookingPayments(bookingId: string, customerId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, customerId },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    return this.prisma.payment.findMany({
      where: { bookingId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
