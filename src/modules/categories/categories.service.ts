import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CategoryItemDto } from './dto/category-item.dto';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async findAll(): Promise<CategoryItemDto[]> {
    try {
      return await this.prisma.lessonCategory.findMany({
        select: {
          id: true,
          name: true,
        },
        orderBy: {
          id: 'asc',
        },
      });
    } catch {
      throw new InternalServerErrorException(
        '카테고리 목록을 불러오는 중 오류가 발생했습니다.',
      );
    }
  }

  async findSubCategories(
    lessonCategoryId: number,
  ): Promise<CategoryItemDto[]> {
    try {
      return await this.prisma.lessonSubCategory.findMany({
        where: {
          categoryId: lessonCategoryId,
        },
        select: {
          id: true,
          name: true,
        },
        orderBy: {
          id: 'asc',
        },
      });
    } catch {
      throw new InternalServerErrorException(
        '소분류 목록을 불러오는 중 오류가 발생했습니다.',
      );
    }
  }
}
