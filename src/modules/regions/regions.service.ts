import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CategoryItemDto } from '../common/dto/category-item.dto';

@Injectable()
export class RegionsService {
  constructor(private prisma: PrismaService) {}

  async findAll(): Promise<CategoryItemDto[]> {
    try {
      return await this.prisma.region.findMany({
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
        '지역 목록을 불러오는 중 오류가 발생했습니다.',
      );
    }
  }
}
