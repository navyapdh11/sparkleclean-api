import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { WebhookProcessor, WEBHOOK_QUEUE } from './webhook.processor';

@Module({
  imports: [
    BullModule.registerQueue({ name: WEBHOOK_QUEUE }),
  ],
  providers: [WebhookProcessor],
  exports: [],
})
export class WebhookModule {}
