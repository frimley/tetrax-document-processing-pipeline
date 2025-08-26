import { BadRequestException } from "@nestjs/common";
import * as path from "path";

export function normalizeFilePath(filePath: string): string {
  // Remove leading slash if present
  if (filePath.startsWith("/")) {
    filePath = filePath.substring(1);
  }

  // Normalize the path (collapse .. and .)
  const normalized = path.normalize(filePath);

  // Ensure no .. escapes
  if (normalized.includes("..")) {
    throw new BadRequestException('Invalid file path: cannot contain ".."');
  }

  // Replace backslashes with forward slashes for consistency
  return normalized.replace(/\\/g, "/");
}

export function calculateChunkSize(fileSize: number): number {
  // Default chunk size is 8MB (8 * 1024 * 1024)
  const defaultChunkSize = 8388608;

  // TODO: For very large files, we might want larger chunks
  /*
  if (fileSize > 1024 * 1024 * 1024) { // > 1GB
    return defaultChunkSize * 2; // 16MB chunks
  }
  */

  return defaultChunkSize;
}

export function calculateTotalChunks(
  fileSize: number,
  chunkSize: number
): number {
  return Math.ceil(fileSize / chunkSize);
}

export function validatePartNumber(
  partNumber: number,
  totalChunks: number
): void {
  if (partNumber < 1 || partNumber > totalChunks) {
    throw new BadRequestException(
      `Invalid part number: must be between 1 and ${totalChunks}`
    );
  }
}

export function validateContentLength(
  contentLength: number,
  chunkSize: number,
  partNumber: number,
  totalChunks: number,
  fileSize: number
): void {
  const isLastPart = partNumber === totalChunks;
  const expectedSize = isLastPart
    ? fileSize - chunkSize * (totalChunks - 1)
    : chunkSize;

  if (contentLength !== expectedSize) {
    throw new BadRequestException(
      `Invalid content length: expected ${expectedSize}, got ${contentLength}`
    );
  }
}

export function getMissingParts(
  received: number[],
  totalChunks: number
): number[] {
  const missing: number[] = [];
  for (let i = 1; i <= totalChunks; i++) {
    if (!received.includes(i)) {
      missing.push(i);
    }
  }
  return missing;
}
