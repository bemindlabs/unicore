import { Controller, Get } from '@nestjs/common';
<<<<<<< HEAD

@Controller()
export class AppController {
=======
import { Public } from './auth/decorators/public.decorator';

@Controller()
export class AppController {
  @Public()
>>>>>>> feature/unc-13-bootstrap-api
  @Get()
  getRoot() {
    return { service: 'api-gateway', status: 'ok' };
  }
}
