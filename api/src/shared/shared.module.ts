import { Module } from "@nestjs/common";
import { RedisModule } from "../redis/redis.module";
import { S3Module } from "../s3/s3.module";
import { DatabaseModule } from "../database/database.module";
import { HashService } from "../common/hash.service";

/**
 * Shared Module
 * Contains common services used across multiple feature modules
 */
@Module({
  imports: [RedisModule, S3Module, DatabaseModule],
  providers: [HashService],
  exports: [RedisModule, S3Module, DatabaseModule, HashService],
})
export class SharedModule {}
