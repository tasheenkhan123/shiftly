import { createWorker } from 'tesseract.js';

/**
 * Runs quick OCR on uploaded base64 / data URL screenshot to extract visible text and product labels.
 */
export async function extractTextFromImage(imageUrl: string): Promise<string> {
  if (!imageUrl || !imageUrl.startsWith('data:image')) {
    return '';
  }

  try {
    const worker = await createWorker('eng');
    const ret = await worker.recognize(imageUrl);
    await worker.terminate();
    return ret.data.text.trim();
  } catch (error) {
    console.warn('OCR extraction skipped or failed:', error);
    return '';
  }
}
