import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PricingService } from './pricing.service';

@ApiTags('pricing')
@Controller('pricing')
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  @Get('services')
  @ApiOperation({ summary: 'List all active services' })
  async listServices() {
    return this.pricingService.listServices();
  }

  @Get('quote')
  @ApiOperation({ summary: 'Get a price quote' })
  async getQuote(
    @Query('serviceId') serviceId: string,
    @Query('propertyId') propertyId: string,
    @Query('frequency') frequency: string = 'ONCE',
  ) {
    return this.pricingService.calculatePrice(serviceId, propertyId, frequency);
  }

  @Get('rules/:serviceId')
  @ApiOperation({ summary: 'Get pricing rules for a service' })
  async getRules(@Param('serviceId') serviceId: string) {
    return this.pricingService.getPricingRules(serviceId);
  }
}
