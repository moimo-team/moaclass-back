import {
  Injectable,
  ConflictException,
  InternalServerErrorException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
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
import { CouponsService } from '../coupons/coupons.service';

type UserResponse = {
  email: string;
  nickname: string | null;
  isNewUser: boolean;
};

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

interface KakaoTokenResponse {
  access_token: string;
  token_type: string; // 항상 "bearer"
  refresh_token: string;
  expires_in: number; // access_token 만료 시간(초)
  scope?: string; // 부여된 권한 범위 (옵션)
  refresh_token_expires_in: number; // refresh_token 만료 시간(초)
}

interface KakaoUserInfo {
  id: number; // 카카오 고유 사용자 ID
  connected_at?: string; // 연결 시각
  kakao_account?: {
    profile_needs_agreement?: boolean;
    profile?: {
      nickname?: string;
      thumbnail_image_url?: string;
      profile_image_url?: string;
    };
    email_needs_agreement?: boolean;
    is_email_valid?: boolean;
    is_email_verified?: boolean;
    email?: string;
  };
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
    private couponsService: CouponsService,
  ) { }

  async registerUser(
    nickname: string,
    email: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    user: UserResponse;
  }> {
    try {
      const checkEmail = await this.isEmailAvailable(email);
      if (!checkEmail) {
        throw new ConflictException('이미 존재하는 이메일입니다.');
      }

      const checkNickname = await this.isNicknameAvailable(nickname);
      if (!checkNickname) {
        throw new ConflictException('이미 존재하는 닉네임입니다.');
      }

      const created = await this.prisma.user.create({
        data: {
          email,
          nickname,
          provider: 'KAKAO',
          providerId: `test_${email}`,
        },
      });

      // 🔹 회원가입 직후 토큰 발급
      const refreshToken = await this.issueOrRefreshToken(created);
      const accessToken = this.issueAccessToken(created);

      // ✅ NEW: 신규 사용자 환영 쿠폰 발급 (비동기)
      this.couponsService.issueWelcomeCoupon(created.id).catch((err) => {
        console.error(`사용자 ${created.id}의 환영 쿠폰 발급 실패:`, err.message);
      });

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
    user: { isNewUser: boolean; email: string; nickname: string | null };
  }> {
    try {
      // 1. 구글 토큰 발급
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

      // 2. 구글 사용자 정보 가져오기
      const userInfoRes = await axios.get<GoogleUserInfo>(
        'https://www.googleapis.com/oauth2/v2/userinfo',
        { headers: { Authorization: `Bearer ${googleAccessToken}` } },
      );

      const { email, name, id: googleSubId, picture } = userInfoRes.data;

      // 3. DB에서 유저 찾기 (provider + providerId 기준)
      let user = await this.prisma.user.findUnique({
        where: { providerId: googleSubId },
      });

      // 4. 없으면 새로 생성
      if (!user) {
        user = await this.prisma.user.create({
          data: {
            email,
            nickname: name,
            provider: 'GOOGLE',
            providerId: googleSubId,
            image: picture, // 구글 프로필 이미지 저장 가능
          },
        });

        // ✅ NEW: 신규 사용자 환영 쿠폰 발급 (비동기, 실패해도 무시)
        const newUserId = user.id;
        this.couponsService.issueWelcomeCoupon(newUserId).catch((err) => {
          console.error(
            `사용자 ${newUserId}의 환영 쿠폰 발급 실패:`,
            err.message,
          );
        });
      }

      // 5. 토큰 발급
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
      console.error(err);
      throw new InternalServerErrorException(`구글 로그인 실패: ${err}`);
    }
  }

  // 🔹 카카오 로그인
  async loginWithKakao(
    code: string,
    redirectUri: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    user: { isNewUser: boolean; email: string; nickname: string };
  }> {
    try {
      // 1. 카카오 토큰 발급
      const tokenRes = await axios.post<KakaoTokenResponse>(
        'https://kauth.kakao.com/oauth/token',
        null,
        {
          params: {
            grant_type: 'authorization_code',
            client_id: process.env.KAKAO_REST_API_KEY,
            redirect_uri: redirectUri,
            code,
          },
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        },
      );

      const kakaoAccessToken = tokenRes.data.access_token;

      // 2. 카카오 사용자 정보 가져오기
      const userInfoRes = await axios.get<KakaoUserInfo>(
        'https://kapi.kakao.com/v2/user/me',
        {
          headers: { Authorization: `Bearer ${kakaoAccessToken}` },
        },
      );

      const kakaoData = userInfoRes.data;
      const kakaoSubId = kakaoData.id.toString();
      const email = kakaoData.kakao_account?.email ?? `${kakaoSubId}@kakao.com`;
      const nickname =
        kakaoData.kakao_account?.profile?.nickname ?? '카카오유저';
      const picture =
        kakaoData.kakao_account?.profile?.profile_image_url ?? null;

      // 3. DB에서 유저 찾기 (provider + providerId 기준)
      let user = await this.prisma.user.findUnique({
        where: { providerId: kakaoSubId },
      });

      // 4. 없으면 새로 생성
      if (!user) {
        user = await this.prisma.user.create({
          data: {
            email,
            nickname,
            provider: 'KAKAO',
            providerId: kakaoSubId,
            image: picture,
          },
        });

        // ✅ NEW: 신규 사용자 환영 쿠폰 발급 (비동기, 실패해도 무시)
        const newUserId = user.id;
        this.couponsService.issueWelcomeCoupon(newUserId).catch((err) => {
          console.error(
            `사용자 ${newUserId}의 환영 쿠폰 발급 실패:`,
            err.message,
          );
        });
      }

      // 5. 토큰 발급
      const refreshToken = await this.issueOrRefreshToken(user);
      const accessToken = this.issueAccessToken(user);

      return {
        accessToken,
        refreshToken,
        user: {
          isNewUser: !user.bio,
          email: user.email,
          nickname: user.nickname ?? '',
        },
      };
    } catch (err: any) {
      throw new InternalServerErrorException(`카카오 로그인 실패: ${err}`);
    }
  }

  async login(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException(
        '이메일이 올바르지 않습니다.',
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
    if (!userId) throw new BadRequestException('User ID is missing');

    // 닉네임 중복 체크
    if (dto.nickname) {
      const exists = await this.prisma.user.findFirst({
        where: { nickname: dto.nickname, id: { not: userId } },
        select: { id: true },
      });
      if (exists) throw new ConflictException('Nickname already in use');
    }

    let imageUrl: string | undefined;
    if (file) {
      imageUrl = await this.uploadService.uploadFile('profile', file);
    }

    // 기본 유저 정보 업데이트
    const userBaseUpdate = await this.prisma.user.update({
      where: { id: userId },
      data: {
        nickname: dto.nickname,
        bio: dto.bio,
        regionId: dto.regionId,
        ...(imageUrl ? { image: imageUrl } : {}),
      },
      include: {
        region: true,
        teacherProfile: true,
      },
    });

    // 관심사 업데이트 (LessonCategory 기반)
    if (dto.interests && dto.interests.length > 0) {
      const validCategories = await this.prisma.lessonCategory.findMany({
        where: { id: { in: dto.interests } },
        select: { id: true },
      });
      const validIds = new Set(validCategories.map((c) => c.id));

      const currentLinks = await this.prisma.userInterest.findMany({
        where: { userId },
        select: { id: true, lessonCategoryId: true },
      });

      const desired = Array.from(validIds);

      const toDelete = currentLinks
        .filter((link) => !validIds.has(link.lessonCategoryId))
        .map((link) => link.id);

      const currentIds = new Set(currentLinks.map((l) => l.lessonCategoryId));
      const toAdd = desired.filter((id) => !currentIds.has(id));

      await this.prisma.$transaction([
        ...(toDelete.length
          ? [
            this.prisma.userInterest.deleteMany({
              where: { id: { in: toDelete } },
            }),
          ]
          : []),
        ...toAdd.map((lessonCategoryId) =>
          this.prisma.userInterest.create({
            data: { userId, lessonCategoryId },
          }),
        ),
      ]);
    }

    // 최신 관심사 조회
    const interests = await this.prisma.userInterest.findMany({
      where: { userId },
      include: { lessonCategory: true },
    });

    return {
      id: userBaseUpdate.id,
      email: userBaseUpdate.email,
      nickname: userBaseUpdate.nickname,
      bio: userBaseUpdate.bio,
      image: userBaseUpdate.image,
      interests: interests.map((i) => ({
        id: i.lessonCategory.id,
        name: i.lessonCategory.name,
      })),
      point: userBaseUpdate.point,
      region: userBaseUpdate.region
        ? { id: userBaseUpdate.region.id, name: userBaseUpdate.region.name }
        : null,
      teacherProfile: !!userBaseUpdate.teacherProfile,
      createdAt: userBaseUpdate.createdAt,
      updatedAt: userBaseUpdate.updatedAt,
      deletedAt: userBaseUpdate.deletedAt,
    };
  }

  // async findById(userId: number) {
  //   const user = await this.prisma.user.findUnique({
  //     where: { id: userId },
  //   });
  //   if (!user) {
  //     return [];
  //   }
  //   const interests = await this.prisma.userInterest.findMany({
  //     where: { userId },
  //     include: { interest: true },
  //   });
  //   return {
  //     id: user.id,
  //     email: user.email,
  //     nickname: user.nickname,
  //     bio: user.bio,
  //     profileImage: user.image,
  //     interests: interests.map((i) => ({
  //       id: i.interestId,
  //       name: i.interest.name,
  //     })),
  //   };
  // }

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
          { secret: process.env.JWT_SECRET, expiresIn: '7d' },
        );

        return { accessToken: newAccessToken, refreshToken: newRefreshToken };
      }

      throw new UnauthorizedException('Refresh 토큰 검증 실패');
    }
  }

  // async requestPasswordReset(email: string) {
  //   const user: User | null = await this.prisma.user.findUnique({
  //     where: { email },
  //   });

  //   if (!user) {
  //     throw new NotFoundException();
  //   }

  //   const code = Math.floor(100000 + Math.random() * 900000).toString();

  //   const expiresIn = 3 * 60;

  //   const resetToken = this.jwtService.sign(
  //     {
  //       email,
  //       code,
  //       purpose: 'password_reset',
  //     },
  //     { secret: process.env.JWT_SECRET, expiresIn: expiresIn },
  //   );

  //   await this.prisma.user.update({
  //     where: { id: user.id },
  //     data: {
  //       resetToken,
  //     },
  //   });

  //   await this.mailService.sendResetCode(email, code);

  //   return { code };
  // }

  // async verifyPasswordResetCode(email: string, code: string) {
  //   const user: User | null = await this.prisma.user.findUnique({
  //     where: { email },
  //   });

  //   if (!user) {
  //     throw new NotFoundException('User not found');
  //   }

  //   if (!user.resetToken) {
  //     throw new BadRequestException('No reset token found');
  //   }

  //   let payload: ResetTokenPayload;
  //   try {
  //     payload = this.jwtService.verify<ResetTokenPayload>(user.resetToken, {
  //       secret: process.env.JWT_SECRET,
  //     });
  //   } catch (err) {
  //     console.error(err);
  //     throw new GoneException();
  //   }

  //   if (payload.email !== email) {
  //     throw new BadRequestException('Email does not match');
  //   }
  //   if (payload.code !== code) {
  //     throw new BadRequestException('Invalid verification code');

  //     //코드가 틀리면 DB에 resetToken 삭제? 어떻게 처리할까
  //   }

  //   return { resetToken: user.resetToken };
  // }

  // async confirmPasswordReset(resetToken: string, newPassword: string) {
  //   let payload: ResetTokenPayload;
  //   try {
  //     payload = this.jwtService.verify<ResetTokenPayload>(resetToken, {
  //       secret: process.env.JWT_SECRET,
  //     });
  //   } catch (err) {
  //     console.error(err);

  //     throw new BadRequestException();
  //   }

  //   if (payload.purpose != 'password_reset') {
  //     throw new BadRequestException();
  //   }

  //   const user = await this.prisma.user.findUnique({
  //     where: { email: payload.email },
  //   });
  //   if (!user) {
  //     throw new NotFoundException();
  //   }

  //   const hashedPassword = await bcrypt.hash(newPassword, 10);
  //   await this.prisma.user.update({
  //     where: { id: user.id },
  //     data: {
  //       password: hashedPassword,
  //       resetToken: null,
  //     },
  //   });

  //   return;
  // }

  async verifyUser(id: number) {

    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        region: true,
        teacherProfile: true,
      },
    });
    console.log(user, '유저');

    if (!user || user.deletedAt) {
      return {
        authenticated: false,
      };
    }

    // interests
    const currentLinks: { lessonCategory: { id: number; name: string } }[] =
      await this.prisma.userInterest.findMany({
        where: { userId: id },
        select: {
          lessonCategory: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

    const interests = currentLinks.map((link) => ({
      id: link.lessonCategory.id,
      name: link.lessonCategory.name,
    }));

    return {
      authenticated: true,
      isNewUser: !user.bio,
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      bio: user.bio,
      profileImage: user.image,
      interests,
      point: user.point,
      region: user.region
        ? { id: user.region.id, name: user.region.name }
        : null,
      teacherProfile: !!user.teacherProfile,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      deletedAt: user.deletedAt,
    };
  }

  async issueOrRefreshToken(user: User): Promise<string> {
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

  issueAccessToken(user: User): string {
    return this.jwtService.sign(
      { id: user.id, email: user.email },
      { secret: process.env.JWT_SECRET, expiresIn: '7d' },
    );
  }

  issueFakeToken(id: number, email: string): string {
    return this.jwtService.sign(
      { id, email },
      { secret: process.env.JWT_SECRET, expiresIn: '7d' },
    );
  }
  async withdraw(userId: number) {
    const now = new Date();

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.deletedAt) {
      throw new BadRequestException(
        '이미 탈퇴했거나 존재하지 않는 사용자입니다.',
      );
    }

    // 4가지 체크를 병렬로 실행하여 성능 최적화
    const [
      upcomingEnrollments,
      upcomingHostedMeetings,
      upcomingJoinedMeetings,
      upcomingLessonSchedules,
    ] = await Promise.all([
      // 1. 체크: 수강 예정인 레슨이 있는지 (학생)
      this.prisma.enrollment.findFirst({
        where: {
          userId,
          status: 'ACCEPTED',
          schedule: { startAt: { gt: now } },
        },
      }),
      // 2. 체크: 진행 예정인 모임이 있는지 (호스트)
      this.prisma.meeting.findFirst({
        where: {
          hostId: userId,
          meetingDeleted: false,
          meetingDate: { gt: now },
        },
      }),
      // 3. 체크: 진행 예정인 모임 참여가 있는지 (참여자)
      this.prisma.participation.findFirst({
        where: {
          userId,
          status: 'ACCEPTED',
          meeting: {
            meetingDeleted: false,
            meetingDate: { gt: now },
          },
        },
      }),
      // 4. 체크: 선생님인 경우 진행 예정인 레슨 스케줄이 있는지 (수강생이 1명이라도 있는 경우)
      this.prisma.lessonSchedule.findFirst({
        where: {
          lesson: { userId },
          startAt: { gt: now },
          currentParticipants: { gt: 0 },
        },
      }),
    ]);

    if (upcomingEnrollments) {
      throw new BadRequestException(
        '수강 예정인 클래스가 있어 탈퇴할 수 없습니다.',
      );
    }
    if (upcomingHostedMeetings) {
      throw new BadRequestException(
        '진행 예정인 모임의 호스트이므로 탈퇴할 수 없습니다.',
      );
    }
    if (upcomingJoinedMeetings) {
      throw new BadRequestException(
        '참여 예정인 모임이 있어 탈퇴할 수 없습니다.',
      );
    }
    if (upcomingLessonSchedules) {
      throw new BadRequestException(
        '수강 예정인 학생이 있는 클래스가 있어 탈퇴할 수 없습니다.',
      );
    }

    // 5. 익명화 및 Soft Delete 수행
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        email: `withdrawn_${userId}_${Date.now()}@moaclass.com`,
        nickname: `(탈퇴한 사용자)_${userId}`,
        providerId: `withdrawn_${userId}_${Date.now()}`,
        image: null,
        bio: null,
        refreshToken: null,
        deletedAt: now,
      },
    });

    return { success: true };
  }
}
