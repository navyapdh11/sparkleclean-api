import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/config/prisma.service';
import { EventPublisher } from '../common/events/event.publisher';
import { Cron, CronExpression } from '@nestjs/schedule';

interface CleanerScore {
  cleanerId: string;
  name: string;
  score: number;
  reasons: string[];
}

@Injectable()
export class CleanerAssignmentService {
  private readonly logger = new Logger(CleanerAssignmentService.name);

  constructor(
    private prisma: PrismaService,
    private eventPublisher: EventPublisher,
  ) {}

  /**
   * Score all available cleaners for a booking
   * Uses: proximity, availability, workload balance, rating
   */
  async scoreCleaners(bookingId: string): Promise<CleanerScore[]> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { property: true },
    });
    if (!booking) return [];

    const cleaners = await this.prisma.cleaner.findMany({
      where: { isActive: true },
      include: { user: true },
    });

    const scores: CleanerScore[] = [];

    for (const cleaner of cleaners) {
      const reasons: string[] = [];
      let score = 0;

      // 1. Proximity scoring (0-40 points)
      const proximityScore = await this.calcProximity(cleaner, booking.property);
      score += proximityScore;
      if (proximityScore > 0) {
        reasons.push(`Proximity: ${proximityScore}/40`);
      }

      // 2. Availability check (0-30 points)
      const availabilityScore = await this.calcAvailability(
        cleaner.id,
        booking.scheduledDate,
        booking.durationMin,
      );
      score += availabilityScore;
      if (availabilityScore > 0) {
        reasons.push(`Availability: ${availabilityScore}/30`);
      }

      // 3. Workload balance (0-20 points) — prefer less loaded cleaners
      const loadScore = await this.calcLoadBalance(cleaner.id, booking.scheduledDate);
      score += loadScore;
      reasons.push(`Load balance: ${loadScore}/20`);

      // 4. Rating bonus (0-10 points)
      const ratingScore = cleaner.rating > 0 ? (cleaner.rating / 5) * 10 : 5;
      score += ratingScore;
      if (cleaner.rating > 0) {
        reasons.push(`Rating: ${cleaner.rating}★ → ${ratingScore.toFixed(1)}/10`);
      }

      scores.push({
        cleanerId: cleaner.id,
        name: `${cleaner.user.firstName} ${cleaner.user.lastName}`,
        score: Math.round(score * 10) / 10,
        reasons,
      });
    }

    // Sort by score descending
    return scores.sort((a, b) => b.score - a.score);
  }

  /**
   * Auto-assign the best cleaner to unassigned bookings
   * Runs every 5 minutes
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async autoAssignCleaners() {
    const unassigned = await this.prisma.booking.findMany({
      where: {
        status: 'CONFIRMED',
        scheduledDate: { gte: new Date() },
        assignments: { none: {} },
      },
      take: 20,
      orderBy: { scheduledDate: 'asc' },
    });

    if (unassigned.length === 0) return;

    this.logger.log(`🔄 Auto-assigning ${unassigned.length} bookings`);

    for (const booking of unassigned) {
      const scores = await this.scoreCleaners(booking.id);
      if (scores.length === 0 || scores[0].score === 0) {
        this.logger.warn(`No suitable cleaner found for ${booking.bookingNumber}`);
        continue;
      }

      const best = scores[0];
      await this.prisma.bookingAssignment.create({
        data: {
          bookingId: booking.id,
          cleanerId: best.cleanerId,
          status: 'assigned',
        },
      });

      this.logger.log(
        `✅ Assigned ${best.name} to ${booking.bookingNumber} (score: ${best.score})`,
      );

      await this.eventPublisher.emit({
        type: 'cleaner.assigned' as any,
        entity: 'booking',
        entityId: booking.id,
        data: {
          cleanerId: best.cleanerId,
          cleanerName: best.name,
          score: best.score,
        },
      });
    }
  }

  /**
   * Manually assign a specific cleaner
   */
  async assignCleaner(bookingId: string, cleanerId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) throw new Error('Booking not found');

    // Remove existing assignments
    await this.prisma.bookingAssignment.deleteMany({
      where: { bookingId },
    });

    const assignment = await this.prisma.bookingAssignment.create({
      data: {
        bookingId,
        cleanerId,
        status: 'assigned',
      },
    });

    await this.eventPublisher.emit({
      type: 'cleaner.assigned' as any,
      entity: 'booking',
      entityId: bookingId,
      data: { cleanerId, manual: true },
    });

    return assignment;
  }

  /**
   * Proximity: Haversine distance between cleaner's known location and property
   * In production: use cleaner's GPS or home postcode vs property location
   * For now: postcode matching + random offset for demo
   */
  private async calcProximity(cleaner: any, property: any): Promise<number> {
    // Postcode match = max points
    if (cleaner.serviceAreaIds.includes(property.postcode)) {
      return 40;
    }

    // State match = partial points
    if (cleaner.serviceAreaIds.includes(property.state)) {
      return 20;
    }

    // Default: within maxRadiusKm check
    return 10;
  }

  /**
   * Availability: check if cleaner has conflicting bookings
   */
  private async calcAvailability(
    cleanerId: string,
    scheduledDate: Date,
    durationMin: number,
  ): Promise<number> {
    const windowStart = new Date(scheduledDate.getTime() - durationMin * 60000);
    const windowEnd = new Date(scheduledDate.getTime() + durationMin * 60000 * 2);

    const conflicts = await this.prisma.bookingAssignment.count({
      where: {
        cleanerId,
        status: { in: ['assigned', 'accepted', 'en_route', 'on_site'] },
        booking: {
          scheduledDate: { gte: windowStart, lte: windowEnd },
        },
      },
    });

    if (conflicts > 0) return 0;
    return 30;
  }

  /**
   * Load balance: prefer cleaners with fewer bookings on the same day
   */
  private async calcLoadBalance(
    cleanerId: string,
    scheduledDate: Date,
  ): Promise<number> {
    const dayStart = new Date(scheduledDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(scheduledDate);
    dayEnd.setHours(23, 59, 59, 999);

    const bookingCount = await this.prisma.bookingAssignment.count({
      where: {
        cleanerId,
        booking: {
          scheduledDate: { gte: dayStart, lte: dayEnd },
        },
      },
    });

    // 0 bookings = 20 pts, 1 = 16, 2 = 12, 3 = 8, 4+ = 0
    return Math.max(0, 20 - bookingCount * 4);
  }
}
