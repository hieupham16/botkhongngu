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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': 'https://fdown.net/'
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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Referer': 'https://fdown.net/'
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

// Phương pháp 4: Sử dụng API SaveFrom
async function downloadWithSaveFrom(url, outputPath) {
  try {
    console.log("Đang tải video với SaveFrom API");
    
    // API mới từ SaveFrom
    const apiUrl = `https://worker-syntax-dawn-95c9.lulardev.workers.dev/sf?url=${encodeURIComponent(url)}`;
    
    const response = await axios.get(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
      },
      timeout: 30000
    });
    
    if (!response.data || !response.data.url) {
      throw new Error("SaveFrom API không trả về link tải");
    }
    
    const downloadLink = response.data.url;
    
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
    console.log("Tải video hoàn tất qua SaveFrom API");
    
    return {
      success: true,
      title: response.data.meta && response.data.meta.title ? response.data.meta.title : "Video Facebook"
    };
  } catch (error) {
    console.error("Lỗi SaveFrom API:", error.message);
    throw error;
  }
}

// Phương pháp 5: Sử dụng API DownTik
async function downloadWithDownTik(url, outputPath) {
  try {
    console.log("Đang tải video với DownTik API");
    
    // Chuẩn bị request đến API DownTik
    const response = await axios.post('https://downtik.net/API/reels', 
      `URL=${encodeURIComponent(url)}`,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
          'Origin': 'https://downtik.net',
          'Referer': 'https://downtik.net/'
        }
      }
    );
    
    if (!response.data || !response.data.videoLinks || response.data.videoLinks.length === 0) {
      throw new Error("DownTik API không trả về link tải");
    }
    
    // Chọn link tải chất lượng cao nhất
    const downloadLink = response.data.videoLinks[0].url;
    
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
    console.log("Tải video hoàn tất qua DownTik API");
    
    return {
      success: true,
      title: response.data.title || "Video Facebook"
    };
  } catch (error) {
    console.error("Lỗi DownTik API:", error.message);
    throw error;
  }
}

// Hàm tổng hợp tải video Facebook sử dụng nhiều phương pháp dự phòng
async function downloadFacebookVideo(videoUrl, outputPath) {
  let errors = [];
  
  // Phương pháp 1: Sử dụng SaveFrom (phương pháp mới, không yêu cầu API key)
  try {
    console.log("Phương pháp 1: SaveFrom API");
    return await downloadWithSaveFrom(videoUrl, outputPath);
  } catch (error) {
    console.log("Phương pháp 1 thất bại:", error.message);
    errors.push(`SaveFrom: ${error.message}`);
  }
  
  // Phương pháp 2: Sử dụng FDOWN
  try {
    console.log("Phương pháp 2: FDOWN API");
    return await downloadWithFDOWN(videoUrl, outputPath);
  } catch (error) {
    console.log("Phương pháp 2 thất bại:", error.message);
    errors.push(`FDOWN: ${error.message}`);
  }
  
  // Phương pháp 3: Sử dụng DownTik
  try {
    console.log("Phương pháp 3: DownTik API");
    return await downloadWithDownTik(videoUrl, outputPath);
  } catch (error) {
    console.log("Phương pháp 3 thất bại:", error.message);
    errors.push(`DownTik: ${error.message}`);
  }
  
  // Phương pháp 4: Sử dụng FB Downloader API (RapidAPI)
  try {
    console.log("Phương pháp 4: FB Downloader API");
    return await downloadWithFBDown(videoUrl, outputPath);
  } catch (error) {
    console.log("Phương pháp 4 thất bại:", error.message);
    errors.push(`FB Downloader: ${error.message}`);
  }
  
  // Phương pháp 5: Sử dụng API thay thế (RapidAPI)
  try {
    console.log("Phương pháp 5: API thay thế");
    return await downloadWithAlternativeAPI(videoUrl, outputPath);
  } catch (error) {
    console.log("Phương pháp 5 thất bại:", error.message);
    errors.push(`API thay thế: ${error.message}`);
  }
  
  // Nếu tất cả các phương pháp đều thất bại, ném lỗi tổng hợp
  throw new Error(`Không thể tải video Facebook sau khi thử tất cả các phương pháp. Chi tiết lỗi: ${errors.join(', ')}`);
}

module.exports.handleEvent = async function({ api, event }) {
  const { threadID, messageID, body } = event;
  
  // Regex được cải tiến để bắt tất cả các loại link Facebook (video thường và reels)
  // Thêm group capture để dễ dàng debug
  const fbRegex = /(?:https?:\/\/)?(?:www\.|web\.|m\.)?(?:facebook\.com|fb\.watch|fb\.com)\/(?:(?:watch\/?\?v=|reel\/|share\/v\/|watch\/|story\.php\?story_fbid=|[^\/]+\/videos\/|video\.php\?v=|[^\/]+\/reels\/|reels\/|watch\?v=)([^\s&\/\?]+))/i;
  
  console.log(`Kiểm tra tin nhắn: ${body}`);
  
  if (fbRegex.test(body)) {
    console.log("Phát hiện link Facebook");
    const matches = body.match(fbRegex);
    const fbLink = matches[0];
    const videoId = matches[1];
    
    console.log(`Link đã phát hiện: ${fbLink}`);
    console.log(`Video ID: ${videoId}`);
    
    try {
      api.sendMessage(`⏳ Đang tải video Facebook, vui lòng đợi (có thể mất đến 1-2 phút)...`, threadID, messageID);
      
      // Tạo đường dẫn lưu video với ID ngẫu nhiên để tránh xung đột
      const randomId = generateRandomId();
      const filePath = path.join(__dirname, "..", "..", "..", "cache", `fb-${randomId}.mp4`);
      
      console.log(`Bắt đầu tải video từ link: ${fbLink}`);
      console.log(`File sẽ được lưu tại: ${filePath}`);
      
      // Tải video
      const result = await downloadFacebookVideo(fbLink, filePath);
      
      console.log("Tải video thành công");
      
      // Kiểm tra kích thước file trước khi gửi
      const fileStats = fs.statSync(filePath);
      const fileSizeMB = fileStats.size / (1024 * 1024);
      
      console.log(`Kích thước file: ${fileSizeMB.toFixed(2)}MB`);
      
      if (fileSizeMB > 25) {
        fs.unlinkSync(filePath);
        return api.sendMessage(`❎ Video có kích thước quá lớn (${fileSizeMB.toFixed(2)}MB) để gửi. Giới hạn là 25MB.`, threadID, messageID);
      }
      
      // Gửi video
      console.log("Đang gửi video vào nhóm...");
      api.sendMessage({
        body: `🎬 Video từ Facebook ${result.title ? `\nTiêu đề: ${result.title}` : ""}`,
        attachment: fs.createReadStream(filePath)
      }, threadID, () => {
        console.log("Đã gửi video thành công và xóa file tạm");
        fs.unlinkSync(filePath);
      }, messageID);
      
    } catch (err) {
      console.error("Lỗi tải video:", err);
      return api.sendMessage(`❎ Đã xảy ra lỗi khi tải video Facebook: ${err.message}. Vui lòng thử lại sau hoặc thử video khác.`, threadID, messageID);
    }
  } else {
    // Debug: Kiểm tra tại sao regex không khớp
    if (body.includes("facebook.com/reel/") || body.includes("fb.watch")) {
      console.log("Phát hiện link facebook nhưng regex không khớp");
      console.log(`Link gốc: ${body}`);
      console.log(`Kết quả test regex: ${fbRegex.test(body)}`);
    }
  }
};

module.exports.run = function({ api, event }) {
  // Không cần xử lý vì đây là lệnh noprefix
}; 
