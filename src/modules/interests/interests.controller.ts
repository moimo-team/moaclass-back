import { Controller, Get } from '@nestjs/common';
import { InterestsService } from './interests.service';
import { MeetingCategory } from '@prisma/client';

@Controller('interests')
export class InterestsController {
  constructor(private readonly interestsService: InterestsService) {}

  @Get()
  async findAll(): Promise<MeetingCategory[]> {
    return this.interestsService.findAll();
  }
}
