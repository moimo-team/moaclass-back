import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  Res,
  HttpStatus,
  HttpException,
  UseInterceptors,
  UploadedFile,
  Put,
  Delete,
} from '@nestjs/common';
import * as express from 'express';
import { MomentoesService } from './momentoes.service';
import { CreateMomentoDto } from './dto/create-momento.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { JwtPayload } from '../../auth/jwt-payload.interface';
import { FileInterceptor } from '@nestjs/platform-express';
import { UpdateMomentoDto } from './dto/update-momento.dto';

@Controller('momentoes')
export class MomentoesController {
  constructor(private readonly momentoesService: MomentoesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('image')) // Postman의 Key 이름을 'image'로 설정
  async create(
    @Body() dto: CreateMomentoDto,
    @UploadedFile() file: Express.Multer.File,
    @Res() res: express.Response,
    @Req() req: express.Request & { user: JwtPayload }, // 기존 Meeting과 동일한 방식
  ) {
    try {
      const userId = req.user.id;

      await this.momentoesService.create(dto, userId, file);

      // 성공 시 201 Created 응답 반환
      return res.status(HttpStatus.CREATED).send();
    } catch (error) {
      if (error instanceof HttpException) {
        const status = error.getStatus();
        return res.status(status).send();
      }
      // 예상치 못한 에러 시 500 반환
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send();
    }
  }

  @Put()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('image'))
  async update(
    @Body() dto: UpdateMomentoDto,
    @UploadedFile() file: Express.Multer.File,
    @Res() res: express.Response,
    @Req() req: express.Request & { user: JwtPayload },
  ) {
    try {
      const userId = req.user.id;
      await this.momentoesService.update(userId, dto, file);
      return res.status(HttpStatus.NO_CONTENT).send();
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
    @Res() res: express.Response,
    @Req() req: express.Request & { user: JwtPayload },
  ) {
    try {
      const userId = req.user.id;
      await this.momentoesService.remove(userId);

      // 성공 시 204 No Content 반환
      return res.status(HttpStatus.NO_CONTENT).send();
    } catch (error) {
      if (error instanceof HttpException) {
        return res.status(error.getStatus()).json({ message: error.message });
      }
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send();
    }
  }
}
