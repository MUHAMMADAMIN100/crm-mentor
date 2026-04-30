import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt.guard';
import { CurrentUser } from './current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('login')
  login(@Body() body: { login: string; password: string }) {
    return this.auth.login(body.login, body.password);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user) {
    return this.auth.me(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  changePassword(
    @CurrentUser() user,
    @Body() body: { oldPassword: string; newPassword: string },
  ) {
    return this.auth.changePassword(user.id, body.oldPassword, body.newPassword);
  }

  @UseGuards(JwtAuthGuard)
  @Post('complete-profile')
  completeProfile(@CurrentUser() user, @Body() body: any) {
    return this.auth.completeProfile(user.id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Post('update-profile')
  updateProfile(@CurrentUser() user, @Body() body: any) {
    return this.auth.updateProfile(user.id, body);
  }
}
