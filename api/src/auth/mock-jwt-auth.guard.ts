import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import { Request } from "express";

@Injectable()
export class MockJwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;

    // Check if Authorization header is present and starts with 'Bearer '
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new UnauthorizedException(
        "Missing or invalid Authorization header"
      );
    }

    const token = authHeader.split(" ")[1];

    // Check if token exists (any non-empty token is considered valid)
    if (!token || token.trim() === "") {
      throw new UnauthorizedException("Missing JWT token");
    }

    // Mock: Always consider the token valid and set a mock user
    (request as any).user = {
      userId: "mock-user-id",
      email: "mock@example.com",
    };

    return true;
  }
}
