import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('ERP Service (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /erp/reports/dashboard should return 200', () => {
    return request(app.getHttpServer())
      .get('/erp/reports/dashboard')
      .expect(200);
  });

  it('GET /erp/contacts should return paginated list', () => {
    return request(app.getHttpServer())
      .get('/erp/contacts')
      .expect(200)
      .expect((res: any) => {
        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('meta');
      });
  });

  it('POST /erp/contacts with invalid data should return 400', () => {
    return request(app.getHttpServer())
      .post('/erp/contacts')
      .send({ email: 'not-a-valid-email' })
      .expect(400);
  });

  it('GET /erp/inventory should return paginated list', () => {
    return request(app.getHttpServer())
      .get('/erp/inventory')
      .expect(200);
  });

  it('GET /erp/orders should return paginated list', () => {
    return request(app.getHttpServer())
      .get('/erp/orders')
      .expect(200);
  });

  it('GET /erp/invoices should return paginated list', () => {
    return request(app.getHttpServer())
      .get('/erp/invoices')
      .expect(200);
  });

  it('GET /erp/expenses should return paginated list', () => {
    return request(app.getHttpServer())
      .get('/erp/expenses')
      .expect(200);
  });
});
