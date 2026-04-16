import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from '../common/config/prisma.service';

@ApiTags('health')
@Controller()
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Get('health')
  @ApiOperation({ summary: 'Health check — returns ok if DB is connected' })
  async health() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', database: 'connected', timestamp: new Date().toISOString() };
    } catch {
      return { status: 'degraded', database: 'disconnected', timestamp: new Date().toISOString() };
    }
  }

  @Get()
  @ApiOperation({ summary: 'Root — redirects to Swagger docs' })
  root() {
    return {
      name: 'SparkleClean Pro API',
      version: '0.1.0',
      docs: '/api/docs',
      health: '/health',
    };
  }
}
