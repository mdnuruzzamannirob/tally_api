import type { RequestHandler } from "express";

import {
  clearRefreshCookie,
  REFRESH_COOKIE_NAME,
  setRefreshCookie,
} from "../../core/config/cookie.config.js";
import { ApiError } from "../../core/errors/api-error.js";
import { sendSuccess } from "../../http/response/success-response.js";
import { asyncHandler } from "../../http/async-handler.js";
import type { AuthService } from "./auth.service.js";
import {
  loginSchema,
  registerSchema,
  resendVerificationSchema,
  verifyEmailSchema,
} from "./auth.validators.js";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  setPasswordSchema,
} from "./password/password.validators.js";

export function createAuthController(authService: AuthService): {
  register: RequestHandler;
  verifyEmail: RequestHandler;
  resendVerification: RequestHandler;
  login: RequestHandler;
  refresh: RequestHandler;
  logout: RequestHandler;
  me: RequestHandler;
  forgotPassword: RequestHandler;
  resetPassword: RequestHandler;
  changePassword: RequestHandler;
  setPassword: RequestHandler;
} {
  return {
    register: asyncHandler(async (request, response) => {
      const input = registerSchema.parse(request.body);
      await authService.register(input);
      return sendSuccess(
        response,
        {},
        { statusCode: 201, message: "Registration successful. Please verify your email." },
      );
    }),
    verifyEmail: asyncHandler(async (request, response) => {
      const { token } = verifyEmailSchema.parse(request.body);
      await authService.verifyEmail(token);
      return sendSuccess(response, {}, { message: "Email verified successfully" });
    }),
    resendVerification: asyncHandler(async (request, response) => {
      const { email } = resendVerificationSchema.parse(request.body);
      await authService.resendVerificationEmail(email);
      return sendSuccess(
        response,
        {},
        {
          message: "If the account exists and is unverified, a verification email has been sent.",
        },
      );
    }),
    login: asyncHandler(async (request, response) => {
      const input = loginSchema.parse(request.body);
      const session = await authService.login(input, {
        userAgent: request.header("User-Agent") ?? undefined,
        ip: request.ip,
      });
      setRefreshCookie(response, session.refreshToken);
      return sendSuccess(response, { accessToken: session.accessToken, user: session.user });
    }),
    refresh: asyncHandler(async (request, response) => {
      try {
        const refreshToken = request.cookies?.[REFRESH_COOKIE_NAME];
        if (typeof refreshToken !== "string") {
          throw new ApiError(401, "UNAUTHORIZED", "Refresh token is required.");
        }
        const session = await authService.refresh(refreshToken, {
          userAgent: request.header("User-Agent") ?? undefined,
          ip: request.ip,
        });
        setRefreshCookie(response, session.refreshToken, session.refreshTokenExpiresAt);
        return sendSuccess(response, { accessToken: session.accessToken });
      } catch (error) {
        if (error instanceof ApiError && error.statusCode === 401) {
          clearRefreshCookie(response);
        }
        throw error;
      }
    }),
    logout: asyncHandler(async (request, response) => {
      const refreshToken = request.cookies?.[REFRESH_COOKIE_NAME];
      await authService.logout(typeof refreshToken === "string" ? refreshToken : undefined);
      clearRefreshCookie(response);
      return sendSuccess(response, {}, { message: "Logged out" });
    }),
    me: asyncHandler(async (request, response) => {
      if (!request.auth) throw new ApiError(401, "UNAUTHORIZED", "Authentication is required.");
      return sendSuccess(response, await authService.getCurrentUser(request.auth.userId));
    }),
    forgotPassword: asyncHandler(async (request, response) => {
      const { email } = forgotPasswordSchema.parse(request.body);
      await authService.requestPasswordReset(email);
      return sendSuccess(
        response,
        {},
        {
          message: "If an account exists for this email, a password reset link has been sent.",
        },
      );
    }),
    resetPassword: asyncHandler(async (request, response) => {
      const { token, password } = resetPasswordSchema.parse(request.body);
      await authService.resetPassword(token, password);
      return sendSuccess(response, {}, { message: "Password reset successful" });
    }),
    changePassword: asyncHandler(async (request, response) => {
      if (!request.auth) throw new ApiError(401, "UNAUTHORIZED", "Authentication is required.");
      const input = changePasswordSchema.parse(request.body);
      const refreshToken = request.cookies?.[REFRESH_COOKIE_NAME];
      await authService.changePassword(
        request.auth.userId,
        input,
        typeof refreshToken === "string" ? refreshToken : undefined,
      );
      return sendSuccess(response, {}, { message: "Password changed successfully" });
    }),
    setPassword: asyncHandler(async (request, response) => {
      if (!request.auth) throw new ApiError(401, "UNAUTHORIZED", "Authentication is required.");
      const { newPassword } = setPasswordSchema.parse(request.body);
      await authService.setPassword(request.auth.userId, newPassword);
      return sendSuccess(response, {}, { message: "Password set successfully" });
    }),
  };
}
