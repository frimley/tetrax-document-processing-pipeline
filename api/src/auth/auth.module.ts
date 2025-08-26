import { Module } from "@nestjs/common";
import { MockJwtAuthGuard } from "./mock-jwt-auth.guard";

@Module({
  providers: [MockJwtAuthGuard],
  exports: [MockJwtAuthGuard],
})
export class AuthModule {}
