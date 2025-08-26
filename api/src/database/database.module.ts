import { Module } from "@nestjs/common";
import { DatabaseService } from "./database.service";

/**
 * Database Module
 * Provides PostgreSQL database connectivity and operations
 */
@Module({
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
