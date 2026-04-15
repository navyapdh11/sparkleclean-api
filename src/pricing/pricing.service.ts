import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/config/prisma.service';

@Injectable()
export class PricingService {
  constructor(private prisma: PrismaService) {}

  /**
   * Calculate price for a service + property combination
   * Applies frequency discount, minimum charge, and GST
   */
  async calculatePrice(
    serviceId: string,
    propertyId: string,
    frequency: string,
  ) {
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
    });
    if (!service) throw new Error('Service not found');

    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
    });
    if (!property) throw new Error('Property not found');

    // Base + per-room + area
    let base = service.basePrice;
    base += (property.bedrooms ?? 0) * service.pricePerBedroom;
    base += (property.bathrooms ?? 0) * service.pricePerBathroom;
    if (property.totalAreaSqm && service.pricePerSqm > 0) {
      base += property.totalAreaSqm * service.pricePerSqm;
    }

    // Frequency discount
    const rule = await this.prisma.pricingRule.findFirst({
      where: { serviceId, frequency: frequency as any, isActive: true },
    });
    const discountPct = rule?.discountPct ?? 0;
    let afterDiscount = base * (1 - discountPct / 100);

    // Minimum charge
    const minCharge = rule?.minimumCharge ?? service.basePrice;
    afterDiscount = Math.max(afterDiscount, minCharge);

    // GST (10% AU — inclusive or exclusive)
    const gstAmount = service.gstInclusive
      ? afterDiscount * (1 / 11)
      : afterDiscount * 0.1;
    const total = service.gstInclusive ? afterDiscount : afterDiscount + gstAmount;

    // Duration estimate
    const durationMin = Math.max(
      service.minDurationMin,
      Math.ceil((afterDiscount / service.pricePerHour) * 60),
    );

    return {
      basePrice: Math.round(base * 100) / 100,
      discountPct,
      discountAmount: Math.round((base - afterDiscount) * 100) / 100,
      afterDiscount: Math.round(afterDiscount * 100) / 100,
      gstAmount: Math.round(gstAmount * 100) / 100,
      total: Math.round(total * 100) / 100,
      currency: 'AUD',
      durationMin,
      frequency,
    };
  }

  /**
   * Get all services with pricing info
   */
  async listServices() {
    return this.prisma.service.findMany({
      where: { isActive: true },
      orderBy: { category: 'asc' },
    });
  }

  /**
   * Get available pricing rules
   */
  async getPricingRules(serviceId: string) {
    return this.prisma.pricingRule.findMany({
      where: { serviceId, isActive: true },
      orderBy: { frequency: 'asc' },
    });
  }
}
