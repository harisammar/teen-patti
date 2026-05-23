import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

/**
 * Resizes and compresses a local image to a compact JPEG, then returns it
 * as a data URI (data:image/jpeg;base64,...).
 *
 * Storing the data URI directly in Firestore bypasses Firebase Storage entirely,
 * which means no bucket setup is required. A 200×200 JPEG at quality 0.5 stays
 * well under 20 KB — far below Firestore's 1 MB document limit.
 *
 * The uid parameter is kept for API compatibility; it is not used here because
 * no remote upload occurs.
 */
export async function uploadProfilePicture(_uid: string, localUri: string): Promise<string> {
  const result = await manipulateAsync(
    localUri,
    [{ resize: { width: 200, height: 200 } }],
    { compress: 0.5, format: SaveFormat.JPEG, base64: true },
  );

  if (!result.base64) {
    throw new Error('Image processing failed — no base64 output.');
  }

  return `data:image/jpeg;base64,${result.base64}`;
}

/**
 * No-op: previously deleted from Firebase Storage.
 * Kept so callers don't need to change.
 */
export async function deleteProfilePicture(_uid: string): Promise<void> {
  // Nothing to delete — photo lives in Firestore as a data URI.
}
