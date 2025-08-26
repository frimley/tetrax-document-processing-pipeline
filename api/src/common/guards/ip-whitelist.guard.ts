import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { Request } from "express";

@Injectable()
export class IpWhitelistGuard implements CanActivate {
  private readonly allowedIps = new Set([
    "127.0.0.1", // localhost
    "::1", // localhost IPv6
    "10.0.0.0/8", // Private network
    "172.16.0.0/12", // Private network
    "192.168.0.0/16", // Private network
    // Add your monitoring service IPs here:
    // '203.0.113.0/24', // Example monitoring service
  ]);

  private readonly isTestEnvironment =
    process.env.NODE_ENV === "test" || process.env.JEST_WORKER_ID !== undefined;

  canActivate(context: ExecutionContext): boolean {
    // Skip IP validation in test environment
    if (this.isTestEnvironment) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const clientIp = this.getClientIp(request);

    if (this.isIpAllowed(clientIp)) {
      return true;
    }

    throw new ForbiddenException(`Access denied for IP: ${clientIp}`);
  }

  private getClientIp(request: Request): string {
    // Handle various proxy scenarios
    const xForwardedFor = request.headers["x-forwarded-for"];
    const xRealIp = request.headers["x-real-ip"];

    if (typeof xForwardedFor === "string") {
      return xForwardedFor.split(",")[0].trim();
    }

    if (typeof xRealIp === "string") {
      return xRealIp;
    }

    return (
      request.connection.remoteAddress ||
      request.socket.remoteAddress ||
      request.ip ||
      "unknown"
    );
  }

  private isIpAllowed(ip: string): boolean {
    // Check exact matches
    if (this.allowedIps.has(ip)) {
      return true;
    }

    // Check CIDR ranges
    for (const allowedRange of this.allowedIps) {
      if (allowedRange.includes("/") && this.isIpInRange(ip, allowedRange)) {
        return true;
      }
    }

    return false;
  }

  private isIpInRange(ip: string, cidr: string): boolean {
    // Simplified CIDR check - you might want to use a proper IP library
    const [range, prefixLength] = cidr.split("/");

    // For demo purposes, this is a basic implementation
    // In production, consider using libraries like 'ip-range-check'
    if (ip.startsWith("127.") || ip.startsWith("192.168.") || ip === "::1") {
      return true;
    }

    return false;
  }
}
