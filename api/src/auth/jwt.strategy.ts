import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";

export interface JwtPayload {
  sub?: string;
  email?: string;
  iat?: number;
  exp?: number;
  [key: string]: any;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: true, // Mock: ignore expiration
      secretOrKey: "mock-secret-key",
      // Mock: accept any token format
      jsonWebTokenOptions: {
        ignoreExpiration: true,
        ignoreNotBefore: true,
      },
    });
  }

  async validate(payload: any) {
    // Mock: always return a valid user regardless of payload
    return {
      userId: payload?.sub || "mock-user-id",
      email: payload?.email || "mock@example.com",
    };
  }
}
