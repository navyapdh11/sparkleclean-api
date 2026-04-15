import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { GeoService } from './geo.service';

@ApiTags('geo')
@Controller('geo')
export class GeoController {
  constructor(private readonly geoService: GeoService) {}

  @Get('suburbs')
  @ApiOperation({ summary: 'Search Australian suburbs' })
  async searchSuburbs(
    @Query('q') query?: string,
    @Query('state') state?: string,
  ) {
    return this.geoService.searchSuburbs(query ?? '', state);
  }

  @Get('suburbs/:slug')
  @ApiOperation({ summary: 'Get suburb details (SEO landing page data)' })
  async getSuburb(@Param('slug') slug: string) {
    return this.geoService.getSuburbBySlug(slug);
  }

  @Get('cleaners/:suburbId')
  @ApiOperation({ summary: 'Find available cleaners in a service area' })
  async findCleaners(
    @Param('suburbId') suburbId: string,
    @Query('radiusKm') radiusKm?: number,
  ) {
    return this.geoService.findCleanersInArea(
      suburbId,
      radiusKm ? parseFloat(radiusKm as any) : 25,
    );
  }

  @Get('coverage')
  @ApiOperation({ summary: 'Get service coverage by state' })
  async getCoverage() {
    return this.geoService.getServiceCoverage();
  }
}
