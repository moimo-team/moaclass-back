import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  Req,
  Query,
  Put,
  ParseIntPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { EnrollmentsService } from './enrollments.service';
import { CreateEnrollmentDto } from './dto/enrollments.dto';
import { Request } from 'express';
import { JwtPayload } from '../../auth/jwt-payload.interface'; // 토큰 payload 타입 정의
import { EnrollmentPageOptionsDto } from './dto/enrollents-page-options.dto';

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
  @Get('me')
  async getMyEnrollments(
    @Req() req: Request & { user: JwtPayload },
    @Query() pageOptions: EnrollmentPageOptionsDto,
  ) {
    const userId = req.user.id;
    return this.enrollmentsService.getMyEnrollments(userId, pageOptions);
  }
  @Get(':id/cancel-info')
  async getCancelInfo(
    @Param('id', new ParseIntPipe()) enrollmentId: number,
    @Req() req: Request & { user: JwtPayload },
  ) {
    const userId = req.user.id;

    return this.enrollmentsService.getCancelInfo(enrollmentId, userId);
  }

  @Put(':id/cancel')
  async cancelEnrollment(
    @Req() req: Request & { user: JwtPayload },
    @Param('id', new ParseIntPipe()) id: number,
    @Body() body: { reason?: string; detailReason?: string },
  ) {
    const userId = req.user.id;
    return this.enrollmentsService.cancelEnrollment(
      id,
      userId,

      body.reason,
      body.detailReason,
    );
  }
}
