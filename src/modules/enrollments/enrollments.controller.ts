import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { EnrollmentsService } from './enrollments.service';
import { CreateEnrollmentDto } from './dto/enrollments.dto';
import { Request } from 'express';
import { JwtPayload } from '../../auth/jwt-payload.interface'; // 토큰 payload 타입 정의
import { PageOptionsDto } from '../common/dto/page-options.dto';

@Controller('enrollments')
@UseGuards(JwtAuthGuard)
export class EnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  // 수강 신청
  @Post()
  async createEnrollment(
    @Req() req: Request & { user: JwtPayload },
    @Body() dto: CreateEnrollmentDto,
  ) {
    const userId = req.user.id;
    return this.enrollmentsService.createEnrollment(userId, dto);
  }

  // 내가 신청한 클래스 목록 조회 (페이지네이션 + 상태 필터링)
  @Get('my')
  async getMyEnrollments(
    @Req() req: Request & { user: JwtPayload },
    @Query() pageOptions: PageOptionsDto,
  ) {
    const userId = req.user.id;
    return this.enrollmentsService.getMyEnrollments(userId, pageOptions);
  }

  @Patch(':id/cancel')
  async cancelEnrollment(
    @Req() req: Request & { user: JwtPayload },
    @Param('id') id: string,
  ) {
    const userId = req.user.id;
    return this.enrollmentsService.cancelEnrollment(userId, Number(id));
  }
}
