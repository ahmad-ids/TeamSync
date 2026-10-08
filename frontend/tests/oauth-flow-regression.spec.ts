import { expect, test, type Page } from 'playwright/test';

test.describe('OAuth flow regression', () => {
  test('login page starts Google sign-in on the backend origin', async ({ page, baseURL }) => {
    await mockExternalProviders(page);

    const startRequestPromise = page.waitForRequest((request) =>
      request.url().startsWith('https://localhost:5202/api/auth/external/google/start'),
    );

    await page.route('https://localhost:5202/api/auth/external/google/start**', async (route) => {
      await route.fulfill({
        status: 302,
        headers: {
          location: `${baseURL}/oauth/callback?error=Intercepted+Google+redirect`,
        },
        body: '',
      });
    });

    await page.goto('/login');
    await page.getByRole('button', { name: 'Google' }).click();

    const startRequest = await startRequestPromise;
    const startUrl = new URL(startRequest.url());

    expect(startUrl.origin).toBe('https://localhost:5202');
    expect(startUrl.searchParams.get('flow')).toBe('login');
    expect(startUrl.searchParams.get('frontendOrigin')).toBe(baseURL);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText('Intercepted Google redirect')).toBeVisible();
  });

  test('signup page starts GitHub sign-in on the backend origin', async ({ page, baseURL }) => {
    await mockExternalProviders(page);

    const startRequestPromise = page.waitForRequest((request) =>
      request.url().startsWith('https://localhost:5202/api/auth/external/github/start'),
    );

    await page.route('https://localhost:5202/api/auth/external/github/start**', async (route) => {
      await route.fulfill({
        status: 302,
        headers: {
          location: `${baseURL}/oauth/callback?error=Intercepted+GitHub+redirect`,
        },
        body: '',
      });
    });

    await page.goto('/signup');
    await page.getByRole('button', { name: 'GitHub' }).click();

    const startRequest = await startRequestPromise;
    const startUrl = new URL(startRequest.url());

    expect(startUrl.origin).toBe('https://localhost:5202');
    expect(startUrl.searchParams.get('flow')).toBe('signup');
    expect(startUrl.searchParams.get('frontendOrigin')).toBe(baseURL);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText('Intercepted GitHub redirect')).toBeVisible();
  });

  test('callback without a ticket sends the user back to login with a stable error', async ({ page }) => {
    await mockExternalProviders(page);

    await page.goto('/oauth/callback?flow=login');

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText('External sign-in did not return a valid ticket. Please try again.')).toBeVisible();
  });

  test('callback waits briefly for a cold-start ticket before failing', async ({ page }) => {
    await page.addInitScript(() => {
      if (window.location.pathname === '/oauth/callback' && window.location.search === '?flow=login') {
        window.setTimeout(() => {
          window.history.replaceState(null, '', '/oauth/callback?flow=login&ticket=late-ticket');
        }, 150);
      }
    });

    await page.route('**/api/auth/external/exchange', async (route) => {
      const requestBody = route.request().postDataJSON() as { ticket?: string };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          token: `jwt-for-${requestBody.ticket}`,
          expiresAt: '2030-01-01T00:00:00.000Z',
          role: 'Member',
          email: 'member@example.com',
        }),
      });
    });

    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'member-1',
          fullName: 'Member User',
          email: 'member@example.com',
          role: 'Member',
        }),
      });
    });

    await page.goto('/oauth/callback?flow=login');

    await expect(page).toHaveURL(/\/member$/);
  });
});

async function mockExternalProviders(page: Page) {
  await page.route('**/api/auth/external/providers', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        google: true,
        github: true,
      }),
    });
  });
}
