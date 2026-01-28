import {
  Controller,
  Post,
  Body,
  Get,
  Res,
  HttpStatus,
  HttpException,
  Query,
  UseGuards,
  Req,
  Param,
  ParseIntPipe,
  Put,
  Delete,
} from '@nestjs/common';
import * as express from 'express';
import { MeetingsService } from './meetings.service';
import { ParticipationsService } from './participations.service';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { MeetingPageOptionsDto } from './dto/meeting-page-options.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { JwtPayload } from '../../auth/jwt-payload.interface';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadedFile, UseInterceptors } from '@nestjs/common';
import { MyMeetingPageOptionsDto } from './dto/my-meeting-page-options.dto';
import { UpdateMeetingDto } from './dto/update-meeting.dto';
import { MeetingItemDto } from './dto/meeting-item.dto';
import { PageDto } from '../common/dto/page.dto';
import { SearchMeetingDto } from './dto/search-meeting.dto';

@Controller('meetings')
export class MeetingsController {
  constructor(
    private readonly meetingsService: MeetingsService,
    private readonly participationsService: ParticipationsService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('meetingImage'))
  async create(
    @Body() dto: CreateMeetingDto,
    @UploadedFile() file: Express.Multer.File,
    @Res() res: express.Response,
    @Req() req: express.Request & { user: JwtPayload },
  ) {
    try {
      const hostId = req.user.id;

      await this.meetingsService.create(dto, hostId, file);

      return res.status(HttpStatus.CREATED).send();
    } catch (error) {
      if (error instanceof HttpException) {
        const status = error.getStatus();
        return res.status(status).send();
      }
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send();
    }
  }

  @Get()
  async findAll(
    @Res() res: express.Response,
    @Query() pageOptionsDto: MeetingPageOptionsDto,
  ) {
    try {
      const result = await this.meetingsService.findAll(pageOptionsDto);
      return res.status(HttpStatus.OK).json(result);
    } catch (error) {
      if (error instanceof HttpException) {
        return res.status(error.getStatus()).send();
      }
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send();
    }
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMyMeetings(
    @Query() pageOptionsDto: MyMeetingPageOptionsDto,
    @Req() req: express.Request & { user: JwtPayload },
    @Res() res: express.Response,
  ) {
    try {
      const userId = req.user.id;
      const result = await this.meetingsService.getMyMeetings(
        userId,
        pageOptionsDto.status,
        pageOptionsDto.view,
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

  @Get(':id/participants')
  async getParticipants(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: express.Response,
  ) {
    try {
      const result = await this.participationsService.getParticipants(id);
      return res.status(HttpStatus.OK).json(result);
    } catch (error) {
      if (error instanceof HttpException) {
        return res.status(error.getStatus()).json({ message: error.message });
      }
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send();
    }
  }

  @Get('search')
  async search(
    @Query() searchDto: SearchMeetingDto,
  ): Promise<PageDto<MeetingItemDto>> {
    return await this.meetingsService.searchMeetings(searchDto);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: express.Response,
  ) {
    try {
      const result = await this.meetingsService.findOne(id);
      return res.status(HttpStatus.OK).json(result);
    } catch (error) {
      if (error instanceof HttpException)
        return res.status(error.getStatus()).send();
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send();
    }
  }

  @Post(':meetingId/participations')
  @UseGuards(JwtAuthGuard)
  async participate(
    @Param('meetingId', ParseIntPipe) meetingId: number,
    @Req() req: express.Request & { user: JwtPayload },
    @Res() res: express.Response,
  ) {
    try {
      const userId = req.user.id;
      await this.participationsService.createParticipation(meetingId, userId);
      return res.status(HttpStatus.CREATED).send();
    } catch (error) {
      if (error instanceof HttpException)
        return res.status(error.getStatus()).send(error.message);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send();
    }
  }

  @Get(':meetingId/participations')
  @UseGuards(JwtAuthGuard)
  async getApplicants(
    @Param('meetingId', ParseIntPipe) meetingId: number,
    @Req() req: express.Request & { user: JwtPayload },
    @Res() res: express.Response,
  ) {
    try {
      const userId = req.user.id;
      const result = await this.participationsService.findApplicants(
        meetingId,
        userId,
      );
      return res.status(HttpStatus.OK).json(result);
    } catch (error) {
      if (error instanceof HttpException)
        return res.status(error.getStatus()).send();
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send();
    }
  }

  @Put(':meetingId')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('meetingImage'))
  async update(
    @Param('meetingId', ParseIntPipe) meetingId: number,
    @Body() dto: UpdateMeetingDto,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: express.Request & { user: JwtPayload },
    @Res() res: express.Response,
  ) {
    try {
      const userId = req.user.id;

      await this.meetingsService.updateMyMeeting(meetingId, userId, dto, file);

      return res.status(HttpStatus.NO_CONTENT).send();
    } catch (error) {
      if (error instanceof HttpException) {
        return res.status(error.getStatus()).json({ message: error.message });
      }
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send();
    }
  }

  @Delete(':meetingId')
  @UseGuards(JwtAuthGuard)
  async deleteMeeting(
    @Param('meetingId', ParseIntPipe) meetingId: number,
    @Req() req: express.Request & { user: JwtPayload },
    @Res() res: express.Response,
  ) {
    try {
      const userId = req.user.id;
      await this.meetingsService.softDelete(meetingId, userId);

      return res.status(HttpStatus.NO_CONTENT).send();
    } catch (error) {
      if (error instanceof HttpException) {
        return res.status(error.getStatus()).json({ message: error.message });
      }
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send();
    }
  }

  @Put(':meetingId/participations/approve-all')
  @UseGuards(JwtAuthGuard)
  async approveAll(
    @Param('meetingId', ParseIntPipe) meetingId: number,
    @Req() req: express.Request & { user: JwtPayload },
    @Res() res: express.Response,
  ) {
    try {
      await this.participationsService.approveAll(meetingId, req.user.id);

      return res.status(HttpStatus.NO_CONTENT).send();
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        return res.status(error.getStatus()).json({ message: error.message });
      }
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send();
    }
  }

  @Put(':meetingId/participations/:participationId/approve')
  @UseGuards(JwtAuthGuard)
  async approveOne(
    @Param('meetingId', ParseIntPipe) meetingId: number,
    @Param('participationId', ParseIntPipe) participationId: number,
    @Req() req: express.Request & { user: JwtPayload },
    @Res() res: express.Response,
  ) {
    try {
      await this.participationsService.approveOne(
        meetingId,
        req.user.id,
        participationId,
      );
      return res.status(HttpStatus.NO_CONTENT).send();
    } catch (error) {
      if (error instanceof HttpException) {
        return res.status(error.getStatus()).json({ message: error.message });
      }
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send();
    }
  }

  @Put(':meetingId/participations/:participationId/reject')
  @UseGuards(JwtAuthGuard)
  async rejectOne(
    @Param('meetingId', ParseIntPipe) meetingId: number,
    @Param('participationId', ParseIntPipe) participationId: number,
    @Req() req: express.Request & { user: JwtPayload },
    @Res() res: express.Response,
  ) {
    try {
      await this.participationsService.rejectOne(
        meetingId,
        req.user.id,
        participationId,
      );

      return res.status(HttpStatus.NO_CONTENT).send();
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        return res.status(error.getStatus()).json({ message: error.message });
      }
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send();
    }
  }

  @Put(':meetingId/participations/:participationId/cancel-approval')
  @UseGuards(JwtAuthGuard)
  async cancelApproval(
    @Param('meetingId', ParseIntPipe) meetingId: number,
    @Param('participationId', ParseIntPipe) participationId: number,
    @Req() req: express.Request & { user: JwtPayload },
    @Res() res: express.Response,
  ) {
    try {
      await this.participationsService.cancelApproval(
        meetingId,
        req.user.id,
        participationId,
      );

      return res.status(HttpStatus.NO_CONTENT).send();
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        return res.status(error.getStatus()).json({ message: error.message });
      }
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send();
    }
  }

  @Put(':meetingId/participations/:participationId/cancel-rejection')
  @UseGuards(JwtAuthGuard)
  async cancelRejection(
    @Param('meetingId', ParseIntPipe) meetingId: number,
    @Param('participationId', ParseIntPipe) participationId: number,
    @Req() req: express.Request & { user: JwtPayload },
    @Res() res: express.Response,
  ) {
    try {
      await this.participationsService.cancelRejection(
        meetingId,
        req.user.id,
        participationId,
      );

      return res.status(HttpStatus.NO_CONTENT).send();
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        return res.status(error.getStatus()).json({ message: error.message });
      }
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send();
    }
  }
}
