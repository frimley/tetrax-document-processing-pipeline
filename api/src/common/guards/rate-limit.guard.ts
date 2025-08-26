import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { Request } from "express";

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly requestCounts = new Map<string, RateLimitEntry>();
  private readonly windowMs = 60 * 1000; // 1 minute window
  private readonly maxRequests = 30; // Max 30 requests per minute per IP

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const clientIp = this.getClientIp(request);
    const now = Date.now();

    // Clean up old entries
    this.cleanup(now);

    const entry = this.requestCounts.get(clientIp);

    if (!entry) {
      // First request from this IP
      this.requestCounts.set(clientIp, {
        count: 1,
        resetTime: now + this.windowMs,
      });
      return true;
    }

    if (now > entry.resetTime) {
      // Window expired, reset counter
      entry.count = 1;
      entry.resetTime = now + this.windowMs;
      return true;
    }

    if (entry.count >= this.maxRequests) {
      throw new HttpException(
        `Rate limit exceeded. Max ${this.maxRequests} requests per minute.`,
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    entry.count++;
    return true;
  }

  private getClientIp(request: Request): string {
    const xForwardedFor = request.headers["x-forwarded-for"];
    if (typeof xForwardedFor === "string") {
      return xForwardedFor.split(",")[0].trim();
    }
    return request.ip || request.connection.remoteAddress || "unknown";
  }

  private cleanup(now: number): void {
    for (const [ip, entry] of this.requestCounts.entries()) {
      if (now > entry.resetTime) {
        this.requestCounts.delete(ip);
      }
    }
  }
}
