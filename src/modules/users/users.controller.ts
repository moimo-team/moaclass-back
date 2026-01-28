import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Req,
  ValidationPipe,
  UnauthorizedException,
  Res,
  Put,
  UseInterceptors,
  UploadedFile,
  ConflictException,
  BadRequestException,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateExtraInfoDto } from './dto/update-extra-info.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { JwtPayload } from '../../auth/jwt-payload.interface';
import { LoginDto } from './dto/login.dto';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import multer from 'multer';
import { Cookies } from '../../common/cookies.decorator';
import { OptionalJwtAuthGuard } from '../../auth/optional-jwt-auth.guard';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('register')
  async register(
    @Body('nickname') nickname: string,
    @Body('email') email: string,
    @Body('password') password: string,
    @Res() res: Response,
  ) {
    const { accessToken, refreshToken, user } =
      await this.usersService.registerUser(nickname, email, password);

    res.setHeader('Authorization', `Bearer ${accessToken}`);
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.json({ user });
  }

  @Get()
  async findAll() {
    return await this.usersService.findAll();
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get('verify')
  async verifyToken(@Req() req: Request & { user?: JwtPayload }) {
    console.log(req.user);
    if (!req.user) {
      return { authenticated: false };
    }
    return this.usersService.verifyUser(req.user.id);
  }
  @Get(':userId')
  async findUser(@Param('userId', ParseIntPipe) userId: number) {
    return this.usersService.findById(userId);
  }

  @Post('login')
  async login(
    @Body(new ValidationPipe()) body: LoginDto,
    @Res() res: Response,
  ) {
    const { accessToken, refreshToken, user } = await this.usersService.login(
      body.email,
      body.password,
    );

    res.setHeader('Authorization', `Bearer ${accessToken}`);
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7일
    });

    return res.json({ user });
  }

  @Post('login/google')
  async loginWithGoogle(
    @Body() body: { code: string; redirectUri: string },
    @Res() res: Response,
  ) {
    const { code, redirectUri } = body;
    const { accessToken, refreshToken, user } =
      await this.usersService.loginWithGoogle(code, redirectUri);

    res.setHeader('Authorization', `Bearer ${accessToken}`);
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: true, // HTTPS 환경에서만
      sameSite: 'strict',
      maxAge: 60 * 60 * 1000, // 1시간
    });
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7일
    });

    return res.json({ user });
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout(@Res() res: Response) {
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');

    return res.status(200).send();
  }

  @UseGuards(JwtAuthGuard)
  @Put('user-update')
  @UseInterceptors(FileInterceptor('file', { storage: multer.memoryStorage() }))
  async updateUser(
    @Req() req: Request & { user: JwtPayload },
    @Body() dto: UpdateExtraInfoDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const userId = req.user.id;
    return this.usersService.updateUser(userId, dto, file);
  }

  @Post('check-nickname')
  async checkNickname(@Body('nickname') nickname: string) {
    const available = await this.usersService.isNicknameAvailable(nickname);

    if (!available) {
      throw new ConflictException();
    }

    return;
  }

  @Post('check-email')
  async checkEmail(@Body('email') email: string) {
    const available = await this.usersService.isEmailAvailable(email);

    if (!available) {
      throw new ConflictException();
    }
    return;
  }

  @Post('password-reset/request')
  async requestReset(@Body('email') email: string) {
    return await this.usersService.requestPasswordReset(email);
  }

  @Post('password-reset/verify')
  async verifyCode(@Body('email') email: string, @Body('code') code: string) {
    return await this.usersService.verifyPasswordResetCode(email, code);
  }

  @Put('password-reset/confirm')
  async confirmReset(
    @Body('resetToken') resetToken: string,
    @Body('newPassword') newPassword: string,
  ) {
    return await this.usersService.confirmPasswordReset(
      resetToken,
      newPassword,
    );
  }

  @Post('refresh')
  async refresh(
    @Cookies('refreshToken') refreshToken: string | undefined,
    @Res() res: Response,
  ) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token이 필요합니다.');
    }

    const { accessToken, refreshToken: newRefreshToken } =
      await this.usersService.refreshAccessToken(refreshToken);

    // 응답에 새 토큰 심기
    res.setHeader('Authorization', `Bearer ${accessToken}`);

    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7일
    });

    return res.status(200).end();
  }
}
