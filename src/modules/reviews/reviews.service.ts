import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadService } from '../upload/upload.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { PageOptionsDto } from '../common/dto/page-options.dto';
import { PageDto } from '../common/dto/page.dto';
import { PageMetaDto } from '../common/dto/page-meta.dto';

type ReviewImageFieldKey =
  | 'image1'
  | 'image2'
  | 'image3'
  | 'image4'
  | 'image5'
  | 'image6'
  | 'image7'
  | 'image8';

type ReviewUploadFiles = Partial<
  Record<ReviewImageFieldKey, Express.Multer.File[]>
>;

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadService: UploadService,
  ) {}

  async create(userId: number, dto: CreateReviewDto, files: ReviewUploadFiles) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: dto.lessonId },
      select: { id: true, status: true },
    });

    if (!lesson || lesson.status === 'DELETED') {
      throw new NotFoundException('리뷰를 등록할 클래스를 찾을 수 없습니다.');
    }

    const orderedKeys: ReviewImageFieldKey[] = [
      'image1',
      'image2',
      'image3',
      'image4',
      'image5',
      'image6',
      'image7',
      'image8',
    ];

    const representativeFile = files.image1?.[0];
    let representativeImage: string | null = null;

    if (representativeFile) {
      representativeImage = await this.uploadService.uploadFile(
        'review',
        representativeFile,
      );
    }

    const reviewImages: Array<{ image: string; sequence: number }> = [];

    for (let i = 1; i < orderedKeys.length; i += 1) {
      const key = orderedKeys[i];
      const file = files[key]?.[0];
      if (!file) continue;

      const imageUrl = await this.uploadService.uploadFile('review', file);
      reviewImages.push({
        image: imageUrl,
        // image2 -> 1, image3 -> 2 ... image8 -> 7
        sequence: i,
      });
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        const review = await tx.review.create({
          data: {
            userId,
            lessonId: dto.lessonId,
            rating: dto.rating,
            content: dto.content,
            representativeImage,
          },
        });

        if (reviewImages.length > 0) {
          await tx.reviewImage.createMany({
            data: reviewImages.map((image) => ({
              reviewId: review.id,
              image: image.image,
              sequence: image.sequence,
            })),
          });
        }
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new NotFoundException('리뷰를 등록할 클래스를 찾을 수 없습니다.');
      }

      throw new InternalServerErrorException(
        '리뷰 등록 중 오류가 발생했습니다.',
      );
    }
  }

  async getLatestReviewsByLesson(
    lessonId: number,
    pageOptionsDto: PageOptionsDto,
  ) {
    const lesson = await this.prisma.lesson.findFirst({
      where: {
        id: lessonId,
        status: { not: 'DELETED' },
      },
      select: { id: true, title: true },
    });

    if (!lesson) {
      throw new NotFoundException('리뷰를 조회할 클래스를 찾을 수 없습니다.');
    }

    const page = pageOptionsDto.page ?? 1;
    const limit = pageOptionsDto.limit ?? 6;
    const skip = (page - 1) * limit;

    try {
      const [totalCount, reviews] = await Promise.all([
        this.prisma.review.count({
          where: { lessonId },
        }),
        this.prisma.review.findMany({
          where: { lessonId },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            images: {
              orderBy: { sequence: 'asc' },
              select: {
                sequence: true,
                image: true,
              },
            },
          },
        }),
      ]);

      const data = reviews.map((review) => {
        const imageMap: Partial<Record<ReviewImageFieldKey, string | null>> = {
          image1: review.representativeImage,
          image2: null,
          image3: null,
          image4: null,
          image5: null,
          image6: null,
          image7: null,
          image8: null,
        };

        review.images.forEach((image) => {
          const keyIndex = image.sequence + 1;
          if (keyIndex < 2 || keyIndex > 8) return;
          const key = `image${keyIndex}` as ReviewImageFieldKey;
          imageMap[key] = image.image;
        });

        return {
          id: review.id,
          lessonId: review.lessonId,
          lessonTitle: lesson.title,
          userId: review.userId,
          rating: review.rating,
          content: review.content,
          ...imageMap,
        };
      });

      return new PageDto(data, new PageMetaDto(totalCount, page, limit));
    } catch {
      throw new InternalServerErrorException(
        '리뷰 조회 중 오류가 발생했습니다.',
      );
    }
  }

  async getLatestReviewsByTeacher(
    teacherUserId: number,
    pageOptionsDto: PageOptionsDto,
  ) {
    const page = pageOptionsDto.page ?? 1;
    const limit = pageOptionsDto.limit ?? 6;
    const skip = (page - 1) * limit;

    try {
      const [totalCount, reviews] = await Promise.all([
        this.prisma.review.count({
          where: {
            lesson: {
              userId: teacherUserId,
              status: { not: 'DELETED' },
            },
          },
        }),
        this.prisma.review.findMany({
          where: {
            lesson: {
              userId: teacherUserId,
              status: { not: 'DELETED' },
            },
          },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            lessonId: true,
            lesson: {
              select: {
                title: true,
              },
            },
            userId: true,
            rating: true,
            content: true,
            representativeImage: true,
          },
        }),
      ]);

      const data = reviews.map((review) => ({
        id: review.id,
        lessonId: review.lessonId,
        lessonTitle: review.lesson.title,
        userId: review.userId,
        rating: review.rating,
        content: review.content,
        representativeImage: review.representativeImage,
      }));

      return new PageDto(data, new PageMetaDto(totalCount, page, limit));
    } catch {
      throw new InternalServerErrorException(
        '리뷰 조회 중 오류가 발생했습니다.',
      );
    }
  }

  async getLatestReviews(pageOptionsDto: PageOptionsDto) {
    const page = pageOptionsDto.page ?? 1;
    const limit = pageOptionsDto.limit ?? 6;
    const skip = (page - 1) * limit;

    try {
      const [totalCount, reviews] = await Promise.all([
        this.prisma.review.count({
          where: {
            lesson: {
              status: { not: 'DELETED' },
            },
          },
        }),
        this.prisma.review.findMany({
          where: {
            lesson: {
              status: { not: 'DELETED' },
            },
          },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            lessonId: true,
            lesson: {
              select: {
                title: true,
              },
            },
            userId: true,
            rating: true,
            content: true,
            representativeImage: true,
          },
        }),
      ]);

      const data = reviews.map((review) => ({
        id: review.id,
        lessonId: review.lessonId,
        lessonTitle: review.lesson.title,
        userId: review.userId,
        rating: review.rating,
        content: review.content,
        representativeImage: review.representativeImage,
      }));

      return new PageDto(data, new PageMetaDto(totalCount, page, limit));
    } catch {
      throw new InternalServerErrorException(
        '리뷰 조회 중 오류가 발생했습니다.',
      );
    }
  }

  async findMyLessonReviewDetail(
    userId: number,
    lessonId: number,
    reviewId: number,
  ) {
    const review = await this.prisma.review.findFirst({
      where: {
        id: reviewId,
        userId,
        lessonId,
      },
      select: {
        id: true,
        lessonId: true,
        lesson: {
          select: {
            title: true,
          },
        },
        rating: true,
        content: true,
        representativeImage: true,
        createdAt: true,
        updatedAt: true,
        images: {
          select: {
            id: true,
            image: true,
            sequence: true,
          },
          orderBy: {
            sequence: 'asc',
          },
        },
      },
    });

    if (!review) {
      throw new NotFoundException('해당 리뷰를 찾을 수 없습니다.');
    }

    const imageMap: Partial<Record<ReviewImageFieldKey, string | null>> = {
      image1: review.representativeImage,
      image2: null,
      image3: null,
      image4: null,
      image5: null,
      image6: null,
      image7: null,
      image8: null,
    };

    review.images.forEach((image) => {
      const keyIndex = image.sequence + 1;
      if (keyIndex < 2 || keyIndex > 8) return;
      const key = `image${keyIndex}` as ReviewImageFieldKey;
      imageMap[key] = image.image;
    });

    return {
      id: review.id,
      lessonId: review.lessonId,
      lessonTitle: review.lesson.title,
      rating: review.rating,
      content: review.content,
      ...imageMap,
    };
  }
}
