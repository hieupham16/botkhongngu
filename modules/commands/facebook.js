const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const crypto = require("crypto");

module.exports.config = {
  name: "autodownfacebook",
  version: "1.1.0",
  hasPermssion: 0,
  credits: "Dương Trân dev",
  description: "Tự động tải video từ Facebook (cả video thường và reels) khi phát hiện link",
  commandCategory: "Tiện ích",
  usages: "",
  cooldowns: 5,
  dependencies: {
    "axios": "",
    "fs-extra": ""
  }
};

// Hàm tạo ID ngẫu nhiên cho tên file
function generateRandomId() {
  return crypto.randomBytes(8).toString("hex");
}

// Phương pháp 1: Sử dụng API Facebook Downloader
async function downloadWithFBDown(url, outputPath) {
  try {
    console.log("Đang tải video với FB Downloader API");
    
    // Gọi API lấy link tải
    const response = await axios.get(`https://facebook-video-downloader-download-facebook-videos.p.rapidapi.com/app/main.php?url=${encodeURIComponent(url)}`, {
      headers: {
        'X-RapidAPI-Key': '2a54a31822msh37f2b82797f1c6dp1c1960jsn54bb50dd41e4',
        'X-RapidAPI-Host': 'facebook-video-downloader-download-facebook-videos.p.rapidapi.com'
      }
    });
    
    if (!response.data || !response.data.links || response.data.links.length === 0) {
      throw new Error("Không tìm thấy link tải từ API");
    }
    
    // Lấy link tải chất lượng cao nhất
    const downloadLink = response.data.links[0].url;
    
    // Tải video từ link
    const videoResponse = await axios({
      method: 'get',
      url: downloadLink,
      responseType: 'arraybuffer',
      timeout: 60000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
      }
    });
    
    fs.writeFileSync(outputPath, Buffer.from(videoResponse.data));
    console.log("Tải video hoàn tất qua FB Downloader API");
    
    return {
      success: true,
      title: response.data.title || "Video Facebook"
    };
  } catch (error) {
    console.error("Lỗi FB Downloader API:", error.message);
    throw error;
  }
}

// Phương pháp 2: Sử dụng API thay thế
async function downloadWithAlternativeAPI(url, outputPath) {
  try {
    console.log("Đang tải video với API thay thế");
    
    // Gọi API lấy link tải
    const response = await axios.get(`https://facebook-reel-and-video-downloader.p.rapidapi.com/app/main.php?url=${encodeURIComponent(url)}`, {
      headers: {
        'X-RapidAPI-Key': '2a54a31822msh37f2b82797f1c6dp1c1960jsn54bb50dd41e4',
        'X-RapidAPI-Host': 'facebook-reel-and-video-downloader.p.rapidapi.com'
      }
    });
    
    if (!response.data || !response.data.links || response.data.links.length === 0) {
      throw new Error("Không tìm thấy link tải từ API thay thế");
    }
    
    // Lấy link tải chất lượng cao nhất
    const downloadLink = response.data.links[0].url;
    
    // Tải video từ link
    const videoResponse = await axios({
      method: 'get',
      url: downloadLink,
      responseType: 'arraybuffer',
      timeout: 60000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
      }
    });
    
    fs.writeFileSync(outputPath, Buffer.from(videoResponse.data));
    console.log("Tải video hoàn tất qua API thay thế");
    
    return {
      success: true,
      title: response.data.title || "Video Facebook"
    };
  } catch (error) {
    console.error("Lỗi API thay thế:", error.message);
    throw error;
  }
}

// Phương pháp 3: Sử dụng API FDOWN
async function downloadWithFDOWN(url, outputPath) {
  try {
    console.log("Đang tải video với FDOWN API");
    
    // Gọi API lấy link tải
    const response = await axios.get(`https://fdown.net/download.php?url=${encodeURIComponent(url)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
      }
    });
    
    // Tìm link tải từ phản hồi HTML
    const htmlContent = response.data;
    const downloadLinkMatch = htmlContent.match(/href="(https:\/\/[^"]+\/download\/[^"]+)"/);
    
    if (!downloadLinkMatch || !downloadLinkMatch[1]) {
      throw new Error("Không tìm thấy link tải từ FDOWN");
    }
    
    const downloadLink = downloadLinkMatch[1];
    
    // Tải video từ link
    const videoResponse = await axios({
      method: 'get',
      url: downloadLink,
      responseType: 'arraybuffer',
      timeout: 60000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
      }
    });
    
    fs.writeFileSync(outputPath, Buffer.from(videoResponse.data));
    console.log("Tải video hoàn tất qua FDOWN API");
    
    return {
      success: true,
      title: "Video Facebook"
    };
  } catch (error) {
    console.error("Lỗi FDOWN API:", error.message);
    throw error;
  }
}

// Hàm tổng hợp tải video Facebook sử dụng nhiều phương pháp dự phòng
async function downloadFacebookVideo(videoUrl, outputPath) {
  let lastError = null;
  
  // Phương pháp 1: Sử dụng FB Downloader API
  try {
    return await downloadWithFBDown(videoUrl, outputPath);
  } catch (error) {
    console.log("Phương pháp 1 thất bại, đang thử phương pháp 2...");
    lastError = error;
  }
  
  // Phương pháp 2: Sử dụng API thay thế
  try {
    return await downloadWithAlternativeAPI(videoUrl, outputPath);
  } catch (error) {
    console.log("Phương pháp 2 thất bại, đang thử phương pháp 3...");
    lastError = error;
  }
  
  // Phương pháp 3: Sử dụng FDOWN API
  try {
    return await downloadWithFDOWN(videoUrl, outputPath);
  } catch (error) {
    console.log("Phương pháp 3 thất bại");
    lastError = error;
  }
  
  // Nếu tất cả các phương pháp đều thất bại, ném lỗi cuối cùng
  throw lastError || new Error("Không thể tải video Facebook");
}

module.exports.handleEvent = async function({ api, event }) {
  const { threadID, messageID, body } = event;
  
  // Regex để phát hiện tất cả các loại link Facebook (video thông thường, reels, share, watch)
  const fbRegex = /(?:https?:\/\/)?(?:www\.|m\.)?(?:facebook\.com|fb\.watch|fb\.com)\/(?:watch\/?\?v=|reel\/|share\/v\/|watch\/|story\.php\?story_fbid=|[^\/]+\/videos\/|video\.php\?v=|[^\/]+\/reels\/|reels\/)([^\s&\/\?]+)/i;
  
  if (fbRegex.test(body)) {
    const fbLink = body.match(fbRegex)[0];
    
    try {
      api.sendMessage(`⏳ Đang tải video Facebook, vui lòng đợi (có thể mất đến 1-2 phút)...`, threadID, messageID);
      
      // Tạo đường dẫn lưu video với ID ngẫu nhiên để tránh xung đột
      const randomId = generateRandomId();
      const filePath = path.join(__dirname, "..", "..", "..", "cache", `fb-${randomId}.mp4`);
      
      // Tải video
      const result = await downloadFacebookVideo(fbLink, filePath);
      
      // Kiểm tra kích thước file trước khi gửi
      const fileStats = fs.statSync(filePath);
      const fileSizeMB = fileStats.size / (1024 * 1024);
      
      if (fileSizeMB > 25) {
        fs.unlinkSync(filePath);
        return api.sendMessage(`❎ Video có kích thước quá lớn (${fileSizeMB.toFixed(2)}MB) để gửi. Giới hạn là 25MB.`, threadID, messageID);
      }
      
      // Gửi video
      api.sendMessage({
        body: `🎬 Video từ Facebook ${result.title ? `\nTiêu đề: ${result.title}` : ""}`,
        attachment: fs.createReadStream(filePath)
      }, threadID, () => fs.unlinkSync(filePath), messageID);
      
    } catch (err) {
      console.error("Lỗi tải video:", err);
      return api.sendMessage(`❎ Đã xảy ra lỗi khi tải video Facebook: ${err.message}. Vui lòng thử lại sau hoặc thử video khác.`, threadID, messageID);
    }
  }
};

module.exports.run = function({ api, event }) {
  // Không cần xử lý vì đây là lệnh noprefix
}; 
