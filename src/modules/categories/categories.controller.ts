import { Controller, Get } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CategoryItemDto } from './dto/category-item.dto';

@Controller('lesson-categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  async findAll(): Promise<CategoryItemDto[]> {
    return this.categoriesService.findAll();
  }
}
