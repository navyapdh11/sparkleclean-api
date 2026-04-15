import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/config/prisma.service';
import { StartOfDay } from 'date-fns';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  /**
   * Dashboard overview — stats for the last 30 days
   */
  async getDashboardOverview() {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);

    const [
      totalBookings,
      completedBookings,
      cancelledBookings,
      totalRevenue,
      pendingRevenue,
      totalCustomers,
      activeCleaners,
      avgRating,
    ] = await Promise.all([
      this.prisma.booking.count({
        where: { createdAt: { gte: thirtyDaysAgo } },
      }),
      this.prisma.booking.count({
        where: { status: 'COMPLETED', createdAt: { gte: thirtyDaysAgo } },
      }),
      this.prisma.booking.count({
        where: { status: 'CANCELLED', createdAt: { gte: thirtyDaysAgo } },
      }),
      this.prisma.payment.aggregate({
        where: { status: 'PAID', createdAt: { gte: thirtyDaysAgo } },
        _sum: { amount: true },
      }),
      this.prisma.payment.aggregate({
        where: { status: 'PENDING', createdAt: { gte: thirtyDaysAgo } },
        _sum: { amount: true },
      }),
      this.prisma.customer.count({
        where: { createdAt: { gte: thirtyDaysAgo } },
      }),
      this.prisma.cleaner.count({
        where: { isActive: true },
      }),
      this.prisma.review.aggregate({
        where: { createdAt: { gte: thirtyDaysAgo } },
        _avg: { rating: true },
      }),
    ]);

    // Revenue by service category
    const revenueByCategory = await this.prisma.payment.groupBy({
      by: ['bookingId'],
      _sum: { amount: true },
      where: { status: 'PAID', createdAt: { gte: thirtyDaysAgo } },
    });

    // Daily revenue chart data
    const dailyRevenue = await this.prisma.$queryRaw`
      SELECT
        DATE("createdAt") AS date,
        SUM(amount) AS total,
        COUNT(*) AS count
      FROM "Payment"
      WHERE status = 'PAID' AND "createdAt" >= ${thirtyDaysAgo}
      GROUP BY DATE("createdAt")
      ORDER BY date ASC
    `;

    // Bookings by status
    const bookingsByStatus = await this.prisma.booking.groupBy({
      by: ['status'],
      _count: { id: true },
      _sum: { totalAmount: true },
      where: { createdAt: { gte: thirtyDaysAgo } },
    });

    return {
      totalBookings,
      completedBookings,
      cancelledBookings,
      completionRate: totalBookings > 0
        ? Math.round((completedBookings / totalBookings) * 1000) / 10
        : 0,
      totalRevenue: totalRevenue._sum.amount ?? 0,
      pendingRevenue: pendingRevenue._sum.amount ?? 0,
      newCustomers: totalCustomers,
      activeCleaners,
      avgRating: avgRating._avg.rating ?? 0,
      dailyRevenue,
      bookingsByStatus: bookingsByStatus.map((b) => ({
        status: b.status,
        count: b._count.id,
        total: b._sum.totalAmount ?? 0,
      })),
    };
  }

  /**
   * List all bookings with filters (admin view)
   */
  async listBookings(query: {
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    cleanerId?: string;
    page?: number;
    limit?: number;
  }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.dateFrom) where.scheduledDate = { ...where.scheduledDate, gte: new Date(query.dateFrom) };
    if (query.dateTo) where.scheduledDate = { ...where.scheduledDate, lte: new Date(query.dateTo) };
    if (query.cleanerId) {
      where.assignments = { some: { cleanerId: query.cleanerId } };
    }

    const [bookings, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        skip,
        take: limit,
        orderBy: { scheduledDate: 'desc' },
        include: {
          service: { select: { name: true, category: true } },
          property: { select: { suburb: true, state: true } },
          customer: { select: { user: { select: { firstName: true, lastName: true, email: true } } } },
          assignments: {
            select: {
              cleaner: {
                select: {
                  user: { select: { firstName: true, lastName: true } },
                },
              },
            },
          },
          payments: { select: { status: true, amount: true } },
        },
      }),
      this.prisma.booking.count({ where }),
    ]);

    return {
      bookings,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Update booking status (admin only)
   */
  async updateBookingStatus(
    bookingId: string,
    status: string,
    cleanerNotes?: string,
  ) {
    const data: any = { status: status as any };
    if (cleanerNotes) data.cleanerNotes = cleanerNotes;
    if (status === 'COMPLETED') data.completedAt = new Date();

    const booking = await this.prisma.booking.update({
      where: { id: bookingId },
      data,
      include: {
        service: true,
        property: true,
        customer: true,
      },
    });

    return booking;
  }

  /**
   * List all users with role filter
   */
  async listUsers(query: { role?: string; page?: number; limit?: number }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.role) where.role = query.role;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          role: true,
          status: true,
          createdAt: true,
          lastLoginAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { users, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  /**
   * Revenue metrics — MTD, growth, top services
   */
  async getRevenueMetrics() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [mtdRevenue, lastMonthRevenue, revenueByService, revenueBySuburb] = await Promise.all([
      // MTD
      this.prisma.payment.aggregate({
        where: { status: 'PAID', createdAt: { gte: monthStart } },
        _sum: { amount: true },
      }),
      // Last month
      this.prisma.payment.aggregate({
        where: {
          status: 'PAID',
          createdAt: { gte: lastMonthStart, lt: monthStart },
        },
        _sum: { amount: true },
      }),
      // By service
      this.prisma.payment.groupBy({
        by: ['bookingId'],
        _sum: { amount: true },
        where: { status: 'PAID', createdAt: { gte: monthStart } },
      }),
      // By suburb
      this.prisma.booking.groupBy({
        by: ['propertyId'],
        _sum: { totalAmount: true },
        _count: { id: true },
        where: { createdAt: { gte: monthStart } },
      }),
    ]);

    const mtd = mtdRevenue._sum.amount ?? 0;
    const lastMonth = lastMonthRevenue._sum.amount ?? 0;
    const growth = lastMonth > 0 ? ((mtd - lastMonth) / lastMonth) * 100 : 0;

    return {
      mtdRevenue: Math.round(mtd * 100) / 100,
      lastMonthRevenue: Math.round(lastMonth * 100) / 100,
      growthPct: Math.round(growth * 10) / 10,
    };
  }

  /**
   * Cleaner performance metrics
   */
  async getCleanerPerformance() {
    const cleaners = await this.prisma.cleaner.findMany({
      where: { isActive: true },
      include: {
        user: { select: { firstName: true, lastName: true } },
        assignments: {
          include: { booking: { select: { totalAmount: true, status: true } } },
        },
      },
    });

    return cleaners.map((c) => {
      const completed = c.assignments.filter(
        (a) => a.booking.status === 'COMPLETED',
      ).length;
      const totalRevenue = c.assignments
        .filter((a) => a.booking.status === 'COMPLETED')
        .reduce((sum, a) => sum + (a.booking.totalAmount ?? 0), 0);

      return {
        id: c.id,
        name: `${c.user.firstName} ${c.user.lastName}`,
        rating: c.rating,
        reviewCount: c.reviewCount,
        completedJobs: completed,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        maxRadiusKm: c.maxRadiusKm,
      };
    }).sort((a, b) => b.totalRevenue - a.totalRevenue);
  }
}
