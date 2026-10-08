export interface LoginRequest {
  email: string;
  password: string;
  rememberMe: boolean;
}

export interface RegisterRequest {
  fullName: string;
  email: string;
  password: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  email: string;
  token: string;
  password: string;
  confirmPassword: string;
}

export interface LoginResponse {
  token: string;
  expiresAt: string;
  role: string;
  email: string;
}

export interface OAuthExchangeRequest {
  ticket: string;
}

export interface RegisterResponse {
  userId: string;
  fullName: string;
  email: string;
  role: string;
}

export interface AuthUser {
  userId: string;
  fullName: string;
  email: string;
  role: string;
}

export interface AuthSession {
  token: string;
  expiresAt: string;
  role: string;
  email: string;
  rememberMe: boolean;
}
