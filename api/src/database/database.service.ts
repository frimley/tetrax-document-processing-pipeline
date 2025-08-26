import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { Pool, PoolClient, QueryResult } from "pg";

export interface FileRecord {
  id: string;
  name: string;
  project_id: string;
  s3_object_key: string;
  size_bytes: number;
  sha256_checksum: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateFileParams {
  name: string;
  project_id: string;
  s3_object_key: string;
  size_bytes: number;
  sha256_checksum: string;
}

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private pool: Pool;

  async onModuleInit() {
    this.pool = new Pool({
      host: process.env.POSTGRES_HOST || "localhost",
      port: parseInt(process.env.POSTGRES_PORT || "5432"),
      database: process.env.POSTGRES_DATABASE || "tetrax_dev",
      user: process.env.POSTGRES_USER || "postgres",
      password: process.env.POSTGRES_PASSWORD || "password",
      max: 20, // Maximum number of connections in pool
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    try {
      // Test connection
      const client = await this.pool.connect();
      console.log("Connected to PostgreSQL database");
      client.release();
    } catch (error) {
      console.error("Failed to connect to PostgreSQL:", error);
      throw error;
    }
  }

  async onModuleDestroy() {
    if (this.pool) {
      await this.pool.end();
      console.log("PostgreSQL pool closed");
    }
  }

  /**
   * Check if a file with the same SHA-256 already exists for the project
   */
  async findExistingFileByHash(
    projectId: string,
    sha256Checksum: string
  ): Promise<FileRecord | null> {
    const query = `
      SELECT id, name, project_id, s3_object_key, size_bytes, 
             sha256_checksum, created_at, updated_at
      FROM files 
      WHERE project_id = $1 AND sha256_checksum = $2
      ORDER BY created_at ASC
      LIMIT 1
    `;

    try {
      const result: QueryResult<FileRecord> = await this.pool.query(query, [
        projectId,
        sha256Checksum,
      ]);

      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error("Error finding existing file by hash:", error);
      throw error;
    }
  }

  /**
   * Create a new file record
   */
  async createFile(params: CreateFileParams): Promise<FileRecord> {
    const query = `
      INSERT INTO files (id, name, project_id, s3_object_key, size_bytes, 
                         sha256_checksum)
      VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
      RETURNING id, name, project_id, s3_object_key, size_bytes, 
                sha256_checksum, created_at, updated_at
    `;

    try {
      const result: QueryResult<FileRecord> = await this.pool.query(query, [
        params.name,
        params.project_id,
        params.s3_object_key,
        params.size_bytes,
        params.sha256_checksum,
      ]);

      return result.rows[0];
    } catch (error) {
      console.error("Error creating file record:", error);
      throw error;
    }
  }

  /**
   * Update a file record
   */
  async updateFile(
    fileId: string,
    updates: Partial<Omit<FileRecord, "id" | "created_at">>
  ): Promise<FileRecord | null> {
    const setClause = [];
    const values = [];
    let paramIndex = 1;

    // Build dynamic UPDATE query
    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        setClause.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    });

    if (setClause.length === 0) {
      throw new Error("No fields to update");
    }

    // Add updated_at
    setClause.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(fileId); // Add fileId as last parameter

    const query = `
      UPDATE files 
      SET ${setClause.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING id, name, project_id, s3_object_key, size_bytes, 
                sha256_checksum, created_at, updated_at
    `;

    try {
      const result: QueryResult<FileRecord> = await this.pool.query(
        query,
        values
      );

      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error("Error updating file record:", error);
      throw error;
    }
  }

  /**
   * Delete a file record
   */
  async deleteFile(fileId: string): Promise<boolean> {
    const query = `DELETE FROM files WHERE id = $1`;

    try {
      const result = await this.pool.query(query, [fileId]);
      return result.rowCount > 0;
    } catch (error) {
      console.error("Error deleting file record:", error);
      throw error;
    }
  }

  /**
   * Get file by ID
   */
  async getFileById(fileId: string): Promise<FileRecord | null> {
    const query = `
      SELECT id, name, project_id, s3_object_key, size_bytes, 
             sha256_checksum, created_at, updated_at
      FROM files 
      WHERE id = $1
    `;

    try {
      const result: QueryResult<FileRecord> = await this.pool.query(query, [
        fileId,
      ]);

      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error("Error getting file by ID:", error);
      throw error;
    }
  }

  /**
   * Health check for database connectivity
   */
  async healthCheck(): Promise<void> {
    const query = "SELECT 1 as health_check";

    try {
      await this.pool.query(query);
    } catch (error) {
      console.error("Database health check failed:", error);
      throw error;
    }
  }

  /**
   * Execute a transaction
   */
  async transaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");
      const result = await callback(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
