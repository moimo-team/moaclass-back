// src/modules/interests/interests.service.ts
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Interest } from '@prisma/client';

@Injectable()
export class InterestsService {
  constructor(private prisma: PrismaService) {}

  async findAll(): Promise<Interest[]> {
    try {
      return await this.prisma.interest.findMany({
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
        '관심사 목록을 불러오는 중 오류가 발생했습니다.',
      );
    }
  }
}
