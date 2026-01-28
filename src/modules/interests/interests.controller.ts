// src/modules/interests/interests.controller.ts
import { Controller, Get } from '@nestjs/common';
import { InterestsService } from './interests.service';
import { Interest } from '@prisma/client';

@Controller('interests')
export class InterestsController {
  constructor(private readonly interestsService: InterestsService) {}

  @Get()
  async findAll(): Promise<Interest[]> {
    return this.interestsService.findAll();
  }
}
