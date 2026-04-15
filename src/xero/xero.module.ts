import { Module } from '@nestjs/common';
import { XeroService } from './xero.service';

@Module({
  providers: [XeroService],
  exports: [XeroService],
})
export class XeroModule {}
