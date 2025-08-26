import { Controller, Get, HttpStatus, Res, UseGuards } from "@nestjs/common";
import { Response } from "express";
import { RedisService } from "../redis/redis.service";
import { S3Service } from "../s3/s3.service";
import { DatabaseService } from "../database/database.service";
import { IpWhitelistGuard } from "../common/guards/ip-whitelist.guard";
import { RateLimitGuard } from "../common/guards/rate-limit.guard";

@Controller("health")
export class HealthController {
  constructor(
    private readonly redisService: RedisService,
    private readonly s3Service: S3Service,
    private readonly databaseService: DatabaseService
  ) {}

  @Get()
  @UseGuards(IpWhitelistGuard, RateLimitGuard)
  async getHealth(@Res() res: Response) {
    const timestamp = new Date().toISOString();
    let overallStatus = "ok";
    const services: any = {};

    // Check Redis
    try {
      await this.redisService.ping();
      services.redis = {
        status: "connected",
        message: "Redis ping successful",
      };
    } catch (error) {
      services.redis = { status: "error", message: error.message };
      overallStatus = "degraded";
    }

    // Check S3/MinIO
    try {
      await this.s3Service.healthCheck();
      services.s3 = { status: "connected", message: "S3 access successful" };
    } catch (error) {
      services.s3 = { status: "error", message: error.message };
      overallStatus = "degraded";
    }

    // Check Database
    try {
      await this.databaseService.healthCheck();
      services.database = {
        status: "connected",
        message: "Database access successful",
      };
    } catch (error) {
      services.database = { status: "error", message: error.message };
      overallStatus = "degraded";
    }

    const healthResponse = {
      status: overallStatus,
      timestamp,
      environment: process.env.NODE_ENV || "development",
      services,
      uptime: process.uptime(),
    };

    // Return appropriate HTTP status
    const httpStatus =
      overallStatus === "ok" ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;
    res.status(httpStatus).json(healthResponse);
  }

  @Get("ready")
  @UseGuards(IpWhitelistGuard, RateLimitGuard)
  async getReadiness(@Res() res: Response) {
    // Readiness check - can we handle requests?
    try {
      // Quick dependency checks
      await Promise.all([
        this.redisService.ping(),
        this.s3Service.healthCheck(),
        this.databaseService.healthCheck(),
      ]);

      res.status(HttpStatus.OK).json({
        status: "ready",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        status: "not ready",
        timestamp: new Date().toISOString(),
        error: error.message,
      });
    }
  }

  @Get("live")
  @UseGuards(RateLimitGuard) // Only rate limit, no IP restriction
  getLiveness() {
    // Liveness check - is the app running?
    return {
      status: "alive",
      timestamp: new Date().toISOString(),
      pid: process.pid,
      uptime: process.uptime(),
    };
  }

  @Get("ping")
  // Public endpoint - minimal security for load balancers
  ping() {
    // Ultra-lightweight health check - no dependency verification
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
    };
  }
}
