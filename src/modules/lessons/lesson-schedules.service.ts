import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateScheduleDto } from './dto/schedule.dto';
import { Prisma, ParticipationStatus } from '@prisma/client';
import { parseSeoulDateTimeToUtc } from './utils/schedule-time.util';

@Injectable()
export class LessonSchedulesService {
  constructor(private readonly prisma: PrismaService) { }

  private async checkOwnership(userId: number, lessonId: number) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { userId: true, durationSec: true, maxParticipants: true },
    });

    if (!lesson) throw new NotFoundException('클래스를 찾을 수 없습니다.');
    if (lesson.userId !== userId) {
      throw new ForbiddenException('본인의 클래스 일정만 관리할 수 있습니다.');
    }

    return lesson;
  }

  async addSchedules(
    userId: number,
    lessonId: number,
    dtos: CreateScheduleDto[],
  ) {
    const lesson = await this.checkOwnership(userId, lessonId);

    if (dtos.length === 0) {
      throw new BadRequestException('최소 1개 이상의 일정을 전달해야 합니다.');
    }

    const rows: Array<{
      lessonId: number;
      startAt: Date;
      endAt: Date;
      currentParticipants: number;
    }> = [];

    dtos.forEach((dto, index) => {
      let startAt: Date;
      let endAt: Date;

      try {
        startAt = parseSeoulDateTimeToUtc(dto.startAt);
        endAt = parseSeoulDateTimeToUtc(dto.endAt);
      } catch {
        throw new BadRequestException(
          `${index + 1}번째 일정의 날짜 형식이 유효하지 않습니다.`,
        );
      }

      if (startAt >= endAt) {
        throw new BadRequestException(
          `${index + 1}번째 일정의 종료 시간은 시작 시간보다 이후여야 합니다.`,
        );
      }

      const durationSec = Math.floor(
        (endAt.getTime() - startAt.getTime()) / 1000,
      );
      if (durationSec !== lesson.durationSec) {
        throw new BadRequestException(
          `${index + 1}번째 일정 시간은 클래스 시간(${Math.floor(
            lesson.durationSec / 60,
          )}분)과 동일해야 합니다.`,
        );
      }

      rows.push({
        lessonId,
        startAt,
        endAt,
        currentParticipants: 0,
      });
    });

    const uniqueTimeKeys = new Set(
      rows.map(
        (row) => `${row.startAt.toISOString()}-${row.endAt.toISOString()}`,
      ),
    );
    if (uniqueTimeKeys.size !== rows.length) {
      throw new BadRequestException(
        '요청 본문에 중복된 일정이 포함되어 있습니다.',
      );
    }

    try {
      await this.prisma.lessonSchedule.createMany({
        data: rows,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundException('연결하려는 클래스를 찾을 수 없습니다.');
        }
        if (error.code === 'P2002') {
          throw new BadRequestException(
            '이미 존재하는 일정이 포함되어 있습니다.',
          );
        }
      }

      throw new InternalServerErrorException(
        '일정 생성 중 오류가 발생했습니다.',
      );
    }
  }

  async deleteSchedule(userId: number, scheduleId: number) {
    const schedule = await this.prisma.lessonSchedule.findUnique({
      where: { id: scheduleId },
      select: {
        lessonId: true,
        currentParticipants: true,
      },
    });

    if (!schedule) {
      throw new NotFoundException('삭제할 일정을 찾을 수 없습니다.');
    }

    await this.checkOwnership(userId, schedule.lessonId);

    if (schedule.currentParticipants > 0) {
      throw new BadRequestException(
        '이미 신청자가 있는 일정은 삭제할 수 없습니다.',
      );
    }

    try {
      await this.prisma.lessonSchedule.delete({
        where: { id: scheduleId },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundException(
            '일정을 삭제하는 도중 대상을 찾을 수 없게 되었습니다.',
          );
        }

        if (error.code === 'P2003') {
          throw new BadRequestException(
            '연관된 데이터가 있어 일정을 삭제할 수 없습니다.',
          );
        }
      }

      throw new InternalServerErrorException(
        '일정 삭제 중 오류가 발생했습니다.',
      );
    }
  }

  async getSchedules(userId: number, lessonId: number) {
    const lesson = await this.checkOwnership(userId, lessonId);

    const schedules = await this.prisma.lessonSchedule.findMany({
      where: { lessonId },
      orderBy: { startAt: 'asc' },
      select: {
        id: true,
        lessonId: true,
        startAt: true,
        endAt: true,
        currentParticipants: true,
        status: true,
        createdAt: true,
      },
    });

    return schedules.map((s) => ({
      ...s,
      maxParticipants: lesson.maxParticipants,
    }));
  }

  async getParticipants(userId: number, scheduleId: number) {
    const schedule = await this.prisma.lessonSchedule.findUnique({
      where: { id: scheduleId },
      select: { lessonId: true },
    });

    if (!schedule) {
      throw new NotFoundException('해당 일정을 찾을 수 없습니다.');
    }

    // 강사 권한 체크
    await this.checkOwnership(userId, schedule.lessonId);

    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        scheduleId,
        status: ParticipationStatus.ACCEPTED,
      },
      include: {
        user: {
          select: {
            id: true,
            nickname: true,
            image: true,
          },
        },
      },
    });

    return enrollments.map((e) => ({
      userId: e.user.id,
      nickname: e.user.nickname,
      profileImage: e.user.image,
    }));
  }
}
