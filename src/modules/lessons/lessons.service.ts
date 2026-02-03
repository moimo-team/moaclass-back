import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateLessonIntroductionDto } from './dto/create-lesson-introduction.dto';

@Injectable()
export class LessonsService {
  constructor(private prisma: PrismaService) {}

  async createIntroduction(
    dto: CreateLessonIntroductionDto,
    teacherId: number,
    representativeImageUrl: string | undefined,
    classImageUrls: string[],
  ) {
    // 입력값 검증
    if (!representativeImageUrl) {
      throw new BadRequestException('대표 이미지는 필수입니다.');
    }

    if (classImageUrls.length === 0) {
      throw new BadRequestException(
        '클래스 이미지는 최소 1개 이상이어야 합니다.',
      );
    }

    // 카테고리 및 서브카테고리 존재 여부 확인
    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
    });

    if (!category) {
      throw new BadRequestException('유효하지 않은 카테고리 ID입니다.');
    }

    const subCategory = await this.prisma.subCategory.findUnique({
      where: { id: dto.subCategoryId },
    });

    if (!subCategory || subCategory.categoryId !== dto.categoryId) {
      throw new BadRequestException('유효하지 않은 서브카테고리 ID입니다.');
    }

    try {
      // Lesson 생성
      const lesson = await this.prisma.lesson.create({
        data: {
          teacherId,
          title: dto.title,
          largeCategoryId: dto.categoryId,
          description: dto.description,
          level: dto.level,
          durationMin: dto.duration,
          curriculum: dto.curriculum,
          representativeImage: representativeImageUrl,
          status: 'DRAFT', // 초기 상태는 임시저장
        },
      });

      // 대표 이미지 저장 (classImages에 포함)
      const allImages = [representativeImageUrl, ...classImageUrls];
      const imageDatas = allImages.map((imageUrl, index) => ({
        lessonId: lesson.id,
        imageUrl,
        sequence: index + 1,
      }));

      await this.prisma.lessonImage.createMany({
        data: imageDatas,
      });

      // 서브카테고리 매핑 저장
      await this.prisma.lessonSubCategory.create({
        data: {
          lessonId: lesson.id,
          subCategoryId: dto.subCategoryId,
        },
      });

      return {
        id: lesson.id,
        title: lesson.title,
        status: lesson.status,
      };
    } catch {
      throw new BadRequestException('클래스 등록 중 오류가 발생했습니다.');
    }
  }
}
