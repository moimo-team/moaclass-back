import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import multer from 'multer';
import * as express from 'express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { JwtPayload } from '../../auth/jwt-payload.interface';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewsService } from './reviews.service';
import { PageOptionsDto } from '../common/dto/page-options.dto';

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

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  async getLatestReviews(
    @Query() pageOptionsDto: PageOptionsDto,
    @Res() res: express.Response,
  ) {
    try {
      const result = await this.reviewsService.getLatestReviews(pageOptionsDto);
      return res.status(HttpStatus.OK).json(result);
    } catch (error) {
      if (error instanceof HttpException) {
        return res.status(error.getStatus()).send();
      }
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send();
    }
  }

  @Get('me/lessons/:lessonId/:reviewId')
  @UseGuards(JwtAuthGuard)
  async findMyLessonReviewDetail(
    @Req() req: express.Request & { user: JwtPayload },
    @Param('lessonId', ParseIntPipe) lessonId: number,
    @Param('reviewId', ParseIntPipe) reviewId: number,
    @Res() res: express.Response,
  ) {
    try {
      const userId = req.user.id;
      const review = await this.reviewsService.findMyLessonReviewDetail(
        userId,
        lessonId,
        reviewId,
      );
      return res.status(HttpStatus.OK).json(review);
    } catch (error) {
      if (error instanceof HttpException) {
        return res.status(error.getStatus()).send();
      }
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send();
    }
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'image1', maxCount: 1 },
        { name: 'image2', maxCount: 1 },
        { name: 'image3', maxCount: 1 },
        { name: 'image4', maxCount: 1 },
        { name: 'image5', maxCount: 1 },
        { name: 'image6', maxCount: 1 },
        { name: 'image7', maxCount: 1 },
        { name: 'image8', maxCount: 1 },
      ],
      { storage: multer.memoryStorage() },
    ),
  )
  async create(
    @Body() dto: CreateReviewDto,
    @Req() req: express.Request & { user: JwtPayload },
    @UploadedFiles() files: ReviewUploadFiles,
    @Res() res: express.Response,
  ) {
    try {
      const userId = req.user.id;
      await this.reviewsService.create(userId, dto, files ?? {});
      return res.status(HttpStatus.CREATED).send();
    } catch (error) {
      if (error instanceof HttpException) {
        return res.status(error.getStatus()).send();
      }
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send();
    }
  }
}
