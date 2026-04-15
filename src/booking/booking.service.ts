import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/config/prisma.service';
import { EventPublisher } from '../common/events/event.publisher';
import { CreateBookingDto } from './dto/create-booking.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class BookingService {
  constructor(
    private prisma: PrismaService,
    private eventPublisher: EventPublisher,
  ) {}

  async create(dto: CreateBookingDto, customerId: string) {
    // 1. Validate property belongs to customer
    const property = await this.prisma.property.findFirst({
      where: { id: dto.propertyId, customerId },
    });
    if (!property) {
      throw new NotFoundException('Property not found or not accessible');
    }

    // 2. Validate service exists
    const service = await this.prisma.service.findUnique({
      where: { id: dto.serviceId },
    });
    if (!service) {
      throw new NotFoundException('Service not found');
    }

    // 3. Calculate pricing
    const pricing = await this.calculatePricing(service, property, dto.frequency);

    // 4. Generate booking number
    const bookingNumber = `SC-${Date.now().toString(36).toUpperCase()}-${uuidv4().slice(0, 6).toUpperCase()}`;

    const scheduledStart = new Date(dto.scheduledDate);
    const scheduledEnd = new Date(scheduledStart.getTime() + pricing.durationMin * 60000);

    // 5. Create booking
    const booking = await this.prisma.booking.create({
      data: {
        bookingNumber,
        customerId,
        propertyId: dto.propertyId,
        serviceId: dto.serviceId,
        frequency: dto.frequency,
        scheduledDate: scheduledStart,
        scheduledEnd,
        durationMin: pricing.durationMin,
        basePrice: pricing.basePrice,
        discountPct: pricing.discountPct,
        gstAmount: pricing.gstAmount,
        totalAmount: pricing.total,
        notes: dto.notes,
        accessInstructions: dto.accessInstructions,
      },
      include: {
        service: true,
        property: true,
      },
    });

    // 6. Emit event
    await this.eventPublisher.emit({
      type: 'booking.created' as any,
      entity: 'booking',
      entityId: booking.id,
      data: { bookingNumber, total: booking.totalAmount },
    });

    // 7. If recurring, generate child bookings
    if (dto.frequency !== 'ONCE' && dto.recurrenceWeeks) {
      await this.createRecurringBookings(booking, dto.recurrenceWeeks);
    }

    return booking;
  }

  async findOne(id: string, customerId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id, customerId },
      include: {
        service: true,
        property: true,
        assignments: { include: { cleaner: { include: { user: true } } } },
        payments: true,
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  async cancel(id: string, customerId: string, reason: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id, customerId },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.status === 'CANCELLED') {
      throw new BadRequestException('Booking already cancelled');
    }

    const updated = await this.prisma.booking.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancellationReason: reason,
      },
    });

    await this.eventPublisher.emit({
      type: 'booking.cancelled' as any,
      entity: 'booking',
      entityId: id,
      data: { reason, bookingNumber: booking.bookingNumber },
    });

    return updated;
  }

  /**
   * Price calculation with frequency discount + GST
   */
  private async calculatePricing(
    service: any,
    property: any,
    frequency: string,
  ) {
    // Base price
    let base = service.basePrice;

    // Add per-bedroom/bathroom surcharges
    base += (property.bedrooms ?? 0) * service.pricePerBedroom;
    base += (property.bathrooms ?? 0) * service.pricePerBathroom;

    // Area-based surcharge
    if (property.totalAreaSqm && service.pricePerSqm > 0) {
      base += property.totalAreaSqm * service.pricePerSqm;
    }

    // Frequency discount
    const rule = await this.prisma.pricingRule.findFirst({
      where: {
        serviceId: service.id,
        frequency: frequency as any,
        isActive: true,
      },
    });

    const discountPct = rule?.discountPct ?? 0;
    const discounted = base * (1 - discountPct / 100);

    // Minimum charge
    const minimumCharge = rule?.minimumCharge ?? service.basePrice;
    const afterMin = Math.max(discounted, minimumCharge);

    // GST (10% AU)
    const gstInclusive = service.gstInclusive;
    const gstAmount = gstInclusive
      ? afterMin * (1 / 11) // GST is 1/11 of inclusive price
      : afterMin * 0.1;
    const total = gstInclusive ? afterMin : afterMin + gstAmount;

    // Duration
    const durationMin = Math.max(
      service.minDurationMin,
      Math.ceil((afterMin / service.pricePerHour) * 60),
    );

    return {
      basePrice: Math.round(base * 100) / 100,
      discountPct,
      gstAmount: Math.round(gstAmount * 100) / 100,
      total: Math.round(total * 100) / 100,
      durationMin,
    };
  }

  /**
   * Generate recurring child bookings
   */
  private async createRecurringBookings(
    parent: any,
    weeks: number,
  ) {
    const bookings = [];
    let currentDate = new Date(parent.scheduledDate);

    const intervalDays =
      parent.frequency === 'WEEKLY'
        ? 7
        : parent.frequency === 'FORTNIGHTLY'
          ? 14
          : 30;

    for (let i = 0; i < weeks; i++) {
      currentDate = new Date(currentDate.getTime() + intervalDays * 86400000);
      const end = new Date(currentDate.getTime() + parent.durationMin * 60000);

      const child = await this.prisma.booking.create({
        data: {
          bookingNumber: `SC-${Date.now().toString(36).toUpperCase()}-${uuidv4().slice(0, 6).toUpperCase()}`,
          customerId: parent.customerId,
          propertyId: parent.propertyId,
          serviceId: parent.serviceId,
          frequency: parent.frequency,
          scheduledDate: currentDate,
          scheduledEnd: end,
          durationMin: parent.durationMin,
          basePrice: parent.basePrice,
          discountPct: parent.discountPct,
          gstAmount: parent.gstAmount,
          totalAmount: parent.totalAmount,
          parentId: parent.id,
        },
      });
      bookings.push(child);
    }

    // Update parent with recurrence end
    await this.prisma.booking.update({
      where: { id: parent.id },
      data: { recurrenceEnd: currentDate },
    });

    return bookings;
  }
}
