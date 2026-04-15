import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, RequireRoles } from '../common/guards/roles.guard';

@ApiTags('admin')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@RequireRoles('ADMIN', 'SUPER_ADMIN')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Admin dashboard overview — 30 day stats' })
  async getDashboard() {
    return this.adminService.getDashboardOverview();
  }

  @Get('bookings')
  @ApiOperation({ summary: 'List all bookings with filters' })
  async listBookings(
    @Query('status') status?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('cleanerId') cleanerId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.adminService.listBookings({
      status,
      dateFrom,
      dateTo,
      cleanerId,
      page: page ? parseInt(page as any) : 1,
      limit: limit ? parseInt(limit as any) : 20,
    });
  }

  @Post('bookings/:id/status')
  @ApiOperation({ summary: 'Update booking status (admin)' })
  async updateBookingStatus(
    @Param('id') id: string,
    @Body() body: { status: string; cleanerNotes?: string },
  ) {
    return this.adminService.updateBookingStatus(id, body.status, body.cleanerNotes);
  }

  @Get('users')
  @ApiOperation({ summary: 'List all users with role filter' })
  async listUsers(
    @Query('role') role?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.adminService.listUsers({
      role,
      page: page ? parseInt(page as any) : 1,
      limit: limit ? parseInt(limit as any) : 20,
    });
  }

  @Get('metrics/revenue')
  @ApiOperation({ summary: 'Revenue metrics — MTD, growth' })
  async getRevenueMetrics() {
    return this.adminService.getRevenueMetrics();
  }

  @Get('metrics/cleaners')
  @ApiOperation({ summary: 'Cleaner performance metrics' })
  async getCleanerPerformance() {
    return this.adminService.getCleanerPerformance();
  }
}
