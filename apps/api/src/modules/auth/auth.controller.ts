import {
  Controller,
  Post,
  Body,
  Req,
  Res,
  HttpStatus,
  HttpCode,
  Inject,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { Public } from '../../core/decorators/require-permission.decorator.js';
import { LoginSchema, LoginDto } from '@snackflow/shared';
import { ZodValidationPipe } from '../../core/pipes/zod-validation.pipe.js';

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodValidationPipe(LoginSchema)) loginDto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = req.ip || (req.headers['x-forwarded-for'] as string) || '127.0.0.1';
    const result = await this.authService.login(loginDto, ip);

    // Set refresh token in httpOnly, Secure, SameSite=Strict cookie
    res.cookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/api/v1/auth',
    });

    return {
      user: result.user,
      accessToken: result.accessToken,
    };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const rawToken = req.cookies?.refresh_token || (req.body as any)?.refreshToken;
    const result = await this.authService.refreshToken(rawToken);

    res.cookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/api/v1/auth',
    });

    return {
      accessToken: result.accessToken,
    };
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const rawToken = req.cookies?.refresh_token;
    if (rawToken) {
      await this.authService.logout(rawToken);
    }
    res.clearCookie('refresh_token', { path: '/api/v1/auth' });
    return { success: true };
  }
}
