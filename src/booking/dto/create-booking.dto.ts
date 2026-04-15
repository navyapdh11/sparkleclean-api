import { IsString, IsNotEmpty, IsEnum, IsOptional, IsNumber, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum BookingFrequency {
  ONCE = 'ONCE',
  WEEKLY = 'WEEKLY',
  FORTNIGHTLY = 'FORTNIGHTLY',
  MONTHLY = 'MONTHLY',
}

export class CreateBookingDto {
  @ApiProperty({ description: 'Property ID' })
  @IsString()
  @IsNotEmpty()
  propertyId: string;

  @ApiProperty({ description: 'Service ID' })
  @IsString()
  @IsNotEmpty()
  serviceId: string;

  @ApiProperty({ description: 'Scheduled date ISO 8601' })
  @IsString()
  @IsNotEmpty()
  scheduledDate: string;

  @ApiProperty({ enum: BookingFrequency, default: 'ONCE' })
  @IsEnum(BookingFrequency)
  frequency: BookingFrequency;

  @ApiPropertyOptional({ description: 'Number of weeks for recurring bookings' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  recurrenceWeeks?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  accessInstructions?: string;
}
