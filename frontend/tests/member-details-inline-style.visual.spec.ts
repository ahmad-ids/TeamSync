import { expect, test, type Page } from 'playwright/test';
import {
  memberAuthSession,
  memberAuthUser,
  memberDashboardWorkloadDetails,
  teamLeaderAuthSession,
  teamLeaderAuthUser,
  teamLeaderMemberWorkloadDetails,
} from './fixtures/memberWorkloadDetails';

type WorkloadContext = {
  authSession: typeof teamLeaderAuthSession;
  authUser: typeof teamLeaderAuthUser;
  routePattern: string;
  path: string;
  panelSnapshotName: string;
  workloadDetails: typeof teamLeaderMemberWorkloadDetails;
  tabLabel?: string;
};

test.describe('MemberDetails workload panel regression', () => {
  test('matches the Team Leader member-details baseline', async ({ page }) => {
    await seedAuthenticatedWorkloadContext(page, {
      authSession: teamLeaderAuthSession,
      authUser: teamLeaderAuthUser,
      routePattern: '**/api/members/member-ashley-patel/workload*',
      path: '/members/member-ashley-patel',
      panelSnapshotName: 'team-leader-member-details-workload-panel.png',
      workloadDetails: teamLeaderMemberWorkloadDetails,
      tabLabel: 'Workload',
    });
  });

  test('matches the Member dashboard baseline', async ({ page }) => {
    await seedAuthenticatedWorkloadContext(page, {
      authSession: memberAuthSession,
      authUser: memberAuthUser,
      routePattern: '**/api/members/me/workload*',
      path: '/member',
      panelSnapshotName: 'member-dashboard-workload-panel.png',
      workloadDetails: memberDashboardWorkloadDetails,
    });
  });
});

async function seedAuthenticatedWorkloadContext(page: Page, context: WorkloadContext) {
  await page.context().addInitScript((session) => {
    localStorage.setItem('ids.auth.persistent', JSON.stringify(session));
  }, context.authSession);

  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(context.authUser),
    });
  });

  await page.route(context.routePattern, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(context.workloadDetails),
    });
  });

  await page.goto(context.path);

  if (context.tabLabel) {
    await page.getByRole('tab', { name: context.tabLabel }).click();
  }

  const workloadInsightsLabel = page.getByText('Workload Insights', { exact: true });
  const panel = workloadInsightsLabel.locator('xpath=ancestor::*[contains(@class,"MuiPaper-root")][1]');
  await expect(workloadInsightsLabel).toBeVisible();
  const animatedRing = panel.locator('svg circle').last();
  await expect
    .poll(async () => animatedRing.evaluate((element) => getComputedStyle(element).transition))
    .toContain('stroke-dashoffset 1.85s cubic-bezier(0.22, 1, 0.36, 1)');
  await expect(panel).toHaveScreenshot(context.panelSnapshotName, { animations: 'disabled' });
}
