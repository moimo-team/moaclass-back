import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMomentoDto } from './dto/create-momento.dto';
import { UploadService } from '../upload/upload.service';
import { UpdateMomentoDto } from './dto/update-momento.dto';

@Injectable()
export class MomentoesService {
  constructor(
    private prisma: PrismaService,
    private readonly uploadService: UploadService,
  ) { }

  async create(
    dto: CreateMomentoDto,
    userId: number,
    file?: Express.Multer.File,
  ) {
    let imageUrl: string | null = null;

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
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
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
    const profile = await this.prisma.teacherProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('수정할 모멘토 프로필을 찾을 수 없습니다.');
    }

    let imageUrl = profile.image;

    if (file) {
      try {
        imageUrl = await this.uploadService.uploadFile('momento', file);
      } catch {
        throw new InternalServerErrorException(
          '이미지 업로드 중 오류가 발생했습니다.',
        );
      }
    }

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
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('이미 사용 중인 닉네임입니다.');
      }
      throw new InternalServerErrorException(
        '모멘토 수정 중 오류가 발생했습니다.',
      );
    }
  }

  async remove(userId: number) {
    const profile = await this.prisma.teacherProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('삭제할 모멘토 프로필이 존재하지 않습니다.');
    }

    try {
      await this.prisma.teacherProfile.delete({
        where: { userId },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(
          '이미 삭제되었거나 존재하지 않는 프로필입니다.',
        );
      }
      throw new InternalServerErrorException(
        '모멘토 삭제 중 오류가 발생했습니다.',
      );
    }
  }

  async findByUserId(userId: number) {
    return this.findTeacherProfileView(userId);
  }

  private async findTeacherProfileView(userId: number) {
    const profile = await this.prisma.teacherProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        nickname: true,
        introduction: true,
      },
    });

    if (!profile) {
      throw new NotFoundException('선생님 프로필을 찾을 수 없습니다.');
    }

    return {
      id: profile.id,
      nickname: profile.nickname,
      introduction: profile.introduction,
    };
  }
}
