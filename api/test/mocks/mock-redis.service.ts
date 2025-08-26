import { Injectable } from "@nestjs/common";
import { UploadSession } from "../../src/redis/redis.service";

@Injectable()
export class MockRedisService {
  private sessions = new Map<string, UploadSession>();
  private pathLocks = new Map<string, string>();

  async ping(): Promise<string> {
    return "PONG";
  }

  async setUploadSession(
    fileId: string,
    session: UploadSession
  ): Promise<void> {
    this.sessions.set(fileId, { ...session });
  }

  async getUploadSession(fileId: string): Promise<UploadSession | null> {
    return this.sessions.get(fileId) || null;
  }

  async updateUploadSession(
    fileId: string,
    updates: Partial<UploadSession>
  ): Promise<void> {
    const existing = this.sessions.get(fileId);
    if (existing) {
      this.sessions.set(fileId, { ...existing, ...updates });
    }
  }

  async deleteUploadSession(fileId: string): Promise<void> {
    this.sessions.delete(fileId);
  }

  async setPathLock(
    projectId: string,
    filePath: string,
    fileId: string
  ): Promise<void> {
    const key = `${projectId}:${filePath}`;
    this.pathLocks.set(key, fileId);
  }

  async getPathLock(
    projectId: string,
    filePath: string
  ): Promise<string | null> {
    const key = `${projectId}:${filePath}`;
    return this.pathLocks.get(key) || null;
  }

  async deletePathLock(projectId: string, filePath: string): Promise<void> {
    const key = `${projectId}:${filePath}`;
    this.pathLocks.delete(key);
  }

  async findSessionByPath(
    projectId: string,
    filePath: string
  ): Promise<UploadSession | null> {
    for (const session of this.sessions.values()) {
      if (session.projectId === projectId && session.filePath === filePath) {
        return session;
      }
    }
    return null;
  }

  // Test helpers
  reset(): void {
    this.sessions.clear();
    this.pathLocks.clear();
  }

  getSessionCount(): number {
    return this.sessions.size;
  }

  getAllSessions(): UploadSession[] {
    return Array.from(this.sessions.values());
  }
}
