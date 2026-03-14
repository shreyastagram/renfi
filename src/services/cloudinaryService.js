/**
 * Cloudinary Service
 *
 * Handles signed uploads to Cloudinary via the backend.
 * All uploads go through the backend to get a short-lived signature,
 * then upload directly to Cloudinary with that signature.
 *
 * This prevents abuse of unsigned upload presets.
 *
 * @version 1.0.0
 */

import { Platform } from 'react-native';
import { NODE_BASE_URL, ENDPOINTS } from '../config/api';
import { authFetch } from '../utils/authFetch';

/**
 * Get a signed upload signature from the backend.
 *
 * @param {string} context - Upload context: profile, portfolio, insurance, documents, service_approvals
 * @param {string} [subFolder] - Optional sub-folder (e.g. service category)
 * @returns {Promise<Object>} { signature, timestamp, folder, cloudName, apiKey }
 */
const getUploadSignature = async (context, subFolder) => {
  const params = new URLSearchParams({ context });
  if (subFolder) params.append('subFolder', subFolder);

  const url = `${NODE_BASE_URL}${ENDPOINTS.UPLOAD.SIGNATURE}?${params.toString()}`;
  const response = await authFetch(url);
  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Failed to get upload signature');
  }

  return data;
};

/**
 * Upload a file to Cloudinary using a signed request.
 *
 * @param {Object} params
 * @param {string} params.uri - Local file URI
 * @param {string} [params.type] - MIME type (default: 'image/jpeg')
 * @param {string} [params.fileName] - File name
 * @param {string} params.context - Upload context: profile, portfolio, insurance, documents, service_approvals
 * @param {string} [params.subFolder] - Optional sub-folder (e.g. service category)
 * @param {number} [params.timeout] - Upload timeout in ms (default: 30000)
 * @returns {Promise<Object>} { secure_url, public_id, format, bytes, original_filename, ... }
 */
export const signedUpload = async ({
  uri,
  type = 'image/jpeg',
  fileName,
  context,
  subFolder,
  timeout = 30000,
}) => {
  // 1. Get signature from backend
  const sig = await getUploadSignature(context, subFolder);

  // 2. Fix Android URI
  let fileUri = uri;
  if (Platform.OS === 'android' && !fileUri.startsWith('file://')) {
    fileUri = `file://${fileUri}`;
  }

  // 3. Build FormData with signature params
  // Only include params that were signed (timestamp + folder).
  // upload_preset is NOT included — signed uploads don't need it.
  const formData = new FormData();
  formData.append('file', {
    uri: fileUri,
    type,
    name: fileName || `upload_${Date.now()}.${type.split('/')[1] || 'jpg'}`,
  });
  formData.append('folder', sig.folder);
  formData.append('timestamp', sig.timestamp.toString());
  formData.append('signature', sig.signature);
  formData.append('api_key', sig.apiKey);

  // 4. Upload to Cloudinary with timeout
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeout);

  // Use /auto/upload to support both images and PDFs
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${sig.cloudName}/auto/upload`,
    {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    },
  );
  clearTimeout(tid);

  const data = await response.json();

  if (!data.secure_url) {
    throw new Error(data.error?.message || 'Cloudinary upload failed');
  }

  return data;
};

/**
 * Upload a profile picture (convenience wrapper).
 *
 * @param {string} imageUri - Local image URI
 * @returns {Promise<{url: string, publicId: string}>}
 */
export const uploadProfilePicture = async (imageUri) => {
  const data = await signedUpload({
    uri: imageUri,
    type: 'image/jpeg',
    fileName: `profile_${Date.now()}.jpg`,
    context: 'profile',
  });
  return { url: data.secure_url, publicId: data.public_id };
};

/**
 * Upload a portfolio image (convenience wrapper).
 *
 * @param {string} imageUri - Local image URI
 * @returns {Promise<{url: string, publicId: string}>}
 */
export const uploadPortfolioImage = async (imageUri) => {
  const data = await signedUpload({
    uri: imageUri,
    type: 'image/jpeg',
    fileName: `portfolio_${Date.now()}.jpg`,
    context: 'portfolio',
  });
  return { url: data.secure_url, publicId: data.public_id };
};

/**
 * Upload a document (insurance, verification, service approvals).
 *
 * @param {Object} params
 * @param {string} params.uri - Local file URI
 * @param {string} params.type - MIME type
 * @param {string} params.fileName - File name
 * @param {string} params.context - 'insurance', 'documents', or 'service_approvals'
 * @param {string} [params.serviceCategory] - Service category sub-folder
 * @returns {Promise<Object>} Cloudinary response data
 */
export const uploadDocument = async ({ uri, type, fileName, context, serviceCategory }) => {
  return signedUpload({
    uri,
    type,
    fileName,
    context,
    subFolder: serviceCategory,
  });
};

export default {
  signedUpload,
  uploadProfilePicture,
  uploadPortfolioImage,
  uploadDocument,
};
