// Video Enhancer - unblurimage.ai (AI upscale to 2K/4K)
import axios from "axios";
import FormData from "form-data";

const API_BASE = "https://api.unwatermark.ai/api";
const UPLOAD_URL = `${API_BASE}/web/common/upload/video`;
const JOB_BASE = `${API_BASE}/web/unblurimage/v1/video-enhancer`;

const HEADERS = {
  "accept": "*/*",
  "accept-language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
  "cache-control": "no-cache",
  "origin": "https://unblurimage.ai",
  "pragma": "no-cache",
  "product-code": "067003",
  "product-serial": "4x9o5v",
  "referer": "https://unblurimage.ai/",
  "sec-ch-ua": '"Not-A.Brand";v="99", "Chromium";v="124"',
  "sec-ch-ua-mobile": "?1",
  "sec-ch-ua-platform": '"Android"',
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "cross-site",
  "user-agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
};

/**
 * Step 1: Get pre-signed upload URL from API
 * @param {string} fileName - nama file video
 * @returns {{ url: string, object_name: string }}
 */
async function getUploadConfig(fileName) {
  const form = new FormData();
  form.append("video_file_name", fileName);

  const { data } = await axios.post(UPLOAD_URL, form, {
    headers: {
      ...HEADERS,
      ...form.getHeaders(),
    },
    timeout: 30000,
  });

  if (!data?.result?.url) throw new Error("Gagal dapat upload URL");
  return data.result;
}

/**
 * Step 2: Upload video binary ke OSS via pre-signed URL
 * @param {Buffer} buffer - video buffer
 * @param {string} uploadUrl - pre-signed OSS URL
 */
async function uploadToOSS(buffer, uploadUrl) {
  await axios.put(uploadUrl, buffer, {
    headers: {
      "content-type": "video/mp4",
    },
    timeout: 120000,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  });
}

/**
 * Upload video buffer (get config → upload to OSS)
 * @param {Buffer} buffer - video buffer
 * @returns {string} video URL on CDN (tanpa query params)
 */
async function uploadVideo(buffer) {
  const config = await getUploadConfig("video.mp4");
  await uploadToOSS(buffer, config.url);
  // return URL tanpa query params (pre-signed signature)
  return config.url.split("?")[0];
}

/**
 * Create video enhance job (pakai FormData)
 * @param {string} videoUrl - URL video yang mau di-enhance
 * @param {string} resolution - "2k" atau "4k"
 * @returns {string} job ID
 */
async function createJob(videoUrl, resolution = "2k") {
  const form = new FormData();
  form.append("original_video_url", videoUrl);
  form.append("resolution", resolution);
  form.append("is_preview", "false");

  const { data } = await axios.post(`${JOB_BASE}/create-job`, form, {
    headers: {
      ...HEADERS,
      ...form.getHeaders(),
    },
    timeout: 30000,
  });

  if (!data?.result?.job_id) throw new Error(data?.message?.en || data?.message || "Create job gagal");
  return data.result.job_id;
}

/**
 * Poll job status sampai selesai
 * code 100000 = success (result.output_url ready)
 * code 300006 = still processing
 * @param {string} jobId
 * @param {number} maxRetry - max polling attempts (default 60 = ~8s * 60 = ~8 menit)
 * @returns {object} job result
 */
async function getJob(jobId, maxRetry = 60) {
  for (let i = 0; i < maxRetry; i++) {
    const { data } = await axios.get(`${JOB_BASE}/get-job/${jobId}`, {
      headers: HEADERS,
      timeout: 15000,
    });

    if (data?.code === 100000 && data?.result?.output_url) {
      return data.result;
    }
    if (data?.code !== 300006 && data?.code !== 100000 && data?.code !== 300000) {
      throw new Error(data?.message?.en || data?.message || "Job gagal");
    }
    // masih processing, tunggu 8 detik (sama kayak website)
    await new Promise((r) => setTimeout(r, 8000));
  }
  throw new Error("Timeout: video enhance terlalu lama");
}

/**
 * Video Enhancer - enhance video ke 2K/4K via unblurimage.ai
 * @param {Buffer|string} input - video buffer atau URL
 * @param {object} opts
 * @param {string} opts.resolution - "2k" atau "4k" (default: "2k")
 * @returns {{ success: boolean, url?: string, jobId?: string, data?: object, error?: string }}
 */
export async function unblurVideo(input, { resolution = "2k" } = {}) {
  try {
    let videoUrl = input;
    if (Buffer.isBuffer(input)) {
      videoUrl = await uploadVideo(input);
    }
    const jobId = await createJob(videoUrl, resolution);
    const result = await getJob(jobId);
    return {
      success: true,
      url: result.output_url || result.output_video_url || result.url,
      jobId,
      data: result,
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
