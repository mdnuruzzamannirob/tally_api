import type { RequestHandler } from "express";

import { sendSuccess } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import type { AuthService } from "./auth.service.js";
import { registerSchema, resendVerificationSchema, verifyEmailSchema } from "./auth.validators.js";

export function createAuthController(authService: AuthService): {
  register: RequestHandler;
  verifyEmail: RequestHandler;
  resendVerification: RequestHandler;
} {
  return {
    register: asyncHandler(async (request, response) => {
      const input = registerSchema.parse(request.body);
      await authService.register(input);
      return sendSuccess(
        response,
        { message: "Registration successful. Please verify your email." },
        201,
      );
    }),
    verifyEmail: asyncHandler(async (request, response) => {
      const { token } = verifyEmailSchema.parse(request.body);
      await authService.verifyEmail(token);
      return sendSuccess(response, { message: "Email verified successfully" });
    }),
    resendVerification: asyncHandler(async (request, response) => {
      const { email } = resendVerificationSchema.parse(request.body);
      await authService.resendVerificationEmail(email);
      return sendSuccess(response, {
        message: "If the account exists and is unverified, a verification email has been sent.",
      });
    }),
  };
}
