// Video Enhancer - unblurimage.ai (AI upscale to 2K/4K)
import axios from "axios";

const BASE = "https://api.unwatermark.ai/api/web/unblurimage/v1/video-enhancer";
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
 * Upload video buffer to tmpimgs storage
 * @param {Buffer} buffer - video buffer
 * @returns {string} uploaded video URL
 */
async function uploadVideo(buffer) {
  const { data } = await axios.post(
    "https://api.unwatermark.ai/api/web/unblurimage/v1/common/upload",
    buffer,
    {
      headers: {
        ...HEADERS,
        "content-type": "video/mp4",
      },
      timeout: 120000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    }
  );
  if (!data?.data?.url) throw new Error("Upload gagal");
  return data.data.url;
}

/**
 * Create video enhance job
 * @param {string} videoUrl - URL video yang mau di-enhance
 * @param {string} resolution - "2k" atau "4k"
 * @returns {string} job ID
 */
async function createJob(videoUrl, resolution = "2k") {
  const boundary = "----WebKitFormBoundary" + Math.random().toString(36).slice(2);
  const body = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="original_video_url"',
    "",
    videoUrl,
    `--${boundary}`,
    'Content-Disposition: form-data; name="resolution"',
    "",
    resolution,
    `--${boundary}`,
    'Content-Disposition: form-data; name="is_preview"',
    "",
    "false",
    `--${boundary}--`,
  ].join("\r\n");

  const { data } = await axios.post(`${BASE}/create-job`, body, {
    headers: {
      ...HEADERS,
      "content-type": `multipart/form-data; boundary=${boundary}`,
    },
    timeout: 30000,
  });

  if (!data?.data?.job_id) throw new Error(data?.message || "Create job gagal");
  return data.data.job_id;
}

/**
 * Poll job status sampai selesai
 * @param {string} jobId
 * @param {number} maxRetry - max polling attempts (default 120 = ~2 menit)
 * @returns {object} job result
 */
async function getJob(jobId, maxRetry = 120) {
  for (let i = 0; i < maxRetry; i++) {
    const { data } = await axios.get(`${BASE}/get-job/${jobId}`, {
      headers: {
        ...HEADERS,
        "content-type": "application/json; charset=UTF-8",
      },
      timeout: 15000,
    });

    const job = data?.data;
    if (job?.status === "completed" || job?.status === "success") {
      return job;
    }
    if (job?.status === "failed" || job?.status === "error") {
      throw new Error(job?.message || "Job gagal");
    }
    // masih processing, tunggu 1 detik
    await new Promise((r) => setTimeout(r, 1000));
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
      url: result.output_video_url || result.result_url || result.url,
      jobId,
      data: result,
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
