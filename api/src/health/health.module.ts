import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { SharedModule } from "../shared/shared.module";

/**
 * Health Module
 * Provides health check endpoints for monitoring and deployment
 */
@Module({
  imports: [SharedModule],
  controllers: [HealthController],
})
export class HealthModule {}
