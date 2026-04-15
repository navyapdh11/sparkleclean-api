import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './common/config/prisma.module';
import { AuthModule } from './auth/auth.module';
import { BookingModule } from './booking/booking.module';
import { PricingModule } from './pricing/pricing.module';
import { GeoModule } from './geo/geo.module';
import { ContentModule } from './content/content.module';
import { WebhookModule } from './webhook/webhook.module';

@Module({
  imports: [
    // Env
    ConfigModule.forRoot({ isGlobal: true }),

    // Rate limiting: 60 req/min global, 100 for auth
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 60,
    }]),

    // BullMQ / Redis for webhook retries & async jobs
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
      },
    }),

    // Cron for recurring booking generation
    ScheduleModule.forRoot(),

    // JWT defaults
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET ?? 'sparkle-clean-dev-secret-change-in-prod',
      signOptions: { expiresIn: process.env.JWT_EXPIRES ?? '24h' },
    }),

    // Prisma (singleton)
    PrismaModule,

    // Feature modules
    AuthModule,
    BookingModule,
    PricingModule,
    GeoModule,
    ContentModule,
    WebhookModule,
  ],
})
export class AppModule {}
