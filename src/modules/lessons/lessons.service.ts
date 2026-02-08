import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service'; // PrismaService를 주입받는다고 가정
import { CreateLessonDto, UpdateLessonDto } from './dto/lesson.dto';
import { CreateScheduleDto, UpdateScheduleDto } from './dto/schedule.dto';
import { LessonSchedule, Level, Prisma } from '@prisma/client';
import {
  LessonPageOptionsDto,
  LessonSort,
  LessonDay,
} from './dto/lesson-page-options.dto';

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
  async getLessons(filters: LessonPageOptionsDto) {
    let lessons = await this.prisma.lesson.findMany({
      where: {
        ...(filters.regionId && { regionId: filters.regionId }),
        ...(filters.categoryId && { lessonCategoryId: filters.categoryId }),
        ...(filters.level && { level: filters.level }),
        ...(filters.status && {
          status: filters.status,
        }),
        ...(filters.minParticipants && {
          maxParticipants: { gte: filters.minParticipants },
        }),
        ...(filters.maxParticipants && {
          maxParticipants: { lte: filters.maxParticipants },
        }),
        ...(filters.minPrice && { price: { gte: filters.minPrice } }),
        ...(filters.maxPrice && { price: { lte: filters.maxPrice } }),
      },
      orderBy: (() => {
        switch (filters.sort) {
          case LessonSort.PRICE_ASC:
            return { discountedPrice: 'asc' };
          case LessonSort.PRICE_DESC:
            return { discountedPrice: 'desc' };
          case LessonSort.DEADLINE:
            return { reservationLeadDays: 'asc' };
          case LessonSort.UPDATE:
            return { updatedAt: 'desc' };
          case LessonSort.RATE:
            return { rate: 'desc' };
          case LessonSort.LIKES:
            return { likes: 'desc' };
          default:
            return { createdAt: 'desc' };
        }
      })(),
      include: {
        teacher: { select: { id: true, nickname: true } },
        lessonCategory: true,
        region: true,
        schedules: true,
      },
    }); // 요일 + 시간 범위 필터링 (JS 레벨에서 처리)
    if (filters.days?.length || filters.timeRange) {
      // const [startHour, endHour] = filters.timeRange
      //   ? filters.timeRange.split('-').map(Number)
      //   : [undefined, undefined];

      lessons = lessons.filter((lesson) =>
        lesson.schedules.some((schedule) => {
          const startDate = new Date(schedule.startAt);
          const endDate = new Date(schedule.endAt);

          const day = startDate.getDay(); // 0=일, 6=토
          // const startHourOfLesson = startDate.getHours();
          // const endHourOfLesson = endDate.getHours();

          // 요일 필터
          let dayMatch = true;
          if (filters.days?.length) {
            if (filters.days.includes(LessonDay.WEEKDAY)) {
              dayMatch = day >= 1 && day <= 5;
            } else if (filters.days.includes(LessonDay.SATURDAY)) {
              dayMatch = day === 6;
            } else if (filters.days.includes(LessonDay.WEEKEND)) {
              dayMatch = day === 0 || day === 6;
            }
          }

          // // 시간 범위 필터 (겹치는 시간대 포함)
          // let timeMatch = true;
          // if (startHour !== undefined && endHour !== undefined) {
          //   timeMatch =
          //     startHourOfLesson <= endHour && endHourOfLesson >= startHour;
          //   console.log(startHourOfLesson, endHour, endHourOfLesson, startHour);
          // }

          // return dayMatch && timeMatch;
          return dayMatch;
        }),
      );
    }

    return lessons;
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
