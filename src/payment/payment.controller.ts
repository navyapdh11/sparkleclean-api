import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Request,
  RawBodyRequest,
  Headers,
  Res,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiHeader,
} from '@nestjs/swagger';
import { PaymentService } from './payment.service';
import { CreatePaymentDto, RefundPaymentDto } from './dto/create-payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Response } from 'express';

@ApiTags('payments')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post()
  @ApiOperation({ summary: 'Create a payment intent for a booking' })
  async create(@Body() dto: CreatePaymentDto, @Request() req: any) {
    return this.paymentService.createPayment(dto, req.user.sub);
  }

  @Post(':id/refund')
  @ApiOperation({ summary: 'Refund a payment (full or partial)' })
  async refund(
    @Param('id') id: string,
    @Body() dto: RefundPaymentDto,
    @Request() req: any,
  ) {
    return this.paymentService.refundPayment(id, dto.amount);
  }

  @Get('booking/:bookingId')
  @ApiOperation({ summary: 'Get payment history for a booking' })
  async getBookingPayments(
    @Param('bookingId') bookingId: string,
    @Request() req: any,
  ) {
    return this.paymentService.getBookingPayments(bookingId, req.user.sub);
  }

  /**
   * Stripe webhook — raw body required for signature verification
   */
  @Post('webhook/stripe')
  @ApiOperation({ summary: 'Stripe webhook handler' })
  @ApiHeader({ name: 'stripe-signature', required: true })
  async handleStripeWebhook(
    @Request() req: RawBodyRequest<any>,
    @Headers('stripe-signature') signature: string,
    @Res() res: Response,
  ) {
    const result = await this.paymentService.handleWebhookEvent(
      req.rawBody?.toString() ?? '',
      signature,
    );
    res.json(result);
  }
}
