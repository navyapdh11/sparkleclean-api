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
import { PaymentModule } from './payment/payment.module';
import { XeroModule } from './xero/xero.module';
import { CleanerAssignmentModule } from './cleaner-assignment/cleaner-assignment.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),

    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
      },
    }),

    ScheduleModule.forRoot(),

    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET ?? 'sparkle-clean-dev-secret-change-in-prod',
      signOptions: { expiresIn: process.env.JWT_EXPIRES ?? '24h' },
    }),

    PrismaModule,

    // Phase 2 modules
    AuthModule,
    BookingModule,
    PricingModule,
    GeoModule,
    ContentModule,
    WebhookModule,

    // Phase 3 modules
    PaymentModule,
    XeroModule,
    CleanerAssignmentModule,
    AdminModule,
  ],
})
export class AppModule {}
