import { test, expect } from '@playwright/test';

test.describe('API Health Checks @smoke', () => {
  const API_URL = process.env.API_URL || 'http://localhost:4000';

  test('API Gateway is healthy', async ({ request }) => {
    const response = await request.get(`${API_URL}/health`);
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.status).toBe('ok');
  });

  test('Auth login endpoint responds', async ({ request }) => {
    const response = await request.post(`${API_URL}/auth/login`, {
      data: { email: 'nonexistent@test.com', password: 'wrong' },
    });
    expect(response.status()).toBeLessThan(500);
  });

  test('Auth login works with valid credentials', async ({ request }) => {
    const response = await request.post(`${API_URL}/auth/login`, {
      data: { email: 'admin@unicore.local', password: 'Admin1234' },
    });
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.accessToken).toBeTruthy();
    expect(body.user.email).toBe('admin@unicore.local');
  });
});
