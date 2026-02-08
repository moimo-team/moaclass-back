import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service'; // PrismaService를 주입받는다고 가정
import { CreateLessonDto, UpdateLessonDto } from './dto/lesson.dto';
import { CreateScheduleDto, UpdateScheduleDto } from './dto/schedule.dto';
import { LessonSchedule, Level, Prisma } from '@prisma/client';

@Injectable()
export class LessonsService {
  constructor(private readonly prisma: PrismaService) {}

  async createLesson(dto: CreateLessonDto) {
    const { teacherId, lessonCategoryId, regionId, ...rest } = dto;

    return await this.prisma.lesson.create({
      data: {
        teacher: { connect: { id: teacherId } },
        lessonCategory: { connect: { id: lessonCategoryId } },
        region: { connect: { id: regionId } },
        ...rest, // 나머지 일반 필드들은 그대로 펼치기
      },
    });
  }
  // 클래스 목록 조회
  async getLessons(filters: {
    categoryId?: number;
    regionId?: number;
    level?: string;
    search?: string;
  }) {
    return this.prisma.lesson.findMany({
      where: {
        ...(filters.categoryId && { lessonCategoryId: filters.categoryId }),
        ...(filters.regionId && { regionId: filters.regionId }),
        ...(filters.level && { level: filters.level as Level }),
        ...(filters.search && {
          OR: [
            { title: { contains: filters.search } },
            { description: { contains: filters.search } },
          ],
        }),
      },
      include: {
        lessonCategory: true,
        region: true,
        teacher: true,
      },
    });
  }

  // 클래스 상세 조회
  async getLessonDetail(lessonId: number) {
    return this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        lessonCategory: true,
        region: true,
        teacher: true,
        schedules: true,
        images: true,
        reviews: true,
      },
    });
  }

  // 클래스 수정
  async updateLesson(lessonId: string, dto: UpdateLessonDto) {
    return this.prisma.lesson.update({
      where: { id: Number(lessonId) },
      data: {
        ...dto,
      },
    });
  }

  // 클래스 삭제 (soft delete)
  async softDeleteLesson(lessonId: string) {
    return this.prisma.lesson.update({
      where: { id: Number(lessonId) },
      data: {
        deletedAt: new Date(),
        status: 'DELETED', // 필요하다면 상태도 변경
      },
    });
  }

  // 일정 추가
  async addSchedule(
    lessonId: string,
    dto: CreateScheduleDto,
  ): Promise<LessonSchedule> {
    const data = toLessonScheduleCreateInput(lessonId, dto);
    return await this.prisma.lessonSchedule.create({ data });
  }

  // 일정 수정
  async updateSchedule(
    scheduleId: string,
    dto: UpdateScheduleDto,
  ): Promise<LessonSchedule> {
    const data = toLessonScheduleUpdateInput(dto);
    return await this.prisma.lessonSchedule.update({
      where: { id: Number(scheduleId) },
      data,
    });
  }

  // 일정 삭제
  async deleteSchedule(scheduleId: string) {
    return this.prisma.lessonSchedule.delete({
      where: { id: Number(scheduleId) },
    });
  }

  // 갤러리 이미지 업로드
  async uploadImage(lessonId: string, file: Express.Multer.File) {
    // file.buffer를 S3 같은 스토리지에 업로드 후 URL을 저장하는 방식이 일반적
    const imageUrl = `uploads/${file.originalname}`; // 예시: 실제 구현에서는 업로드 로직 필요

    return this.prisma.lessonImage.create({
      data: {
        lessonId: Number(lessonId),
        image: imageUrl,
        sequence: 0, // 필요 시 순서 지정
      },
    });
  }

  // 갤러리 이미지 삭제
  async deleteImage(imageId: string) {
    return this.prisma.lessonImage.delete({
      where: { id: Number(imageId) },
    });
  }
}
export function toLessonScheduleCreateInput(
  lessonId: string,
  dto: CreateScheduleDto,
): Prisma.LessonScheduleCreateInput {
  return {
    lesson: {
      connect: { id: Number(lessonId) }, // relation 연결
    },
    startAt: new Date(dto.startAt), // string → Date 변환
    endAt: new Date(dto.endAt),
    status: dto.status ?? undefined, // 선택적 필드 처리
    currentParticipants: dto.currentParticipants ?? undefined,
  };
}

export function toLessonScheduleUpdateInput(
  dto: UpdateScheduleDto,
): Prisma.LessonScheduleUpdateInput {
  return {
    ...(dto.startAt && { startAt: new Date(dto.startAt) }),
    ...(dto.endAt && { endAt: new Date(dto.endAt) }),
    ...(dto.status && { status: dto.status }),
    ...(dto.currentParticipants !== undefined && {
      currentParticipants: dto.currentParticipants,
    }),
  };
}
