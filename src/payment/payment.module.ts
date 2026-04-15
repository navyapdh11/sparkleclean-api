import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { WEBHOOK_QUEUE } from '../common/events/event.publisher';
import { EventPublisher } from '../common/events/event.publisher';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';

@Module({
  imports: [
    BullModule.registerQueue({ name: WEBHOOK_QUEUE }),
  ],
  controllers: [PaymentController],
  providers: [PaymentService, EventPublisher],
  exports: [PaymentService],
})
export class PaymentModule {}
