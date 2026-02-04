import { Controller, Get } from '@nestjs/common';
import { RegionsService } from './regions.service';
import { CategoryItemDto } from '../common/dto/category-item.dto';

@Controller('regions')
export class RegionsController {
  constructor(private readonly regionsService: RegionsService) {}

  @Get()
  async findAll(): Promise<CategoryItemDto[]> {
    return this.regionsService.findAll();
  }
}
