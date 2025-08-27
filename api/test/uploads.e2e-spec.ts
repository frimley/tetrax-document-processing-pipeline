import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "../src/app.module";
import { v4 as uuidv4 } from "uuid";
import { S3Service } from "../src/s3/s3.service";
import { RedisService } from "../src/redis/redis.service";
import { DatabaseService } from "../src/database/database.service";
import { MockS3Service } from "./mocks/mock-s3.service";
import { MockRedisService } from "./mocks/mock-redis.service";
import { MockDatabaseService } from "./mocks/mock-database.service";

describe("Uploads E2E", () => {
  let app: INestApplication;
  let authToken: string;
  let projectId: string;
  let mockS3Service: MockS3Service;
  let mockRedisService: MockRedisService;
  let mockDatabaseService: MockDatabaseService;

  beforeAll(async () => {
    // Set test environment
    process.env.NODE_ENV = "test";

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(S3Service)
      .useClass(MockS3Service)
      .overrideProvider(RedisService)
      .useClass(MockRedisService)
      .overrideProvider(DatabaseService)
      .useClass(MockDatabaseService)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Get mock services for test helpers
    mockS3Service = app.get<MockS3Service>(S3Service);
    mockRedisService = app.get<MockRedisService>(RedisService);
    mockDatabaseService = app.get<MockDatabaseService>(DatabaseService);

    // Setup test data
    authToken = "test-token-123";
    projectId = "123e4567-e89b-12d3-a456-426614174001";
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    // Reset mocks before each test
    mockS3Service.reset();
    mockRedisService.reset();
    mockDatabaseService.reset();
  });

  describe("Health Endpoints", () => {
    it("/health/ping (GET) - public endpoint", () => {
      return request(app.getHttpServer())
        .get("/health/ping")
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty("status", "ok");
          expect(res.body).toHaveProperty("timestamp");
        });
    });

    it("/health (GET) - full health check", () => {
      return request(app.getHttpServer())
        .get("/health")
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty("status", "ok");
          expect(res.body).toHaveProperty("timestamp");
          expect(res.body).toHaveProperty("environment");
          expect(res.body).toHaveProperty("services");
          expect(res.body.services).toHaveProperty("redis");
          expect(res.body.services).toHaveProperty("s3");
          expect(res.body.services).toHaveProperty("database");
        });
    });

    it("/health/ready (GET) - readiness check", () => {
      return request(app.getHttpServer())
        .get("/health/ready")
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty("status", "ready");
          expect(res.body).toHaveProperty("timestamp");
        });
    });

    it("/health/live (GET) - liveness check", () => {
      return request(app.getHttpServer())
        .get("/health/live")
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty("status", "alive");
          expect(res.body).toHaveProperty("timestamp");
          expect(res.body).toHaveProperty("pid");
          expect(res.body).toHaveProperty("uptime");
        });
    });
  });

  describe("Upload Flow", () => {
    let fileId: string;
    let chunkSize: number;
    let totalChunks: number;
    const testFile = Buffer.from(
      "This is a test file content for upload testing"
    );

    it("should complete full upload flow", async () => {
      // Step 1: Start multipart upload
      const startResponse = await request(app.getHttpServer())
        .post("/uploads/startMultiPartUpload")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          filePath: "test/upload-test.txt",
          size: testFile.length,
          mime: "text/plain",
          projectId,
        })
        .expect(201);

      expect(startResponse.body).toHaveProperty("fileId");
      expect(startResponse.body).toHaveProperty("chunkSize");
      expect(startResponse.body).toHaveProperty("totalChunks");

      fileId = startResponse.body.fileId;
      chunkSize = startResponse.body.chunkSize;
      totalChunks = startResponse.body.totalChunks;

      // Step 2: Upload file part
      const uploadResponse = await request(app.getHttpServer())
        .put("/uploads/uploadPart")
        .set("Authorization", `Bearer ${authToken}`)
        .set("X-File-Id", fileId)
        .set("X-Part-Number", "1")
        .set("X-Total-Chunks", totalChunks.toString())
        .set("Content-Type", "application/octet-stream")
        .send(testFile)
        .expect(200);

      expect(uploadResponse.body).toHaveProperty("ok", true);
      expect(uploadResponse.body).toHaveProperty("etag");
      expect(uploadResponse.body).toHaveProperty("already", false);

      // Step 3: Check file status
      const statusResponse = await request(app.getHttpServer())
        .get(`/uploads/fileStatus?fileId=${fileId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(statusResponse.body).toHaveProperty("fileId", fileId);
      expect(statusResponse.body).toHaveProperty("status");
      expect(statusResponse.body).toHaveProperty("chunkSize", chunkSize);
      expect(statusResponse.body).toHaveProperty("totalChunks", totalChunks);
      expect(statusResponse.body).toHaveProperty("received");
      expect(statusResponse.body).toHaveProperty("missing");
      expect(statusResponse.body).toHaveProperty("bytesUploaded");
      expect(statusResponse.body.received).toContain(1);

      // Step 4: Complete multipart upload
      const completeResponse = await request(app.getHttpServer())
        .post("/uploads/endMultiPartUpload")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ fileId })
        .expect(201);

      expect(completeResponse.body).toHaveProperty("status", "Received");
      expect(completeResponse.body).toHaveProperty("blobHash");
      expect(completeResponse.body).toHaveProperty("s3Key");

      // Verify file was saved to database
      expect(mockDatabaseService.getFileCount()).toBe(1);
      const savedFiles = mockDatabaseService.getAllFiles();
      expect(savedFiles[0]).toMatchObject({
        project_id: projectId,
        sha256_checksum: completeResponse.body.blobHash,
      });
    });

    it("should detect and handle duplicate files", async () => {
      const testFile = Buffer.from("Duplicate test file content");

      // First, upload a file normally to get its hash
      const firstUploadStart = await request(app.getHttpServer())
        .post("/uploads/startMultiPartUpload")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          filePath: "test/original-file.txt",
          size: testFile.length,
          mime: "text/plain",
          projectId,
        })
        .expect(201);

      const firstFileId = firstUploadStart.body.fileId;
      const totalChunks = firstUploadStart.body.totalChunks;

      // Upload the part
      await request(app.getHttpServer())
        .put("/uploads/uploadPart")
        .set("Authorization", `Bearer ${authToken}`)
        .set("X-File-Id", firstFileId)
        .set("X-Part-Number", "1")
        .set("X-Total-Chunks", totalChunks.toString())
        .set("Content-Type", "application/octet-stream")
        .send(testFile)
        .expect(200);

      // Complete first upload
      const firstCompleteResponse = await request(app.getHttpServer())
        .post("/uploads/endMultiPartUpload")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ fileId: firstFileId })
        .expect(201);

      expect(firstCompleteResponse.body).toHaveProperty("status", "Received");
      const originalHash = firstCompleteResponse.body.blobHash;

      // Now upload the SAME content again - should be detected as duplicate
      const secondUploadStart = await request(app.getHttpServer())
        .post("/uploads/startMultiPartUpload")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          filePath: "test/duplicate-file.txt",
          size: testFile.length,
          mime: "text/plain",
          projectId,
        })
        .expect(201);

      const secondFileId = secondUploadStart.body.fileId;

      // Upload the same content
      await request(app.getHttpServer())
        .put("/uploads/uploadPart")
        .set("Authorization", `Bearer ${authToken}`)
        .set("X-File-Id", secondFileId)
        .set("X-Part-Number", "1")
        .set("X-Total-Chunks", totalChunks.toString())
        .set("Content-Type", "application/octet-stream")
        .send(testFile)
        .expect(200);

      // Complete second upload - should detect duplicate
      const secondCompleteResponse = await request(app.getHttpServer())
        .post("/uploads/endMultiPartUpload")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ fileId: secondFileId })
        .expect(201);

      // Should return Duplicate status
      expect(secondCompleteResponse.body).toHaveProperty("status", "Duplicate");
      expect(secondCompleteResponse.body).toHaveProperty(
        "blobHash",
        originalHash
      );
      expect(secondCompleteResponse.body).toHaveProperty("existingFile");
      expect(secondCompleteResponse.body).toHaveProperty("message");

      // Verify only original file is saved to database (duplicates not saved)
      expect(mockDatabaseService.getFileCount()).toBe(1); // only original
      const files = mockDatabaseService.getAllFiles();
      const originalFile = files[0];

      expect(originalFile).toBeDefined();
      expect(originalFile.sha256_checksum).toBe(originalHash);
      expect(originalFile.project_id).toBe(projectId);
    });

    it("should upload single file successfully", async () => {
      const testFile = Buffer.from("Single file upload test content");

      const response = await request(app.getHttpServer())
        .post("/uploads/uploadFile")
        .set("Authorization", `Bearer ${authToken}`)
        .field("filePath", "test/single-upload.txt")
        .field("mime", "text/plain")
        .field("projectId", projectId)
        .field("originalName", "single-upload.txt")
        .attach("file", testFile, "single-upload.txt")
        .expect(201);

      expect(response.body).toHaveProperty("status", "Received");
      expect(response.body).toHaveProperty("blobHash");
      expect(response.body).toHaveProperty("s3Key");
      expect(response.body).toHaveProperty("fileSize", testFile.length);

      // Verify file was saved to database
      expect(mockDatabaseService.getFileCount()).toBe(1);
      const savedFiles = mockDatabaseService.getAllFiles();
      expect(savedFiles[0]).toMatchObject({
        project_id: projectId,
        sha256_checksum: response.body.blobHash,
        name: "single-upload.txt",
        size_bytes: testFile.length,
      });
    });

    it("should detect duplicate in single file upload", async () => {
      const testFile = Buffer.from("Duplicate single file content");

      // First upload
      const firstResponse = await request(app.getHttpServer())
        .post("/uploads/uploadFile")
        .set("Authorization", `Bearer ${authToken}`)
        .field("filePath", "test/original-single.txt")
        .field("mime", "text/plain")
        .field("projectId", projectId)
        .attach("file", testFile, "original-single.txt")
        .expect(201);

      expect(firstResponse.body).toHaveProperty("status", "Received");
      const originalHash = firstResponse.body.blobHash;

      // Second upload with same content
      const secondResponse = await request(app.getHttpServer())
        .post("/uploads/uploadFile")
        .set("Authorization", `Bearer ${authToken}`)
        .field("filePath", "test/duplicate-single.txt")
        .field("mime", "text/plain")
        .field("projectId", projectId)
        .attach("file", testFile, "duplicate-single.txt")
        .expect(201);

      expect(secondResponse.body).toHaveProperty("status", "Duplicate");
      expect(secondResponse.body).toHaveProperty("blobHash", originalHash);
      expect(secondResponse.body).toHaveProperty("existingFile");
      expect(secondResponse.body).toHaveProperty("message");

      // Verify only original file saved to database (duplicates not saved)
      expect(mockDatabaseService.getFileCount()).toBe(1); // only original
      const files = mockDatabaseService.getAllFiles();
      const originalFile = files[0];

      expect(originalFile).toBeDefined();
      expect(originalFile.sha256_checksum).toBe(originalHash);
    });

    it("should start multipart upload", () => {
      return request(app.getHttpServer())
        .post("/uploads/startMultiPartUpload")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          filePath: "test/upload-test.txt",
          size: testFile.length,
          mime: "text/plain",
          projectId,
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty("fileId");
          expect(res.body).toHaveProperty("chunkSize");
          expect(res.body).toHaveProperty("totalChunks");
          expect(typeof res.body.fileId).toBe("string");
          expect(typeof res.body.chunkSize).toBe("number");
          expect(typeof res.body.totalChunks).toBe("number");
        });
    });
  });

  describe("Error Cases", () => {
    it("should reject requests without auth token", () => {
      return request(app.getHttpServer())
        .post("/uploads/startMultiPartUpload")
        .send({
          filePath: "test/file.txt",
          size: 1024,
          mime: "text/plain",
          projectId,
        })
        .expect(401);
    });

    it("should reject invalid file status queries", () => {
      return request(app.getHttpServer())
        .get("/uploads/fileStatus")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toContain("Either filePath or fileId");
        });
    });

    it("should handle non-existent file upload part", () => {
      return request(app.getHttpServer())
        .put("/uploads/uploadPart")
        .set("Authorization", `Bearer ${authToken}`)
        .set("X-File-Id", "non-existent-file-id")
        .set("X-Part-Number", "1")
        .set("X-Total-Chunks", "1")
        .set("Content-Type", "application/octet-stream")
        .send(Buffer.from("test"))
        .expect(404);
    });
  });
});
