import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/config/prisma.service';

@Injectable()
export class GeoService {
  constructor(private prisma: PrismaService) {}

  /**
   * Find suburbs matching a query
   */
  async searchSuburbs(query: string, state?: string) {
    const where: any = { isActive: true };
    if (query) {
      where.OR = [
        { name: { contains: query, mode: 'insensitive' } },
        { postcode: { contains: query } },
        { slug: { contains: query, mode: 'insensitive' } },
      ];
    }
    if (state) {
      where.state = state;
    }

    return this.prisma.suburb.findMany({
      where,
      orderBy: { name: 'asc' },
      take: 50,
    });
  }

  /**
   * Get suburb SEO data for landing page
   */
  async getSuburbBySlug(slug: string) {
    return this.prisma.suburb.findUnique({
      where: { slug },
    });
  }

  /**
   * Find available cleaners within radius of a suburb
   * Uses Haversine approximation for initial filter,
   * then PostGIS ST_DWithin for precise matching
   */
  async findCleanersInArea(suburbId: string, radiusKm: number = 25) {
    const suburb = await this.prisma.suburb.findUnique({
      where: { id: suburbId },
    });
    if (!suburb) return [];

    // Find active cleaners whose service area includes this suburb
    // or who are within the radius
    const cleaners = await this.prisma.cleaner.findMany({
      where: {
        isActive: true,
        maxRadiusKm: { gte: radiusKm },
        OR: [
          { serviceAreaIds: { has: suburb.postcode } },
          { serviceAreaIds: { has: suburbId } },
        ],
      },
      include: {
        user: { select: { firstName: true, lastName: true, avatarUrl: true } },
      },
    });

    return cleaners.map((c) => ({
      id: c.id,
      name: `${c.user.firstName} ${c.user.lastName}`,
      avatarUrl: c.user.avatarUrl,
      rating: c.rating,
      reviewCount: c.reviewCount,
      maxRadiusKm: c.maxRadiusKm,
    }));
  }

  /**
   * Get all active states and their suburb counts
   */
  async getServiceCoverage() {
    const result = await this.prisma.suburb.groupBy({
      by: ['state'],
      _count: { id: true },
      where: { isActive: true },
      orderBy: { state: 'asc' },
    });

    return result.map((r) => ({
      state: r.state,
      suburbCount: r._count.id,
    }));
  }
}
