import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuditService } from '../audit/audit.service';

const mockAuthService = {
  register: jest.fn(),
  login: jest.fn(),
  refresh: jest.fn(),
  logout: jest.fn(),
  getMe: jest.fn(),
};

const mockAuditService = {
  log: jest.fn().mockResolvedValue(undefined),
};

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    it('should call authService.register', async () => {
      const dto = {
        email: 'test@example.com',
        name: 'Test',
        password: 'Password1',
        confirmPassword: 'Password1',
      };
      const response = { accessToken: 'token', refreshToken: 'refresh', expiresIn: 900, user: {} };
      mockAuthService.register.mockResolvedValue(response);

      const result = await controller.register(dto);
      expect(result).toEqual(response);
      expect(mockAuthService.register).toHaveBeenCalledWith(dto);
    });
  });

  describe('login', () => {
    it('should call authService.login with user from guard', async () => {
      const user = { id: '1', email: 'test@example.com', name: 'Test', role: 'VIEWER' };
      const response = { accessToken: 'token', refreshToken: 'refresh', expiresIn: 900, user };
      mockAuthService.login.mockResolvedValue(response);

      const req = { ip: '127.0.0.1' } as any;
      const result = await controller.login(user, { email: 'test@example.com', password: 'pw' }, req);
      expect(result).toEqual(response);
      expect(mockAuthService.login).toHaveBeenCalledWith(user);
    });
  });

  describe('refresh', () => {
    it('should call authService.refresh', async () => {
      const response = { accessToken: 'new', refreshToken: 'new-refresh', expiresIn: 900, user: {} };
      mockAuthService.refresh.mockResolvedValue(response);

      const result = await controller.refresh({ refreshToken: 'old' });
      expect(result).toEqual(response);
    });
  });

  describe('logout', () => {
    it('should call authService.logout', async () => {
      mockAuthService.logout.mockResolvedValue(undefined);

      const user = { id: '1', email: 'test@example.com' };
      const req = { ip: '127.0.0.1' } as any;
      await controller.logout(user, { refreshToken: 'token' }, req);
      expect(mockAuthService.logout).toHaveBeenCalledWith('token');
    });
  });

  describe('getMe', () => {
    it('should call authService.getMe', async () => {
      const user = { id: '1', email: 'test@example.com', name: 'Test', role: 'VIEWER' };
      mockAuthService.getMe.mockResolvedValue(user);

      const result = await controller.getMe('1');
      expect(result).toEqual(user);
    });
  });
});
