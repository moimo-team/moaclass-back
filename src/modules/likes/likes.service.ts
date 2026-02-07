import { Injectable, InternalServerErrorException, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class LikesService {
  constructor(private prisma: PrismaService) {}

  async create(userId: number, lessonId: number) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
    });

    if (!lesson) {
      throw new NotFoundException('존재하지 않는 클래스입니다.');
    }

    try {
      return await this.prisma.wishlist.create({
        data: {
          userId: userId,
          lessonId: lessonId,
        },
      });
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException('이미 위시리스트에 추가된 클래스입니다.');
      }
      throw new InternalServerErrorException('위시리스트 추가 중 오류가 발생했습니다.');
    }
  }
}