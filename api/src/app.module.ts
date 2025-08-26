import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

// Feature Modules
import { AuthModule } from "./auth/auth.module";
import { UploadsModule } from "./uploads/uploads.module";
import { HealthModule } from "./health/health.module";

// Shared Infrastructure
import { SharedModule } from "./shared/shared.module";

/**
 * Root Application Module
 * Orchestrates all feature modules and shared services
 */
@Module({
  imports: [
    // Global Configuration
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // Shared Infrastructure Services
    SharedModule,

    // Feature Modules
    AuthModule,
    UploadsModule,
    HealthModule,
  ],
})
export class AppModule {}
