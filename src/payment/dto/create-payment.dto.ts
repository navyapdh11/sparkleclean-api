import { IsString, IsNotEmpty, IsNumber, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePaymentDto {
  @ApiProperty({ description: 'Booking ID to pay for' })
  @IsString()
  @IsNotEmpty()
  bookingId: string;
}

export class RefundPaymentDto {
  @ApiPropertyOptional({ description: 'Refund amount in AUD (defaults to full amount)' })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  amount?: number;
}
