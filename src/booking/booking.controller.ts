import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { BookingService } from './booking.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('bookings')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('bookings')
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new booking' })
  @ApiResponse({ status: 201, description: 'Booking created successfully' })
  async create(@Body() dto: CreateBookingDto, @Request() req: any) {
    return this.bookingService.create(dto, req.user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get booking details' })
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.bookingService.findOne(id, req.user.sub);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel a booking' })
  async cancel(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @Request() req: any,
  ) {
    return this.bookingService.cancel(id, req.user.sub, reason);
  }
}
