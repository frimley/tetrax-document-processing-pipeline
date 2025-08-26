import { Injectable } from "@nestjs/common";
import { createHash, Hash } from "crypto";

@Injectable()
export class HashService {
  /**
   * Create a new SHA-256 hash context
   */
  createSHA256Context(): string {
    const hash = createHash("sha256");
    // We can't directly serialize crypto.Hash, so we'll use a different approach
    // Store the accumulated data in base64 for now
    return JSON.stringify({ algorithm: "sha256", data: "" });
  }

  /**
   * Update hash context with new data
   */
  updateSHA256Context(contextData: string, newData: Buffer): string {
    try {
      const context = JSON.parse(contextData);

      // Combine existing data with new data
      const existingBuffer = context.data
        ? Buffer.from(context.data, "base64")
        : Buffer.alloc(0);
      const combinedData = Buffer.concat([existingBuffer, newData]);

      return JSON.stringify({
        algorithm: "sha256",
        data: combinedData.toString("base64"),
      });
    } catch (error) {
      // If context is corrupted, start fresh
      return JSON.stringify({
        algorithm: "sha256",
        data: newData.toString("base64"),
      });
    }
  }

  /**
   * Finalize hash and return hex digest
   */
  finalizeSHA256(contextData: string): string {
    try {
      const context = JSON.parse(contextData);
      const data = Buffer.from(context.data, "base64");

      return createHash("sha256").update(data).digest("hex");
    } catch (error) {
      throw new Error("Invalid hash context data");
    }
  }

  /**
   * Calculate SHA-256 for ordered parts (more efficient for large files)
   */
  calculateSHA256FromParts(
    parts: { partNumber: number; data: Buffer }[]
  ): string {
    // Sort parts by part number to ensure correct order
    const sortedParts = parts.sort((a, b) => a.partNumber - b.partNumber);

    const hash = createHash("sha256");
    for (const part of sortedParts) {
      hash.update(part.data);
    }

    return hash.digest("hex");
  }

  /**
   * Verify a hash matches expected value
   */
  verifyHash(data: Buffer, expectedHash: string): boolean {
    const actualHash = createHash("sha256").update(data).digest("hex");
    return actualHash === expectedHash;
  }
}
