// Storage service — no-op stubs (replace with S3 in production)
export async function uploadToS3(buffer, key, mimeType) {
  console.log(`[storage] uploadToS3 called for key: ${key} (stub)`);
  return { url: `/uploads/${key}`, key };
}
export async function getSignedUrl(key, expiresIn = 3600) {
  return `/uploads/${key}`;
}
export async function deleteFromS3(key) {
  console.log(`[storage] deleteFromS3 called for key: ${key} (stub)`);
  return true;
}
