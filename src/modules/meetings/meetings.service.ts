import {
  Injectable,
  InternalServerErrorException,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  GoneException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import {
  MeetingPageOptionsDto,
  MeetingSort,
} from './dto/meeting-page-options.dto';
import { NotificationType, ParticipationStatus, Prisma } from '@prisma/client';
import axios from 'axios';
import { PageDto } from '../common/dto/page.dto';
import { PageMetaDto } from '../common/dto/page-meta.dto';
import { MeetingItemDto, MyMeetingDto } from './dto/meeting-item.dto';
import { UploadService } from '../upload/upload.service';
import { UpdateMeetingDto } from './dto/update-meeting.dto';
import { SearchMeetingDto } from './dto/search-meeting.dto';

interface KakaoAddressDocument {
  x: string;
  y: string;
  address_name: string;
}

interface KakaoAddressResponse {
  documents: KakaoAddressDocument[];
}

@Injectable()
export class MeetingsService {
  constructor(
    private prisma: PrismaService,
    private readonly uploadService: UploadService,
  ) {}

  async create(
    dto: CreateMeetingDto,
    hostId: number,
    file?: Express.Multer.File,
  ) {
    let latitude: number;
    let longitude: number;
    let imageUrl: string | null = null;

    if (file) {
      try {
        imageUrl = await this.uploadService.uploadFile('meeting', file);
      } catch {
        throw new InternalServerErrorException(
          '이미지 업로드 중 오류가 발생했습니다.',
        );
      }
    }

    try {
      const kakaoResponse = await axios.get<KakaoAddressResponse>(
        'https://dapi.kakao.com/v2/local/search/address.json',
        {
          params: { query: dto.address },
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

      longitude = parseFloat(document.x);
      latitude = parseFloat(document.y);
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException(
        '카카오 주소 변환 중 오류가 발생했습니다.',
      );
    }

    return await this.prisma.$transaction(async (tx) => {
      const meeting = await tx.meeting.create({
        data: {
          title: dto.title,
          description: dto.description,
          maxParticipants: Number(dto.maxParticipants),
          meetingDate: new Date(`${dto.meetingDate}+09:00`),
          interestId: Number(dto.interestId),
          address: dto.address,
          latitude: latitude,
          longitude: longitude,
          image: imageUrl,
          hostId: hostId,
          currentParticipants: 1,
        },
      });

      await tx.participation.create({
        data: {
          meetingId: meeting.id,
          userId: hostId,
          status: 'ACCEPTED',
        },
      });

      return meeting;
    });
  }

  async updateMyMeeting(
    meetingId: number,
    userId: number,
    dto: UpdateMeetingDto,
    file?: Express.Multer.File,
  ) {
    const existingMeeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
    });

    if (!existingMeeting || existingMeeting.meetingDeleted) {
      throw new NotFoundException('해당 모임을 찾을 수 없습니다.');
    }

    if (existingMeeting.hostId !== userId) {
      throw new ForbiddenException('모임 수정 권한이 없습니다.');
    }

    if (
      dto.maxParticipants &&
      dto.maxParticipants < existingMeeting.currentParticipants
    ) {
      throw new BadRequestException(
        `최대 인원은 현재 참여 인원(${existingMeeting.currentParticipants}명)보다 적을 수 없습니다.`,
      );
    }

    let imageUrl = existingMeeting.image;
    let latitude = existingMeeting.latitude;
    let longitude = existingMeeting.longitude;

    if (file) {
      imageUrl = await this.uploadService.uploadFile('meeting', file);
    }

    if (dto.address && dto.address !== existingMeeting.address) {
      try {
        const kakaoResponse = await axios.get<KakaoAddressResponse>(
          'https://dapi.kakao.com/v2/local/search/address.json',
          {
            params: { query: dto.address },
            headers: {
              Authorization: `KakaoAK ${process.env.KAKAO_REST_API_KEY}`,
            },
          },
        );
        const document = kakaoResponse.data.documents[0];
        if (document) {
          longitude = parseFloat(document.x);
          latitude = parseFloat(document.y);
        }
      } catch {
        throw new InternalServerErrorException(
          '주소 변환 중 오류가 발생했습니다.',
        );
      }
    }

    try {
      await this.prisma.meeting.update({
        where: { id: meetingId },
        data: {
          title: dto.title,
          description: dto.description,
          interestId: dto.interestId ? Number(dto.interestId) : undefined,
          maxParticipants: dto.maxParticipants
            ? Number(dto.maxParticipants)
            : undefined,
          meetingDate: dto.meetingDate
            ? new Date(`${dto.meetingDate}+09:00`)
            : undefined,
          address: dto.address,
          latitude,
          longitude,
          image: imageUrl,
        },
      });
      return;
    } catch {
      throw new InternalServerErrorException(
        '모임 정보 수정 중 오류가 발생했습니다.',
      );
    }
  }

  async findAll(dto: MeetingPageOptionsDto): Promise<PageDto<MeetingItemDto>> {
    const {
      page = 1,
      limit = 10,
      sort = MeetingSort.NEW,
      interestFilter = 'ALL',
      finishedFilter = false,
    } = dto;

    const skip = (page - 1) * limit;
    const where: Prisma.MeetingWhereInput = {};

    where.meetingDeleted = false;

    if (!finishedFilter) {
      where.meetingDate = { gte: new Date() };
    }

    if (interestFilter && interestFilter !== 'ALL') {
      where.interestId = Number(interestFilter);
    }

    let orderBy: Prisma.MeetingOrderByWithRelationInput;

    switch (sort) {
      case MeetingSort.UPDATE:
        orderBy = { updatedAt: 'desc' };
        break;
      case MeetingSort.DEADLINE:
        orderBy = { meetingDate: 'asc' };
        break;
      case MeetingSort.NEW:
      default:
        orderBy = { createdAt: 'desc' };
    }

    try {
      const [totalCount, meetings] = await Promise.all([
        this.prisma.meeting.count({ where }),
        this.prisma.meeting.findMany({
          where,
          skip: skip,
          take: limit,
          orderBy: orderBy,
          include: {
            interest: { select: { name: true } },
          },
        }),
      ]);

      const mappedData: MeetingItemDto[] = meetings.map((meeting) => {
        const kstMeetingDate = new Date(
          meeting.meetingDate.getTime() + 9 * 60 * 60 * 1000,
        );
        const formattedDate = kstMeetingDate.toISOString().split('.')[0];

        return {
          meetingId: meeting.id,
          title: meeting.title,
          meetingImage: meeting.image,
          interestName: meeting.interest.name,
          maxParticipants: meeting.maxParticipants,
          currentParticipants: meeting.currentParticipants,
          address: meeting.address,
          meetingDate: formattedDate,
        };
      });

      return new PageDto(mappedData, new PageMetaDto(totalCount, page, limit));
    } catch {
      throw new InternalServerErrorException(
        '모임 목록을 가져오는 중 오류가 발생했습니다.',
      );
    }
  }

  async findOne(id: number) {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id },
      include: {
        host: {
          select: {
            nickname: true,
            bio: true,
            image: true,
          },
        },
        interest: true,
      },
    });

    if (!meeting) {
      throw new NotFoundException('해당 모임을 찾을 수 없습니다.');
    }

    if (meeting.meetingDeleted) {
      throw new GoneException('삭제된 모임입니다.');
    }

    const kstMeetingDate = new Date(
      meeting.meetingDate.getTime() + 9 * 60 * 60 * 1000,
    );

    const formattedDate = kstMeetingDate.toISOString().split('.')[0];

    return {
      meetingId: meeting.id,
      title: meeting.title,
      meetingImage: meeting.image,
      description: meeting.description,
      interestId: meeting.interestId,
      maxParticipants: meeting.maxParticipants,
      currentParticipants: meeting.currentParticipants,
      meetingDate: formattedDate,
      location: {
        address: meeting.address,
        lat: meeting.latitude,
        lng: meeting.longitude,
      },
      host: {
        hostId: meeting.hostId,
        nickname: meeting.host.nickname,
        bio: meeting.host.bio || '',
        hostImage: meeting.host.image,
      },
    };
  }

  async getMyMeetings(
    userId: number,
    statusQuery: string = 'all',
    viewQuery: string = 'all',
    dto: MeetingPageOptionsDto,
  ): Promise<PageDto<MyMeetingDto>> {
    const { page = 1, limit = 10 } = dto;
    const skip = (page - 1) * limit;
    const now = new Date();

    const conditions: Prisma.MeetingWhereInput[] = [{ meetingDeleted: false }];
    if (viewQuery === 'hosted') {
      conditions.push({ hostId: userId });
    } else if (viewQuery === 'joined') {
      conditions.push({
        hostId: { not: userId },
        participations: { some: { userId } },
      });
    } else {
      conditions.push({ participations: { some: { userId } } });
    }

    if (statusQuery === 'pending') {
      conditions.push({
        participations: { some: { userId, status: 'PENDING' } },
      });
    } else if (statusQuery === 'accepted') {
      conditions.push({ meetingDate: { gte: now } });
      conditions.push({
        participations: { some: { userId, status: 'ACCEPTED' } },
      });
    } else if (statusQuery === 'completed') {
      conditions.push({ meetingDate: { lt: now } });
      conditions.push({
        participations: { some: { userId, status: 'ACCEPTED' } },
      });
    }

    const where: Prisma.MeetingWhereInput = { AND: conditions };

    try {
      const [totalCount, meetings] = await Promise.all([
        this.prisma.meeting.count({ where }),
        this.prisma.meeting.findMany({
          where,
          skip,
          take: limit,
          include: {
            participations: {
              where: { userId },
              select: { status: true },
            },
          },
          orderBy: { meetingDate: 'desc' },
        }),
      ]);

      const mappedData: MyMeetingDto[] = meetings.map((m) => {
        const isHost = m.hostId === userId;
        const isCompleted = m.meetingDate < now;
        const myStatus = isHost
          ? 'ACCEPTED'
          : m.participations[0]?.status || 'PENDING';

        const kstMeetingDate = new Date(
          m.meetingDate.getTime() + 9 * 60 * 60 * 1000,
        );

        const formattedDate = kstMeetingDate.toISOString().split('.')[0];

        return {
          meetingId: m.id,
          title: m.title,
          meetingImage: m.image,
          maxParticipants: m.maxParticipants,
          currentParticipants: m.currentParticipants,
          address: m.address,
          meetingDate: formattedDate,
          status: myStatus,
          isHost,
          isCompleted,
        };
      });

      return new PageDto(mappedData, new PageMetaDto(totalCount, page, limit));
    } catch {
      throw new InternalServerErrorException(
        '내 모임 목록을 가져오는 중 오류가 발생했습니다.',
      );
    }
  }

  async softDelete(meetingId: number, userId: number) {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        participations: {
          where: {
            status: ParticipationStatus.ACCEPTED,
          },
          select: { userId: true },
        },
      },
    });

    if (!meeting) {
      throw new NotFoundException('해당 모임을 찾을 수 없습니다.');
    }

    if (meeting.meetingDeleted) {
      throw new GoneException('이미 삭제된 모임입니다.');
    }

    if (meeting.hostId !== userId) {
      throw new ForbiddenException('모임 주최자만 삭제할 수 있습니다.');
    }

    const now = new Date();
    if (meeting.meetingDate < now) {
      throw new BadRequestException('이미 종료된 모임은 삭제할 수 없습니다.');
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.meeting.update({
          where: { id: meetingId },
          data: { meetingDeleted: true },
        });

        const notifications = meeting.participations
          .filter((p) => p.userId !== userId)
          .map((p) => ({
            receiverId: p.userId,
            senderId: userId,
            meetingId: meetingId,
            type: NotificationType.MEETING_DELETED,
          }));

        if (notifications.length > 0) {
          await tx.notification.createMany({
            data: notifications,
          });
        }
      });
    } catch {
      throw new InternalServerErrorException(
        '모임 삭제 및 알림 처리 중 오류가 발생했습니다.',
      );
    }
  }

  async searchMeetings(
    searchDto: SearchMeetingDto,
  ): Promise<PageDto<MeetingItemDto>> {
    const { keyword, page = 1, limit = 10 } = searchDto;
    const now = new Date();
    const skip = (page - 1) * limit;

    const whereCondition: Prisma.MeetingWhereInput = {
      meetingDeleted: false,
      meetingDate: {
        gte: now,
      },
      OR: [
        { title: { contains: keyword, mode: 'insensitive' } },
        { interest: { name: { contains: keyword, mode: 'insensitive' } } },
        { host: { nickname: { contains: keyword, mode: 'insensitive' } } },
      ],
    };

    const totalCount = await this.prisma.meeting.count({
      where: whereCondition,
    });

    const meetings = await this.prisma.meeting.findMany({
      where: whereCondition,
      skip: skip,
      take: limit,
      include: {
        interest: true,
        host: {
          select: {
            nickname: true,
          },
        },
      },
      orderBy: {
        meetingDate: 'asc',
      },
    });

    const data: MeetingItemDto[] = meetings.map((m) => {
      const kstMeetingDate = new Date(
        m.meetingDate.getTime() + 9 * 60 * 60 * 1000,
      );
      const formattedDate = kstMeetingDate.toISOString().split('.')[0];

      return {
        meetingId: m.id,
        title: m.title,
        meetingImage: m.image,
        interestName: m.interest.name,
        currentParticipants: m.currentParticipants,
        maxParticipants: m.maxParticipants,
        meetingDate: formattedDate,
        address: m.address,
        hostNickname: m.host.nickname,
      };
    });

    const pageMetaDto = new PageMetaDto(totalCount, page, limit);
    return new PageDto(data, pageMetaDto);
  }
}
