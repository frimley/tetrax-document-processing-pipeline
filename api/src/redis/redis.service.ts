import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { createClient, RedisClientType } from "redis";

export interface UploadSession {
  fileId: string;
  uploadId: string;
  key: string;
  chunkSize: number;
  totalChunks: number;
  projectId: string;
  filePath: string;
  size: number;
  mime: string;
  received: number[];
  etags: { [partNumber: number]: string };
  bytesUploaded: number;
  sha256Context?: string; // Base64 encoded incremental hash state
  sha256Hash?: string; // Final SHA-256 hash
  createdAt: string;
}

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: RedisClientType;

  async onModuleInit() {
    this.client = createClient({
      socket: {
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT || "6379"),
      },
      password: process.env.REDIS_PASSWORD || undefined,
    });

    this.client.on("error", (err) => console.log("Redis Client Error", err));
    await this.client.connect();
    console.log("Connected to Redis");
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  /**
   * Health check - ping Redis
   */
  async ping(): Promise<string> {
    return await this.client.ping();
  }

  async setUploadSession(
    fileId: string,
    session: UploadSession
  ): Promise<void> {
    await this.client.setEx(
      `upload:${fileId}`,
      3600 * 24, // 24 hours TTL
      JSON.stringify(session)
    );
  }

  async getUploadSession(fileId: string): Promise<UploadSession | null> {
    const session = await this.client.get(`upload:${fileId}`);
    return session ? JSON.parse(session) : null;
  }

  async updateUploadSession(
    fileId: string,
    updates: Partial<UploadSession>
  ): Promise<void> {
    const session = await this.getUploadSession(fileId);
    if (session) {
      const updatedSession = { ...session, ...updates };
      await this.setUploadSession(fileId, updatedSession);
    }
  }

  async deleteUploadSession(fileId: string): Promise<void> {
    await this.client.del(`upload:${fileId}`);
  }

  async setPathLock(
    projectId: string,
    filePath: string,
    fileId: string
  ): Promise<void> {
    const key = `lock:${projectId}:${Buffer.from(filePath).toString("base64")}`;
    await this.client.setEx(key, 3600 * 24, fileId); // 24 hours TTL
  }

  async getPathLock(
    projectId: string,
    filePath: string
  ): Promise<string | null> {
    const key = `lock:${projectId}:${Buffer.from(filePath).toString("base64")}`;
    return await this.client.get(key);
  }

  async deletePathLock(projectId: string, filePath: string): Promise<void> {
    const key = `lock:${projectId}:${Buffer.from(filePath).toString("base64")}`;
    await this.client.del(key);
  }

  async findSessionByPath(
    projectId: string,
    filePath: string
  ): Promise<UploadSession | null> {
    const fileId = await this.getPathLock(projectId, filePath);
    if (fileId) {
      return await this.getUploadSession(fileId);
    }
    return null;
  }
}
