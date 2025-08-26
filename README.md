# TetraxAI File Upload API

A robust NestJS-based file upload API that supports both multipart (resumable) and single file uploads with SHA-256 deduplication, S3 storage, and comprehensive health monitoring.

## API Implementation

### Core Features

- **Multipart File Uploads**: Resumable uploads for large files with chunk-based processing
- **Single File Uploads**: Direct upload for any file size in one request
- **SHA-256 Deduplication**: Automatic duplicate detection and prevention
- **S3 Storage**: MinIO/AWS S3 integration with metadata support
- **Redis Session Management**: Upload progress tracking and session persistence
- **PostgreSQL Database**: File record management and project organization
- **Health Monitoring**: Four-tier health check system for production monitoring
- **JWT Authentication**: Mock authentication system (configurable for production)

### Technology Stack

- **Framework**: NestJS (Node.js/TypeScript)
- **Storage**: MinIO/AWS S3 for file storage
- **Database**: PostgreSQL for metadata and file records
- **Cache/Sessions**: Redis for upload session management
- **Authentication**: JWT with Passport (mock implementation included)
- **Validation**: class-validator for request validation
- **Testing**: Jest with E2E testing suite

## API Endpoints

| Method   | Endpoint                        | Purpose                                       |
| -------- | ------------------------------- | --------------------------------------------- |
| `POST`   | `/uploads/startMultiPartUpload` | Initialize resumable multipart upload         |
| `PUT`    | `/uploads/uploadPart`           | Upload individual file chunks                 |
| `GET`    | `/uploads/fileStatus`           | Check upload progress and status              |
| `POST`   | `/uploads/endMultiPartUpload`   | Complete multipart upload with deduplication  |
| `DELETE` | `/uploads/abortMultiPartUpload` | Cancel and cleanup incomplete upload          |
| `POST`   | `/uploads/uploadFile`           | Upload complete file in single request        |
| `GET`    | `/health`                       | Comprehensive health check (all dependencies) |
| `GET`    | `/health/ready`                 | Kubernetes readiness probe                    |
| `GET`    | `/health/live`                  | Kubernetes liveness probe                     |
| `GET`    | `/health/ping`                  | Lightweight ping for load balancers           |

## Local Development Setup

### Prerequisites

- **Node.js**: Version 18+ (for native fetch support)
- **Docker & Docker Compose**: For local infrastructure
- **Git**: For version control

### 1. Clone and Install

```bash
# Clone the repository
git clone <repository-url>
cd api

# Install dependencies
npm install
```

### 2. Start Infrastructure Services

```bash
# From the root repository directory
cd ..
docker compose up -d

# Verify services are running
docker compose ps
```

### 3. Environment Configuration

```bash
# The .env.development file is pre-configured for local Docker services
```

### 4. Build and Start API

```bash
# Build the TypeScript project
npm run build

# Start in development mode (with auto-reload)
npm run start:dev

# Or start in production mode
npm run start:prod
```

### 5. Verify Installation

```bash
# Test health endpoints
npm run test:health

# Run comprehensive test suite
npm run test:e2e

# Test file upload functionality
npm run test:manual
```

The API will be available at: **http://localhost:3002**

## Docker Infrastructure

The project uses Docker Compose to provide local development infrastructure with three key services:

### MinIO (S3-Compatible Storage)

- **Purpose**: File storage backend compatible with AWS S3 API
- **Port**: 9000 (API), 9001 (Web UI)
- **Web UI**: http://localhost:9001
- **Credentials**:
  - Username: `minio`
  - Password: `minio12345`
- **Buckets**: Auto-created `test-company-bucket`
- **Features**:
  - S3-compatible API for file operations
  - Web-based file browser and management
  - Automatic bucket initialization
  - Persistent storage via Docker volumes

### PostgreSQL Database

- **Purpose**: Metadata storage for file records, projects, and users
- **Port**: 5432
- **Database**: `tetrax`
- **Credentials**:
  - Username: `postgres`
  - Password: `postgres`
- **Features**:
  - Auto-initialized schema with test data
  - Foreign key constraints for data integrity
  - Optimized indexes for file deduplication queries
  - Test project and user data pre-loaded

### Redis Cache

- **Purpose**: Upload session management and temporary data storage
- **Port**: 6379
- **Features**:
  - Session persistence for resumable uploads
  - SHA-256 hash context storage for incremental hashing
  - Path locking to prevent concurrent uploads
  - Fast in-memory operations for upload state

### Docker Compose Commands

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f

# Stop all services
docker compose down

# Reset all data (removes volumes)
docker compose down -v

# Restart specific service
docker compose restart minio
```

## Testing

### Test Scripts Available

```bash
# Health endpoint testing
npm run test:health

# E2E test suite (mocked dependencies)
npm run test:e2e

# Manual multipart upload test (real services)
npm run test:manual

# Single file upload test
npm run test:single

# Shell-based upload test
npm run test:curl
```

### Test Environment

- **Mocked Services**: E2E tests use mocked S3, Redis, and Database services
- **Real Services**: Manual tests use actual Docker infrastructure
- **Test Data**: Pre-configured test projects and users in PostgreSQL
- **Isolation**: Each test run uses fresh mock state or separate file paths

## File Upload Flow

### Multipart Upload (Large Files)

1. `POST /uploads/startMultiPartUpload` - Initialize session
2. `PUT /uploads/uploadPart` - Upload chunks (repeatable)
3. `GET /uploads/fileStatus` - Check progress (optional)
4. `POST /uploads/endMultiPartUpload` - Finalize with deduplication

### Single File Upload (Any Size)

1. `POST /uploads/uploadFile` - Complete upload with deduplication

### Deduplication Process

- SHA-256 hash calculated incrementally during upload
- Database checked for existing files with same hash in project
- Duplicates rejected without storage or database records
- Unique files stored with hash-based S3 keys

## Configuration

Key environment variables (see `.env.development`):

```bash
# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/tetrax_dev

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# MinIO/S3
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minio
S3_SECRET_KEY=minio12345
S3_BUCKET=test-company-bucket

# API
PORT=3002
NODE_ENV=development
```

## Architecture

The API follows NestJS modular architecture:

- **Uploads Module**: File upload operations and multipart handling
- **Auth Module**: JWT authentication (mock implementation)
- **Health Module**: Comprehensive health monitoring
- **Shared Module**: Common services (Redis, S3, Database, Hashing)
- **Common Module**: Utilities, guards, and shared components

## Production Considerations

- Replace mock JWT authentication with real implementation
- Configure proper S3 credentials and bucket policies
- Set up database migrations and backups
- Implement proper logging and monitoring
- Configure rate limiting and security headers
- Set up SSL/TLS certificates

## Development Notes

- Hot reload enabled in development mode
- TypeScript strict mode enforced
- Comprehensive error handling and validation
- Docker services auto-restart on failure
- Test coverage includes happy path and error scenarios
