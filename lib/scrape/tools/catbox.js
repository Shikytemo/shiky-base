import axios from "axios";
import FormData from "form-data";

const API = "https://catbox.moe/user/api.php";

/**
 * Upload file buffer ke catbox.moe
 * @param {Buffer} buffer - File buffer
 * @param {string} filename - Nama file (contoh: "image.jpg")
 * @returns {Promise<string>} - URL file yang diupload
 */
export async function catboxUpload(buffer, filename) {
  const form = new FormData();
  form.append("reqtype", "fileupload");
  form.append("fileToUpload", buffer, { filename });

  const { data } = await axios.post(API, form, {
    headers: form.getHeaders(),
  });
  return data;
}

/**
 * Upload file dari URL ke catbox.moe
 * @param {string} url - URL file yang ingin diupload
 * @returns {Promise<string>} - URL file catbox
 */
export async function catboxUrl(url) {
  const form = new FormData();
  form.append("reqtype", "urlupload");
  form.append("url", url);

  const { data } = await axios.post(API, form, {
    headers: form.getHeaders(),
  });
  return data;
}

/**
 * Hapus file dari catbox.moe (perlu userhash)
 * @param {string} userhash - Userhash akun catbox
 * @param {string[]} files - Array nama file (contoh: ["abc123.jpg", "def456.png"])
 * @returns {Promise<string>}
 */
export async function catboxDelete(userhash, files) {
  const form = new FormData();
  form.append("reqtype", "deletefiles");
  form.append("userhash", userhash);
  form.append("files", files.join(" "));

  const { data } = await axios.post(API, form, {
    headers: form.getHeaders(),
  });
  return data;
}
