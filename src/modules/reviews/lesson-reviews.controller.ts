import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  ParseIntPipe,
  Query,
  Res,
} from '@nestjs/common';
import * as express from 'express';
import { PageOptionsDto } from '../common/dto/page-options.dto';
import { ReviewsService } from './reviews.service';

@Controller('lessons')
export class LessonReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get(':lessonId/reviews')
  async getLatestReviewsByLesson(
    @Param('lessonId', ParseIntPipe) lessonId: number,
    @Query() pageOptionsDto: PageOptionsDto,
    @Res() res: express.Response,
  ) {
    try {
      const result = await this.reviewsService.getLatestReviewsByLesson(
        lessonId,
        pageOptionsDto,
      );
      return res.status(HttpStatus.OK).json(result);
    } catch (error) {
      if (error instanceof HttpException) {
        return res.status(error.getStatus()).send();
      }
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send();
    }
  }
}
