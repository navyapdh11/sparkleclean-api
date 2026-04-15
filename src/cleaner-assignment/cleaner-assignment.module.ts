import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { WEBHOOK_QUEUE } from '../common/events/event.publisher';
import { EventPublisher } from '../common/events/event.publisher';
import { CleanerAssignmentService } from './cleaner-assignment.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: WEBHOOK_QUEUE }),
  ],
  providers: [CleanerAssignmentService, EventPublisher],
  exports: [CleanerAssignmentService],
})
export class CleanerAssignmentModule {}
