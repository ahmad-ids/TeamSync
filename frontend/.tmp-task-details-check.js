const { chromium } = require('./node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const taskId = '14d0c616-3b0d-4c93-9c66-760157257c54';

  await page.goto('http://127.0.0.1:4173/login', { waitUntil: 'networkidle' });
  await page.fill('#login-email', 'leader@ids.local');
  await page.fill('#login-password', 'Passw0rd!');
  await page.getByRole('button', { name: /login to dashboard/i }).click();
  await page.waitForURL('**/');

  await page.goto(`http://127.0.0.1:4173/tasks/${taskId}`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: /Marcus Work Item 1/i }).waitFor();
  await page.screenshot({ path: 'C:/Users/Tala/desktop/IDS-Project-TalaSaab/task-details-page.png', fullPage: true });

  const auditRows = await page.locator('table tbody tr').count();
  const lifecycleItems = await page.locator('text=Created').count() + await page.locator('text=Assigned to').count();
  await page.getByRole('link', { name: /edit task/i }).click();
  await page.waitForURL('**/tasks/*/edit');
  await page.getByLabel('Title').waitFor();
  const titleValue = await page.getByLabel('Title').inputValue();

  console.log(JSON.stringify({
    finalUrl: page.url(),
    auditRows,
    lifecycleItems,
    titleValue
  }));

  await browser.close();
})();
