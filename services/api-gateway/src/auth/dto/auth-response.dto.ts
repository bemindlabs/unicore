export class AuthUserDto {
  id: string;
  email: string;
  name: string;
  role: string;
}

export class AuthResponseDto {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: AuthUserDto;
}
