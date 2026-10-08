import { createBrowserRouter } from 'react-router-dom';
import { App } from './App';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { PublicOnlyRoute } from './auth/PublicOnlyRoute';
import { RoleRoute } from './auth/RoleRoute';
import { LoginPage } from '../pages/Login/LoginPage';
import { SignupPage } from '../pages/Signup/SignupPage';
import { ForgotPasswordPage } from '../pages/ForgotPassword/ForgotPasswordPage';
import { ResetPasswordPage } from '../pages/ResetPassword/ResetPasswordPage';
import { DashboardPage } from '../pages/Dashboard/DashboardPage';
import { MemberDashboardPage } from '../pages/MemberDashboard/MemberDashboardPage';
import { MyTasksPage } from '../pages/MyTasks/MyTasksPage';
import { MyChangeRequestsPage } from '../pages/MyChangeRequests/MyChangeRequestsPage';
import { MemberActivityPage } from '../pages/MemberActivity/MemberActivityPage';
import { MemberDetailsPage } from '../pages/MemberDetails/MemberDetailsPage';
import { TaskDetailsPage } from '../pages/TaskDetails/TaskDetailsPage';
import { TaskFormPage } from '../pages/TaskForm/TaskFormPage';
import { ChangeRequestsPage } from '../pages/ChangeRequests/ChangeRequestsPage';
import { OAuthCallbackPage } from '../pages/OAuth/OAuthCallbackPage';
import { ClickUpWorkspaceSelectionPage } from '../pages/Integrations/ClickUpWorkspaceSelectionPage';

export const router = createBrowserRouter([
  {
    element: <PublicOnlyRoute />,
    children: [
      {
        path: '/login',
        element: <LoginPage />,
      },
      {
        path: '/signup',
        element: <SignupPage />,
      },
      {
        path: '/forgot-password',
        element: <ForgotPasswordPage />,
      },
      {
        path: '/reset-password',
        element: <ResetPasswordPage />,
      },
      {
        path: '/oauth/callback',
        element: <OAuthCallbackPage />,
      },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: '/',
        element: <App />,
        children: [
          {
            index: true,
            element: (
              <RoleRoute allowedRoles={['TeamLeader']}>
                <DashboardPage />
              </RoleRoute>
            ),
          },
          {
            path: 'member',
            element: (
              <RoleRoute allowedRoles={['Member']}>
                <MemberDashboardPage />
              </RoleRoute>
            ),
          },
          {
            path: 'member/tasks',
            element: (
              <RoleRoute allowedRoles={['Member']}>
                <MyTasksPage />
              </RoleRoute>
            ),
          },
          {
            path: 'member/change-requests',
            element: (
              <RoleRoute allowedRoles={['Member']}>
                <MyChangeRequestsPage />
              </RoleRoute>
            ),
          },
          {
            path: 'member/history',
            element: (
              <RoleRoute allowedRoles={['Member']}>
                <MemberActivityPage />
              </RoleRoute>
            ),
          },
          {
            path: 'members/:memberId',
            element: (
              <RoleRoute allowedRoles={['TeamLeader']}>
                <MemberDetailsPage />
              </RoleRoute>
            ),
          },
          {
            path: 'tasks/new',
            element: (
              <RoleRoute allowedRoles={['TeamLeader']}>
                <TaskFormPage />
              </RoleRoute>
            ),
          },
          { path: 'tasks/:taskId', element: <TaskDetailsPage /> },
          {
            path: 'tasks/:taskId/edit',
            element: (
              <RoleRoute allowedRoles={['TeamLeader']}>
                <TaskFormPage />
              </RoleRoute>
            ),
          },
          {
            path: 'change-requests',
            element: (
              <RoleRoute allowedRoles={['TeamLeader']}>
                <ChangeRequestsPage />
              </RoleRoute>
            ),
          },
          {
            path: 'integrations/clickup/select',
            element: (
              <RoleRoute allowedRoles={['TeamLeader']}>
                <ClickUpWorkspaceSelectionPage />
              </RoleRoute>
            ),
          },
        ],
      },
    ],
  },
]);
