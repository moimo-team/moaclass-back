import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMomentoDto } from './dto/create-momento.dto';
import { UploadService } from '../upload/upload.service';
import { UpdateMomentoDto } from './dto/update-momento.dto';

@Injectable()
export class MomentoesService {
  constructor(
    private prisma: PrismaService,
    private readonly uploadService: UploadService,
  ) {}

  async create(
    dto: CreateMomentoDto,
    userId: number,
    file?: Express.Multer.File,
  ) {
    let imageUrl: string | null = null;

    // 1. 파일 업로드 처리
    if (file) {
      try {
        imageUrl = await this.uploadService.uploadFile('momento', file);
      } catch {
        throw new InternalServerErrorException(
          '이미지 업로드 중 오류가 발생했습니다.',
        );
      }
    }
    if (!imageUrl) {
      throw new BadRequestException(
        '모멘토 등록을 위해 프로필 이미지는 필수입니다.',
      );
    }

    // 2. DB 저장
    try {
      return await this.prisma.teacherProfile.create({
        data: {
          nickname: dto.nickname,
          image: imageUrl,
          introduction: dto.introduction,
          userId: userId,
        },
      });
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException(
          '이미 사용 중인 닉네임이거나 이미 등록된 유저입니다.',
        );
      }
      throw new InternalServerErrorException(
        '모멘토 생성 중 오류가 발생했습니다.',
      );
    }
  }

  async update(
    userId: number,
    dto: UpdateMomentoDto,
    file?: Express.Multer.File,
  ) {
    // 1. 기존 프로필 존재 여부 확인
    const profile = await this.prisma.teacherProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('수정할 모멘토 프로필을 찾을 수 없습니다.');
    }

    let imageUrl = profile.image;

    // 2. 새로운 파일이 업로드된 경우 처리
    if (file) {
      try {
        imageUrl = await this.uploadService.uploadFile('momento', file);
      } catch {
        throw new InternalServerErrorException(
          '이미지 업로드 중 오류가 발생했습니다.',
        );
      }
    }

    // 3. DB 업데이트
    try {
      await this.prisma.teacherProfile.update({
        where: { userId },
        data: {
          nickname: dto.nickname,
          image: imageUrl,
          introduction: dto.introduction,
        },
      });
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException('이미 사용 중인 닉네임입니다.');
      }
      throw new InternalServerErrorException(
        '모멘토 수정 중 오류가 발생했습니다.',
      );
    }
  }

  async remove(userId: number) {
    // 1. 삭제할 프로필이 존재하는지 먼저 확인
    const profile = await this.prisma.teacherProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('삭제할 모멘토 프로필이 존재하지 않습니다.');
    }

    // 2. DB에서 프로필 삭제
    try {
      await this.prisma.teacherProfile.delete({
        where: { userId },
      });
    } catch (error) {
      // P2025: 삭제할 레코드를 찾지 못했을 때 발생하는 Prisma 에러 코드
      if (error.code === 'P2025') {
        throw new NotFoundException(
          '이미 삭제되었거나 존재하지 않는 프로필입니다.',
        );
      }
      throw new InternalServerErrorException(
        '모멘토 삭제 중 오류가 발생했습니다.',
      );
    }
  }
}
