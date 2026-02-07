import { Controller, Post, Body, UseGuards, Req, Res, HttpStatus, HttpException, Delete } from '@nestjs/common';
import * as express from 'express';
import { LikesService } from './likes.service';
import { CreateLikeDto } from './dto/create-like.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { JwtPayload } from '../../auth/jwt-payload.interface';

@Controller('likes')
export class LikesController {
  constructor(private readonly likesService: LikesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @Body() dto: CreateLikeDto,
    @Req() req: express.Request & { user: JwtPayload },
    @Res() res: express.Response,
  ) {
    try {
      const userId = req.user.id;
      await this.likesService.create(userId, dto.lessonId);
      
      return res.status(HttpStatus.CREATED).send();
    } catch (error) {
      if (error instanceof HttpException) {
        return res.status(error.getStatus()).json({ message: error.message });
      }
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send();
    }
  }

  @Delete()
    @UseGuards(JwtAuthGuard)
    async remove(
    @Body() dto: CreateLikeDto,
    @Req() req: express.Request & { user: JwtPayload },
    @Res() res: express.Response,
    ) {
    try {
        const userId = req.user.id;
        await this.likesService.remove(userId, dto.lessonId);
        
        return res.status(HttpStatus.NO_CONTENT).send();
    } catch (error) {
        if (error instanceof HttpException) {
        return res.status(error.getStatus()).json({ message: error.message });
        }
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send();
    }
    }
}