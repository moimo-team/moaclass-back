import {
  Injectable,
  ConflictException,
  InternalServerErrorException,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  GoneException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { TokenExpiredError } from 'jsonwebtoken';
import axios from 'axios';
import { User } from '@prisma/client';
import { UpdateExtraInfoDto } from './dto/update-extra-info.dto';
import 'dotenv/config';
import type { JwtPayload } from '../../auth/jwt-payload.interface';
import type { Bucket, File } from '@google-cloud/storage';
import { MailsService } from '../mails/mails.service';
import { UploadService } from '../upload/upload.service';

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
  id_token?: string;
}
interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
  locale: string;
}
export interface ResetTokenPayload {
  email: string;
  code: string;
  purpose: 'password_reset';
  exp: number;
  iat?: number;
}
@Injectable()
export class UsersService {
  private bucket: Bucket;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private readonly mailService: MailsService,
    private uploadService: UploadService,
  ) {}

  async registerUser(
    nickname: string,
    email: string,
    password: string,
  ): Promise<{ accessToken: string; refreshToken: string; user: any }> {
    try {
      const checkEmail = await this.isEmailAvailable(email);
      if (!checkEmail) {
        throw new ConflictException('이미 존재하는 이메일입니다.');
      }

      const checkNickname = await this.isNicknameAvailable(nickname);
      if (!checkNickname) {
        throw new ConflictException('이미 존재하는 닉네임입니다.');
      }

      const hashedPassword: string = await bcrypt.hash(password, 10);

      const created = await this.prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          nickname,
        },
      });

      // 🔹 회원가입 직후 토큰 발급
      const refreshToken = await this.issueOrRefreshToken(created);
      const accessToken = this.issueAccessToken(created);

      return {
        accessToken,
        refreshToken,
        user: {
          isNewUser: !created.bio,
          email: created.email,
          nickname: created.nickname,
        },
      };
    } catch (err: unknown) {
      if (err instanceof ConflictException) {
        throw err;
      }
      if (err instanceof Error) {
        console.error('회원가입 에러:', err.message);
      } else {
        console.error('회원가입 에러: 알 수 없는 타입', err);
      }
      throw new InternalServerErrorException(
        '회원가입 처리 중 오류가 발생했습니다.',
      );
    }
  }

  async findAll(): Promise<User[]> {
    return await this.prisma.user.findMany();
  }

  // 🔹 구글 로그인
  async loginWithGoogle(
    code: string,
    redirectUri: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    user: { isNewUser: boolean; email: string; nickname: string };
  }> {
    try {
      const tokenRes = await axios.post<GoogleTokenResponse>(
        'https://oauth2.googleapis.com/token',
        {
          code,
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        },
        { headers: { 'Content-Type': 'application/json' } },
      );

      const googleAccessToken = tokenRes.data.access_token;

      const userInfoRes = await axios.get<GoogleUserInfo>(
        'https://www.googleapis.com/oauth2/v2/userinfo',
        { headers: { Authorization: `Bearer ${googleAccessToken}` } },
      );

      const { email, name, id: googleSubId } = userInfoRes.data;

      let user = await this.prisma.user.findUnique({ where: { email } });

      if (!user) {
        user = await this.prisma.user.create({
          data: { email, nickname: name },
        });

        await this.prisma.socialAccount.create({
          data: { googleSubId, userId: user.id },
        });
      }

      const refreshToken = await this.issueOrRefreshToken(user);
      const accessToken = this.issueAccessToken(user);

      return {
        accessToken,
        refreshToken,
        user: {
          isNewUser: !user.bio,
          email: user.email,
          nickname: user.nickname,
        },
      };
    } catch (err: any) {
      throw new InternalServerErrorException(`구글 로그인 실패: ${err}`);
    }
  }

  // 🔹 일반 로그인
  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) {
      throw new UnauthorizedException(
        '이메일 또는 비밀번호가 올바르지 않습니다.',
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException(
        '이메일 또는 비밀번호가 올바르지 않습니다.',
      );
    }

    const refreshToken = await this.issueOrRefreshToken(user);
    const accessToken = this.issueAccessToken(user);

    return {
      accessToken,
      refreshToken,
      user: {
        isNewUser: !user.bio,
        email: user.email,
        nickname: user.nickname,
      },
    };
  }

  async updateUser(
    userId: number,
    dto: UpdateExtraInfoDto,
    file?: Express.Multer.File,
  ) {
    if (!userId) throw new Error('User ID is missing');

    if (dto.nickname) {
      const exists = await this.prisma.user.findFirst({
        where: { nickname: dto.nickname, id: { not: userId } },
        select: { id: true },
      });
      if (exists) throw new ConflictException('Nickname already in use');
    }

    let imageUrl: string | undefined;
    console.log(file);

    if (file) {
      imageUrl = await this.uploadService.uploadFile('profile', file);
    }

    const userBaseUpdate = await this.prisma.user.update({
      where: { id: userId },
      data: {
        nickname: dto.nickname,
        bio: dto.bio,
        ...(imageUrl ? { image: imageUrl } : {}),
      },
      select: {
        id: true,
        email: true,
        nickname: true,
        bio: true,
        image: true,
      },
    });

    if (dto.interests && dto.interests.length > 0) {
      const validInterests = await this.prisma.interest.findMany({
        where: { id: { in: dto.interests } },
        select: { id: true },
      });
      const validIds = new Set(validInterests.map((i) => i.id));

      const currentLinks = await this.prisma.userInterest.findMany({
        where: { userId },
        select: { id: true, interestId: true },
      });

      const desired = Array.from(validIds);

      const toDelete = currentLinks
        .filter((link) => !validIds.has(link.interestId))
        .map((link) => link.id);

      const currentIds = new Set(currentLinks.map((l) => l.interestId));
      const toAdd = desired.filter((id) => !currentIds.has(id));

      await this.prisma.$transaction([
        ...(toDelete.length
          ? [
              this.prisma.userInterest.deleteMany({
                where: { id: { in: toDelete } },
              }),
            ]
          : []),
        ...toAdd.map((interestId) =>
          this.prisma.userInterest.create({
            data: { userId, interestId },
          }),
        ),
      ]);
    }

    const interests = await this.prisma.userInterest.findMany({
      where: { userId },
      include: { interest: true },
    });

    return {
      id: userBaseUpdate.id,
      email: userBaseUpdate.email,
      nickname: userBaseUpdate.nickname,
      bio: userBaseUpdate.bio,
      image: userBaseUpdate.image,
      interests: interests.map((i) => ({
        id: i.interestId,
        name: i.interest.name,
      })),
    };
  }

  async findById(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      return [];
    }
    const interests = await this.prisma.userInterest.findMany({
      where: { userId },
      include: { interest: true },
    });
    return {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      bio: user.bio,
      profileImage: user.image,
      interests: interests.map((i) => ({
        id: i.interestId,
        name: i.interest.name,
      })),
    };
  }

  async isNicknameAvailable(nickname: string): Promise<boolean> {
    const existing = await this.prisma.user.findUnique({
      where: { nickname },
    });

    return !existing;
  }

  async isEmailAvailable(email: string): Promise<boolean> {
    const existing = await this.prisma.user.findFirst({
      where: { email },
    });

    return !existing;
  }

  async refreshAccessToken(refreshToken: string) {
    try {
      const { email } = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: process.env.JWT_SECRET,
      });

      const user = await this.prisma.user.findUnique({
        where: { email },
      });
      if (!user || user.refreshToken !== refreshToken) {
        throw new UnauthorizedException('유효하지 않은 Refresh 토큰입니다.');
      }

      const newAccessToken = this.jwtService.sign(
        { id: user.id, email: user.email },
        { secret: process.env.JWT_SECRET, expiresIn: '1h' },
      );

      return { accessToken: newAccessToken, refreshToken };
    } catch (err) {
      if (err instanceof TokenExpiredError) {
        const decoded = this.jwtService.decode<JwtPayload | null>(refreshToken);
        if (!decoded || typeof decoded === 'string') {
          throw new UnauthorizedException('Refresh token decode 실패');
        }
        const { id, email } = decoded;
        const newRefreshToken = this.jwtService.sign(
          { id, email },
          { secret: process.env.JWT_SECRET, expiresIn: '7d' },
        );

        await this.prisma.user.update({
          where: { id },
          data: { refreshToken: newRefreshToken },
        });

        const newAccessToken = this.jwtService.sign(
          { id, email },
          { secret: process.env.JWT_SECRET, expiresIn: '1h' },
        );

        return { accessToken: newAccessToken, refreshToken: newRefreshToken };
      }

      throw new UnauthorizedException('Refresh 토큰 검증 실패');
    }
  }

  async requestPasswordReset(email: string) {
    const user: User | null = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new NotFoundException();
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();

    const expiresIn = 3 * 60;

    const resetToken = this.jwtService.sign(
      {
        email,
        code,
        purpose: 'password_reset',
      },
      { secret: process.env.JWT_SECRET, expiresIn: expiresIn },
    );

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
      },
    });

    await this.mailService.sendResetCode(email, code);

    return { code };
  }

  async verifyPasswordResetCode(email: string, code: string) {
    const user: User | null = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.resetToken) {
      throw new BadRequestException('No reset token found');
    }

    let payload: ResetTokenPayload;
    try {
      payload = this.jwtService.verify<ResetTokenPayload>(user.resetToken, {
        secret: process.env.JWT_SECRET,
      });
    } catch (err) {
      console.error(err);
      throw new GoneException();
    }

    if (payload.email !== email) {
      throw new BadRequestException('Email does not match');
    }
    if (payload.code !== code) {
      throw new BadRequestException('Invalid verification code');

      //코드가 틀리면 DB에 resetToken 삭제? 어떻게 처리할까
    }

    return { resetToken: user.resetToken };
  }

  async confirmPasswordReset(resetToken: string, newPassword: string) {
    let payload: ResetTokenPayload;
    try {
      payload = this.jwtService.verify<ResetTokenPayload>(resetToken, {
        secret: process.env.JWT_SECRET,
      });
    } catch (err) {
      console.error(err);

      throw new BadRequestException();
    }

    if (payload.purpose != 'password_reset') {
      throw new BadRequestException();
    }

    const user = await this.prisma.user.findUnique({
      where: { email: payload.email },
    });
    if (!user) {
      throw new NotFoundException();
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
      },
    });

    return;
  }

  generateAccessToken(payload: any) {
    return this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: '15m', // accessToken은 짧게
    });
  }

  generateRefreshToken(payload: any) {
    return this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: '7d', // refreshToken은 길게
    });
  }

  async verifyUser(id: number) {
    console.log(id);
    const user = await this.prisma.user.findUnique({
      where: { id },
    });
    console.log(user, '유저');

    if (!user) {
      return {
        authenticated: false,
      };
    }
    const currentLinks = await this.prisma.userInterest.findMany({
      where: { userId: id },
      select: { interestId: true },
    });
    const currentIds = currentLinks.map((l) => l.interestId);
    // interest 테이블에서 조회
    const interests = await this.prisma.interest.findMany({
      where: {
        id: { in: currentIds },
      },
    });

    return {
      authenticated: true,
      isNewUser: !user.bio,
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      bio: user.bio,
      profileImage: user.image,
      interests,
    };
  }

  private async issueOrRefreshToken(user: User): Promise<string> {
    let refreshToken = user.refreshToken;
    if (!refreshToken) {
      refreshToken = this.jwtService.sign(
        { id: user.id, email: user.email },
        { secret: process.env.JWT_SECRET, expiresIn: '7d' },
      );
      await this.prisma.user.update({
        where: { id: user.id },
        data: { refreshToken },
      });
    } else {
      try {
        this.jwtService.verify(refreshToken, {
          secret: process.env.JWT_SECRET,
        });
      } catch (err) {
        if (err instanceof TokenExpiredError) {
          refreshToken = this.jwtService.sign(
            { id: user.id, email: user.email },
            { secret: process.env.JWT_SECRET, expiresIn: '7d' },
          );
          await this.prisma.user.update({
            where: { id: user.id },
            data: { refreshToken },
          });
        } else {
          throw new UnauthorizedException('유효하지 않은 Refresh 토큰입니다.');
        }
      }
    }
    return refreshToken;
  }

  private issueAccessToken(user: User): string {
    return this.jwtService.sign(
      { id: user.id, email: user.email },
      { secret: process.env.JWT_SECRET, expiresIn: '1h' },
    );
  }
}
