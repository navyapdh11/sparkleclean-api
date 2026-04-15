import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { WEBHOOK_QUEUE } from '../common/events/event.publisher';
import { EventPublisher } from '../common/events/event.publisher';
import { BookingService } from './booking.service';
import { BookingController } from './booking.controller';

@Module({
  imports: [
    BullModule.registerQueue({ name: WEBHOOK_QUEUE }),
  ],
  controllers: [BookingController],
  providers: [BookingService, EventPublisher],
  exports: [BookingService],
})
export class BookingModule {}
