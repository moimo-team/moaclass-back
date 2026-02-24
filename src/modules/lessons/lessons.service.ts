import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateLessonDto, UpdateLessonDto } from './dto/lesson.dto';
import { CreateScheduleDto, UpdateScheduleDto } from './dto/schedule.dto';
import { Prisma } from '@prisma/client';
import {
  LessonPageOptionsDto,
  LessonSort,
  LessonDay,
} from './dto/lesson-page-options.dto';
import { PageDto } from '../common/dto/page.dto';
import { PageMetaDto } from '../common/dto/page-meta.dto';
import { UploadService } from '../upload/upload.service';
import {
  formatScheduleWithSeoulTime,
  parseSeoulDateTimeToUtc,
} from './utils/schedule-time.util';
import axios from 'axios';

interface KakaoAddressDocument {
  x: string;
  y: string;
}

interface KakaoAddressResponse {
  documents: KakaoAddressDocument[];
}

type LessonUploadFiles = {
  image1?: Express.Multer.File[];
  image2?: Express.Multer.File[];
  image3?: Express.Multer.File[];
  image4?: Express.Multer.File[];
  image5?: Express.Multer.File[];
  image6?: Express.Multer.File[];
};

@Injectable()
export class LessonsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadService: UploadService,
  ) { }

  private async resolveCoordinatesFromAddress(address: string) {
    try {
      const kakaoResponse = await axios.get<KakaoAddressResponse>(
        'https://dapi.kakao.com/v2/local/search/address.json',
        {
          params: { query: address },
          headers: {
            Authorization: `KakaoAK ${process.env.KAKAO_REST_API_KEY}`,
          },
        },
      );

      const document = kakaoResponse.data.documents[0];
      if (!document) {
        throw new BadRequestException(
          '입력하신 주소를 찾을 수 없습니다. 도로명 주소를 정확히 입력해 주세요.',
        );
      }

      return {
        latitude: parseFloat(document.y),
        longitude: parseFloat(document.x),
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException(
        '카카오 주소 변환 중 오류가 발생했습니다.',
      );
    }
  }

  async createLesson(
    userId: number,
    dto: CreateLessonDto,
    fileOrFiles?: Express.Multer.File | LessonUploadFiles,
  ) {
    const { latitude, longitude } = await this.resolveCoordinatesFromAddress(
      dto.address,
    );

    const files = this.normalizeCreateFiles(fileOrFiles);
    const representativeFile = files.image1?.[0];
    const detailFiles = [
      files.image2?.[0],
      files.image3?.[0],
      files.image4?.[0],
      files.image5?.[0],
      files.image6?.[0],
    ].filter((file): file is Express.Multer.File => !!file);

    if (representativeFile) {
      const { durationMin, subCategoryIds, ...restDto } = dto;
      const uniqueSubCategoryIds = [...new Set(subCategoryIds)];
      if (uniqueSubCategoryIds.length < 1 || uniqueSubCategoryIds.length > 3) {
        throw new BadRequestException(
          '서브 카테고리는 서로 다른 1개 이상 3개 이하로 선택해야 합니다.',
        );
      }

      const validSubCategories = await this.prisma.lessonSubCategory.findMany({
        where: {
          id: { in: uniqueSubCategoryIds },
          categoryId: dto.lessonCategoryId,
        },
        select: { id: true },
      });

      if (validSubCategories.length !== uniqueSubCategoryIds.length) {
        throw new BadRequestException(
          '선택한 서브 카테고리가 존재하지 않거나 카테고리와 일치하지 않습니다.',
        );
      }

      const representativeImageUrl = await this.uploadService.uploadFile(
        'lesson',
        representativeFile,
      );
      const detailImageUrls = await Promise.all(
        detailFiles.map((detailFile) =>
          this.uploadService.uploadFile('lesson', detailFile),
        ),
      );

      await this.prisma.$transaction(async (tx) => {
        const lesson = await tx.lesson.create({
          data: {
            ...restDto,
            durationSec: durationMin * 60,
            latitude,
            longitude,
            userId,
            status: dto.status ?? 'DRAFT',
            representativeImage: representativeImageUrl,
          },
        });

        await tx.lessonSubCategoryMap.createMany({
          data: uniqueSubCategoryIds.map((subCategoryId) => ({
            lessonId: lesson.id,
            subCategoryId,
          })),
        });

        if (detailImageUrls.length > 0) {
          await tx.lessonImage.createMany({
            data: detailImageUrls.map((image, index) => ({
              lessonId: lesson.id,
              image,
              sequence: index + 1,
            })),
          });
        }
      });
      return;
    }
    throw new BadRequestException('대표 이미지를 업로드해야 합니다.');
  }

  private normalizeCreateFiles(
    fileOrFiles?: Express.Multer.File | LessonUploadFiles,
  ): LessonUploadFiles {
    if (!fileOrFiles) {
      return {};
    }

    if (this.isMulterFile(fileOrFiles)) {
      return { image1: [fileOrFiles] };
    }

    return fileOrFiles;
  }

  private isMulterFile(value: unknown): value is Express.Multer.File {
    return (
      typeof value === 'object' &&
      value !== null &&
      'buffer' in value &&
      'mimetype' in value &&
      'originalname' in value
    );
  }

  async getLessons(filters: LessonPageOptionsDto, userId?: number) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;
    const skip = (page - 1) * limit;
    const trimmedKeyword = filters.keyword?.trim();

    if (filters.isLiked && !userId) {
      return new PageDto([], new PageMetaDto(0, page, limit));
    }

    const where: Prisma.LessonWhereInput = {
      status: {
        in:
          filters.status && filters.status.length > 0
            ? filters.status.filter((status) => status !== 'DELETED')
            : ['ACTIVE'],
      },
      ...(filters.userId && { userId: filters.userId }),
      ...(filters.regionId &&
        filters.regionId.length > 0 && {
        regionId: { in: filters.regionId },
      }),
      ...(filters.categoryId &&
        filters.categoryId.length > 0 && {
        lessonCategoryId: { in: filters.categoryId },
      }),
      ...(trimmedKeyword && {
        OR: [
          { title: { contains: trimmedKeyword, mode: 'insensitive' } },
          {
            lessonCategory: {
              name: { contains: trimmedKeyword, mode: 'insensitive' },
            },
          },
          {
            teacher: {
              nickname: {
                contains: trimmedKeyword,
                mode: 'insensitive',
              },
            },
          },
        ],
      }),
      ...(filters.subCategoryId &&
        filters.subCategoryId.length > 0 && {
        subCategories: {
          some: { subCategoryId: { in: filters.subCategoryId } },
        },
      }),
      ...(filters.level &&
        filters.level.length > 0 && { level: { in: filters.level } }),
      ...(filters.minParticipants && {
        maxParticipants: { gte: filters.minParticipants },
      }),
      ...(filters.maxParticipants && {
        maxParticipants: { lte: filters.maxParticipants },
      }),
      ...(filters.minPrice && { price: { gte: filters.minPrice } }),
      ...(filters.maxPrice && { price: { lte: filters.maxPrice } }),
      ...(filters.isLiked &&
        userId && {
        wishlists: {
          some: { userId },
        },
      }),
    };

    const orderBy: Prisma.LessonOrderByWithRelationInput = (() => {
      switch (filters.sort) {
        case LessonSort.LATEST:
        case LessonSort.NEW:
          return { createdAt: 'desc' };
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
          return { likeCount: 'desc' };
        default:
          return { createdAt: 'desc' };
      }
    })();

    const baseInclude = {
      teacher: { select: { id: true, nickname: true } },
      lessonCategory: { select: { id: true, name: true } },
      region: { select: { id: true, name: true } },
      subCategories: {
        include: {
          subCategory: {
            select: { id: true, name: true },
          },
        },
      },
      schedules: true,
      images: {
        select: { id: true, image: true, sequence: true },
        orderBy: { sequence: 'asc' },
      },
    } as const;

    if (filters.days?.length || filters.timeRange) {
      const lessons = await this.prisma.lesson.findMany({
        where,
        orderBy,
        include: baseInclude,
      });

      const filteredLessons = lessons.filter((lesson) =>
        lesson.schedules.some((schedule) => {
          const startDate = new Date(schedule.startAt);
          const day = startDate.getDay();

          let dayMatch = true;
          if (filters.days?.length) {
            if (filters.days.includes(LessonDay.WEEKDAY)) {
              dayMatch = day >= 1 && day <= 5;
            } else if (filters.days.includes(LessonDay.SATURDAY)) {
              dayMatch = day === 6;
            } else if (filters.days.includes(LessonDay.SUNDAY)) {
              dayMatch = day === 0;
            }
          }

          let timeMatch = true;
          if (filters.timeRange) {
            const [startHour, endHour] = filters.timeRange
              .split('-')
              .map((value) => Number(value));
            if (
              Number.isNaN(startHour) ||
              Number.isNaN(endHour) ||
              startHour < 0 ||
              endHour > 24 ||
              startHour >= endHour
            ) {
              throw new BadRequestException(
                'timeRange는 "시작-종료" 형식(예: 9-12)이며 0~24 범위여야 합니다.',
              );
            }

            const startDate = new Date(schedule.startAt);
            const endDate = new Date(schedule.endAt);
            const lessonStartHour = new Date(
              startDate.getTime() + 9 * 60 * 60 * 1000,
            ).getUTCHours();
            const lessonEndHour = new Date(
              endDate.getTime() + 9 * 60 * 60 * 1000,
            ).getUTCHours();

            timeMatch = lessonStartHour < endHour && lessonEndHour > startHour;
          }

          return dayMatch && timeMatch;
        }),
      );

      const pagedLessons = filteredLessons.slice(skip, skip + limit);
      const likedLessonIdSet = await this.getLikedLessonIdSet(
        userId,
        pagedLessons.map((lesson) => lesson.id),
      );

      const data = pagedLessons.map((lesson) => {
        const {
          durationSec,
          lessonCategory,
          region,
          subCategories,
          ...restLesson
        } = lesson;
        return {
          ...restLesson,
          isLiked: likedLessonIdSet.has(lesson.id),
          durationMin: Math.floor(durationSec / 60),
          lessonCategoryName: lessonCategory.name,
          regionName: region.name,
          subCategories: subCategories.map((item) => ({
            id: item.subCategory.id,
            name: item.subCategory.name,
          })),
          schedules: lesson.schedules.map((schedule) =>
            (schedule),
          ),
          images: [
            { id: 0, image: lesson.representativeImage, sequence: 0 },
            ...(lesson.images || []),
          ],
        };
      });

      return new PageDto(
        data,
        new PageMetaDto(filteredLessons.length, page, limit),
      );
    }

    const [totalCount, lessons] = await Promise.all([
      this.prisma.lesson.count({ where }),
      this.prisma.lesson.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: baseInclude,
      }),
    ]);

    const likedLessonIdSet = await this.getLikedLessonIdSet(
      userId,
      lessons.map((lesson) => lesson.id),
    );

    const data = lessons.map((lesson) => {
      const {
        durationSec,
        lessonCategory,
        region,
        subCategories,
        ...restLesson
      } = lesson;
      return {
        ...restLesson,
        isLiked: likedLessonIdSet.has(lesson.id),
        durationMin: Math.floor(durationSec / 60),
        lessonCategoryName: lessonCategory.name,
        regionName: region.name,
        subCategories: subCategories.map((item) => ({
          id: item.subCategory.id,
          name: item.subCategory.name,
        })),
        schedules: lesson.schedules.map((schedule) =>
          (schedule),
        ),
        images: [
          { id: 0, image: lesson.representativeImage, sequence: 0 },
          ...(lesson.images || []),
        ],
      };
    });

    return new PageDto(data, new PageMetaDto(totalCount, page, limit));
  }

  async getLessonDetail(lessonId: number, userId?: number) {
    const lesson = await this.prisma.lesson.findFirst({
      where: {
        id: lessonId,
        status: { not: 'DELETED' },
      },
      include: {
        teacher: { select: { id: true, nickname: true, image: true } },
        lessonCategory: { select: { id: true, name: true } },
        region: { select: { id: true, name: true } },
        subCategories: {
          include: {
            subCategory: {
              select: { id: true, name: true },
            },
          },
        },
        schedules: {
          select: {
            id: true,
            startAt: true,
            endAt: true,
            currentParticipants: true,
            status: true,
          },
          orderBy: { startAt: 'asc' },
        },
        images: {
          select: { id: true, image: true, sequence: true },
          orderBy: { sequence: 'asc' },
        },
        reviews: {
          select: {
            id: true,
            rating: true,
            content: true,
            representativeImage: true,
            createdAt: true,
            user: { select: { id: true, nickname: true } },
            images: {
              select: { id: true, image: true, sequence: true },
              orderBy: { sequence: 'asc' },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!lesson) {
      throw new NotFoundException(`Lesson with id ${lessonId} not found`);
    }

    const likedLessonIdSet = await this.getLikedLessonIdSet(userId, [
      lesson.id,
    ]);
    const {
      durationSec,
      lessonCategory,
      region,
      subCategories,
      ...restLesson
    } = lesson;
    return {
      ...restLesson,
      isLiked: likedLessonIdSet.has(lesson.id),
      durationMin: Math.floor(durationSec / 60),
      lessonCategoryName: lessonCategory.name,
      regionName: region.name,
      subCategories: subCategories.map((item) => ({
        id: item.subCategory.id,
        name: item.subCategory.name,
      })),
      schedules: lesson.schedules.map((schedule) =>
        (schedule),
      ),
      images: [
        { id: 0, image: lesson.representativeImage, sequence: 0 },
        ...(lesson.images || []),
      ],
    };
  }

  async updateLesson(
    userId: number,
    lessonId: number,
    dto: UpdateLessonDto,
    fileOrFiles?: Express.Multer.File | LessonUploadFiles,
  ) {
    const existingLesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: {
        userId: true,
        address: true,
        lessonCategoryId: true,
      },
    });

    if (!existingLesson) {
      throw new NotFoundException('해당 클래스를 찾을 수 없습니다.');
    }

    if (existingLesson.userId !== userId) {
      throw new ForbiddenException('본인의 클래스만 수정할 수 있습니다.');
    }

    const {
      durationMin,
      subCategoryIds,
      address,
      removeSequences,
      ...restDto
    } = dto;

    const nextCategoryId =
      dto.lessonCategoryId ?? existingLesson.lessonCategoryId;

    if (dto.lessonCategoryId !== undefined && subCategoryIds === undefined) {
      throw new BadRequestException(
        '카테고리를 변경하려면 해당 카테고리의 서브 카테고리(1~3개)를 함께 전달해야 합니다.',
      );
    }

    let nextSubCategoryIds: number[] | undefined;
    if (subCategoryIds !== undefined) {
      nextSubCategoryIds = [...new Set(subCategoryIds)];
      if (nextSubCategoryIds.length < 1 || nextSubCategoryIds.length > 3) {
        throw new BadRequestException(
          '서브 카테고리는 서로 다른 1개 이상 3개 이하로 선택해야 합니다.',
        );
      }

      const validSubCategories = await this.prisma.lessonSubCategory.findMany({
        where: {
          id: { in: nextSubCategoryIds },
          categoryId: nextCategoryId,
        },
        select: { id: true },
      });

      if (validSubCategories.length !== nextSubCategoryIds.length) {
        throw new BadRequestException(
          '선택한 서브 카테고리가 존재하지 않거나 카테고리와 일치하지 않습니다.',
        );
      }
    }

    const files = this.normalizeCreateFiles(fileOrFiles);
    const removeSequenceSet = new Set(removeSequences ?? []);

    const representativeFile = files.image1?.[0];
    let nextRepresentativeImage: string | undefined;
    if (representativeFile) {
      nextRepresentativeImage = await this.uploadService.uploadFile(
        'lesson',
        representativeFile,
      );
    } else if (removeSequenceSet.has(1)) {
      nextRepresentativeImage = '';
    }

    type DetailImageMutation = {
      mode: 'create' | 'update' | 'delete';
      id?: number;
      sequence: number;
      image?: string;
    };

    const existingDetailImages = await this.prisma.lessonImage.findMany({
      where: {
        lessonId,
        sequence: { in: [1, 2, 3, 4, 5] },
      },
      orderBy: { id: 'asc' },
    });

    const existingBySequence = new Map<
      number,
      (typeof existingDetailImages)[0]
    >();
    for (const image of existingDetailImages) {
      if (!existingBySequence.has(image.sequence)) {
        existingBySequence.set(image.sequence, image);
      }
    }

    const detailKeys: Array<
      'image2' | 'image3' | 'image4' | 'image5' | 'image6'
    > = ['image2', 'image3', 'image4', 'image5', 'image6'];
    const imageMutations: DetailImageMutation[] = [];

    for (let i = 0; i < detailKeys.length; i += 1) {
      const key = detailKeys[i];
      const slot = i + 2;
      const sequence = slot - 1;
      const file = files[key]?.[0];
      const existing = existingBySequence.get(sequence);

      if (file) {
        const imageUrl = await this.uploadService.uploadFile('lesson', file);
        if (existing) {
          imageMutations.push({
            mode: 'update',
            id: existing.id,
            sequence,
            image: imageUrl,
          });
        } else {
          imageMutations.push({
            mode: 'create',
            sequence,
            image: imageUrl,
          });
        }
        continue;
      }

      if (removeSequenceSet.has(slot) && existing) {
        imageMutations.push({
          mode: 'delete',
          id: existing.id,
          sequence,
        });
      }
    }

    const nextAddress = address ?? existingLesson.address;
    const shouldRefreshCoordinates = address !== undefined;
    const coordinates = shouldRefreshCoordinates
      ? await this.resolveCoordinatesFromAddress(nextAddress)
      : null;

    await this.prisma.$transaction(async (tx) => {
      const lessonUpdateData: Prisma.LessonUncheckedUpdateInput = {
        ...restDto,
        ...(address !== undefined && { address }),
        ...(durationMin !== undefined && { durationSec: durationMin * 60 }),
        ...(coordinates && {
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
        }),
        ...(nextRepresentativeImage !== undefined && {
          representativeImage: nextRepresentativeImage,
        }),
      };

      await tx.lesson.update({
        where: { id: lessonId },
        data: lessonUpdateData,
      });

      if (nextSubCategoryIds !== undefined) {
        await tx.lessonSubCategoryMap.deleteMany({
          where: { lessonId },
        });

        await tx.lessonSubCategoryMap.createMany({
          data: nextSubCategoryIds.map((subCategoryId) => ({
            lessonId,
            subCategoryId,
          })),
        });
      }

      for (const mutation of imageMutations) {
        if (mutation.mode === 'delete' && mutation.id !== undefined) {
          await tx.lessonImage.delete({
            where: { id: mutation.id },
          });
          continue;
        }

        if (
          mutation.mode === 'update' &&
          mutation.id !== undefined &&
          mutation.image
        ) {
          await tx.lessonImage.update({
            where: { id: mutation.id },
            data: { image: mutation.image },
          });
          continue;
        }

        if (mutation.mode === 'create' && mutation.image) {
          await tx.lessonImage.create({
            data: {
              lessonId,
              sequence: mutation.sequence,
              image: mutation.image,
            },
          });
        }
      }
    });
    return;
  }

  async softDeleteLesson(userId: number, lessonId: number) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { userId: true },
    });

    if (!lesson) {
      throw new NotFoundException('해당 클래스를 찾을 수 없습니다.');
    }

    if (lesson.userId !== userId) {
      throw new ForbiddenException('본인의 클래스만 삭제할 수 있습니다.');
    }

    await this.prisma.lesson.update({
      where: { id: lessonId },
      data: {
        deletedAt: new Date(),
        status: 'DELETED',
      },
    });
    return;
  }

  async uploadImage(lessonId: string, file: Express.Multer.File) {
    const imageUrl = `uploads/${file.originalname}`;

    return this.prisma.lessonImage.create({
      data: {
        lessonId: Number(lessonId),
        image: imageUrl,
        sequence: 0,
      },
    });
  }

  async deleteImage(imageId: string) {
    return this.prisma.lessonImage.delete({
      where: { id: Number(imageId) },
    });
  }

  private async getLikedLessonIdSet(
    userId: number | undefined,
    lessonIds: number[],
  ): Promise<Set<number>> {
    if (!userId || lessonIds.length === 0) {
      return new Set<number>();
    }

    const wishlists = await this.prisma.wishlist.findMany({
      where: {
        userId,
        lessonId: { in: lessonIds },
      },
      select: { lessonId: true },
    });

    return new Set(wishlists.map((wishlist) => wishlist.lessonId));
  }
}
export function toLessonScheduleCreateInput(
  lessonId: string,
  dto: CreateScheduleDto,
): Prisma.LessonScheduleCreateInput {
  return {
    lesson: {
      connect: { id: Number(lessonId) },
    },
    startAt: new Date(dto.startAt),
    endAt: new Date(dto.endAt),
    currentParticipants: 0,
  };
}

export function toLessonScheduleUpdateInput(
  dto: UpdateScheduleDto,
): Prisma.LessonScheduleUpdateInput {
  return {
    ...(dto.startAt && { startAt: new Date(dto.startAt) }),
    ...(dto.endAt && { endAt: new Date(dto.endAt) }),
    ...(dto.status && { status: dto.status }),
  };
}
