const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const crypto = require("crypto");
const cheerio = require("cheerio");
const FormData = require("form-data");

module.exports.config = {
  name: "autodownfacebook",
  version: "2.0.0",
  hasPermssion: 0,
  credits: "Dương Trân dev & LunarKrystal",
  description: "Tự động tải video từ Facebook (cả video thường và reels) khi phát hiện link",
  commandCategory: "Tiện ích",
  usages: "",
  cooldowns: 5,
  dependencies: {
    "axios": "",
    "fs-extra": "",
    "cheerio": "",
    "form-data": ""
  }
};

// Hàm tạo ID ngẫu nhiên cho tên file
function generateRandomId() {
  return crypto.randomBytes(8).toString("hex");
}

// Hàm lấy User-Agent ngẫu nhiên
function getRandomUserAgent() {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.1 Safari/605.1.15',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/117.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0'
  ];
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

// API mới: Thư viện Snaptik.app
async function downloadWithSnaptik(url, outputPath) {
  try {
    console.log("Đang tải video với Snaptik");
    const userAgent = getRandomUserAgent();
    
    // Gửi request để lấy token
    const response = await axios.get("https://snaptik.app/", {
      headers: {
        "User-Agent": userAgent
      }
    });
    
    // Parse HTML để lấy token
    const $ = cheerio.load(response.data);
    const token = $('input[name="token"]').val();
    
    if (!token) {
      throw new Error("Không lấy được token từ Snaptik");
    }
    
    // Gửi request để phân tích link Facebook
    const formData = new FormData();
    formData.append("url", url);
    formData.append("token", token);
    
    const result = await axios.post("https://snaptik.app/abc2.php", formData, {
      headers: {
        ...formData.getHeaders(),
        "User-Agent": userAgent,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"
      }
    });
    
    // Parse kết quả để tìm link download
    const $2 = cheerio.load(result.data);
    let downloadUrl = "";
    
    // Tìm link HD đầu tiên
    $2('a.download-link').each((index, element) => {
      const link = $2(element).attr('href');
      if (link && link.includes('http') && !downloadUrl) {
        downloadUrl = link;
        return false; // Dừng vòng lặp khi tìm thấy link đầu tiên
      }
    });
    
    if (!downloadUrl) {
      throw new Error("Không tìm thấy link download từ Snaptik");
    }
    
    // Tải video
    const videoResponse = await axios({
      method: 'get',
      url: downloadUrl,
      responseType: 'arraybuffer',
      timeout: 60000,
      headers: {
        'User-Agent': userAgent
      }
    });
    
    // Ghi file
    fs.writeFileSync(outputPath, Buffer.from(videoResponse.data));
    console.log("Tải video thành công từ Snaptik");
    
    return {
      success: true,
      title: "Facebook Video",
      quality: "HD"
    };
  } catch (error) {
    console.error("Lỗi Snaptik:", error.message);
    throw error;
  }
}

// API SaveFrom.net (không yêu cầu token phức tạp)
async function downloadWithSaveFrom(url, outputPath) {
  try {
    console.log("Đang tải video với SaveFrom.net");
    const userAgent = getRandomUserAgent();
    
    // Gửi request đến API
    const apiUrl = `https://api.savetube.me/video_info?url=${encodeURIComponent(url)}`;
    const response = await axios.get(apiUrl, {
      headers: {
        "User-Agent": userAgent,
        "Accept": "application/json"
      }
    });
    
    if (!response.data || !response.data.links) {
      throw new Error("Không lấy được thông tin download từ SaveFrom");
    }
    
    // Tìm link HD đầu tiên hoặc link có sẵn
    let downloadUrl = null;
    let quality = "SD";
    const links = response.data.links;
    
    if (links.hd && links.hd.url) {
      downloadUrl = links.hd.url;
      quality = "HD";
    } else if (links.sd && links.sd.url) {
      downloadUrl = links.sd.url;
    } else if (Array.isArray(links) && links.length > 0) {
      // Một số API trả về mảng links thay vì object
      downloadUrl = links[0].url;
      quality = links[0].quality || "SD";
    }
    
    if (!downloadUrl) {
      throw new Error("Không tìm thấy link download từ SaveFrom");
    }
    
    // Tải video
    const videoResponse = await axios({
      method: 'get',
      url: downloadUrl,
      responseType: 'arraybuffer',
      timeout: 60000,
      headers: {
        'User-Agent': userAgent
      }
    });
    
    // Ghi file
    fs.writeFileSync(outputPath, Buffer.from(videoResponse.data));
    console.log("Tải video thành công từ SaveFrom.net");
    
    return {
      success: true,
      title: response.data.title || "Facebook Video",
      quality: quality
    };
  } catch (error) {
    console.error("Lỗi SaveFrom:", error.message);
    throw error;
  }
}

// API DownSub.com (API đơn giản)
async function downloadWithDownSub(url, outputPath) {
  try {
    console.log("Đang tải video với DownSub.com");
    const userAgent = getRandomUserAgent();
    
    // Gửi request đến API
    const formData = new FormData();
    formData.append("url", url);
    formData.append("format", "json");
    
    const response = await axios.post("https://downsub.com/api/extract", formData, {
      headers: {
        ...formData.getHeaders(),
        "User-Agent": userAgent
      }
    });
    
    if (!response.data || !response.data.data || !response.data.data.length) {
      throw new Error("Không lấy được thông tin download từ DownSub");
    }
    
    // Tìm link video chất lượng cao nhất
    let downloadUrl = null;
    let quality = "SD";
    
    const data = response.data.data;
    for (const item of data) {
      if (item.type === "mp4" || item.extension === "mp4" || item.format === "mp4") {
        if (!downloadUrl || (item.quality && (item.quality.includes("720") || item.quality.includes("1080")))) {
          downloadUrl = item.url;
          quality = item.quality || "HD";
        }
      }
    }
    
    if (!downloadUrl && data.length > 0) {
      // Lấy link đầu tiên nếu không tìm thấy link mp4
      downloadUrl = data[0].url;
    }
    
    if (!downloadUrl) {
      throw new Error("Không tìm thấy link download từ DownSub");
    }
    
    // Tải video
    const videoResponse = await axios({
      method: 'get',
      url: downloadUrl,
      responseType: 'arraybuffer',
      timeout: 60000,
      headers: {
        'User-Agent': userAgent
      }
    });
    
    // Ghi file
    fs.writeFileSync(outputPath, Buffer.from(videoResponse.data));
    console.log("Tải video thành công từ DownSub.com");
    
    return {
      success: true,
      title: response.data.title || "Facebook Video",
      quality: quality
    };
  } catch (error) {
    console.error("Lỗi DownSub:", error.message);
    throw error;
  }
}

// API FBDownloader.net
async function downloadWithFBDownloader(url, outputPath) {
  try {
    console.log("Đang tải video với FBDownloader.net");
    const userAgent = getRandomUserAgent();
    
    // Chuẩn bị URL API
    const apiUrl = `https://fbdownloader.net/api/ajaxSearch`;
    const formData = new FormData();
    formData.append("q", url);
    
    // Gửi request đến API
    const response = await axios.post(apiUrl, formData, {
      headers: {
        ...formData.getHeaders(),
        "User-Agent": userAgent,
        "Origin": "https://fbdownloader.net",
        "Referer": "https://fbdownloader.net/"
      }
    });
    
    if (!response.data || !response.data.links) {
      throw new Error("Không lấy được thông tin download từ FBDownloader");
    }
    
    // Tìm link HD hoặc SD
    let downloadUrl = null;
    let quality = "SD";
    const links = response.data.links;
    
    if (links.hd && links.hd.url) {
      downloadUrl = links.hd.url;
      quality = "HD";
    } else if (links.sd && links.sd.url) {
      downloadUrl = links.sd.url;
    }
    
    if (!downloadUrl) {
      throw new Error("Không tìm thấy link download từ FBDownloader");
    }
    
    // Tải video
    const videoResponse = await axios({
      method: 'get',
      url: downloadUrl,
      responseType: 'arraybuffer',
      timeout: 60000,
      headers: {
        'User-Agent': userAgent,
        'Referer': 'https://fbdownloader.net/'
      }
    });
    
    // Ghi file
    fs.writeFileSync(outputPath, Buffer.from(videoResponse.data));
    console.log("Tải video thành công từ FBDownloader.net");
    
    return {
      success: true,
      title: response.data.title || "Facebook Video",
      quality: quality
    };
  } catch (error) {
    console.error("Lỗi FBDownloader:", error.message);
    throw error;
  }
}

// Hàm tổng hợp tải video Facebook
async function downloadFacebookVideo(videoUrl, outputPath) {
  let errors = [];
  
  // Làm sạch URL và thêm 'https://' nếu cần
  let processedUrl = videoUrl.trim();
  if (!processedUrl.startsWith('http')) {
    processedUrl = 'https://' + processedUrl;
  }
  
  // Đảm bảo URL hợp lệ
  try {
    new URL(processedUrl);
  } catch (e) {
    throw new Error(`URL không hợp lệ: ${e.message}`);
  }
  
  console.log(`URL được xử lý: ${processedUrl}`);
  
  // Phương pháp 1: Snaptik
  try {
    console.log("Phương pháp 1: Snaptik");
    return await downloadWithSnaptik(processedUrl, outputPath);
  } catch (error) {
    console.log("Phương pháp 1 thất bại:", error.message);
    errors.push(`Snaptik: ${error.message}`);
  }
  
  // Phương pháp 2: SaveFrom
  try {
    console.log("Phương pháp 2: SaveFrom");
    return await downloadWithSaveFrom(processedUrl, outputPath);
  } catch (error) {
    console.log("Phương pháp 2 thất bại:", error.message);
    errors.push(`SaveFrom: ${error.message}`);
  }
  
  // Phương pháp 3: DownSub
  try {
    console.log("Phương pháp 3: DownSub");
    return await downloadWithDownSub(processedUrl, outputPath);
  } catch (error) {
    console.log("Phương pháp 3 thất bại:", error.message);
    errors.push(`DownSub: ${error.message}`);
  }
  
  // Phương pháp 4: FBDownloader
  try {
    console.log("Phương pháp 4: FBDownloader");
    return await downloadWithFBDownloader(processedUrl, outputPath);
  } catch (error) {
    console.log("Phương pháp 4 thất bại:", error.message);
    errors.push(`FBDownloader: ${error.message}`);
  }
  
  // Nếu tất cả các phương pháp đều thất bại, ném lỗi tổng hợp
  throw new Error(`Không thể tải video Facebook sau khi thử tất cả các phương pháp. Chi tiết lỗi: ${errors.join(', ')}`);
}

module.exports.handleEvent = async function({ api, event }) {
  const { threadID, messageID, body } = event;
  
  // Regex được cải tiến để bắt tất cả các loại link Facebook (video thường và reels)
  const fbRegex = /(?:https?:\/\/)?(?:www\.|web\.|m\.)?(?:facebook\.com|fb\.watch|fb\.com)\/(?:(?:watch\/?\?v=|reel\/|share\/v\/|watch\/|story\.php\?story_fbid=|[^\/]+\/videos\/|video\.php\?v=|[^\/]+\/reels\/|reels\/|watch\?v=|posts\/|sharer\/sharer\.php\?u=)([^\s&\/\?]+))/i;
  
  // Debug: In ra toàn bộ tin nhắn để kiểm tra
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
      
      // Đặt timeout dài hơn cho toàn bộ quá trình tải
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Quá thời gian tải video (3 phút)")), 3 * 60 * 1000);
      });
      
      // Tải video với timeout
      const downloadPromise = downloadFacebookVideo(fbLink, filePath);
      
      // Race giữa timeout và download
      const result = await Promise.race([downloadPromise, timeoutPromise]);
      
      console.log("Tải video thành công");
      
      // Kiểm tra kích thước file trước khi gửi
      const fileStats = fs.statSync(filePath);
      const fileSizeMB = fileStats.size / (1024 * 1024);
      
      console.log(`Kích thước file: ${fileSizeMB.toFixed(2)}MB`);
      
      if (fileSizeMB > 25) {
        fs.unlinkSync(filePath);
        return api.sendMessage(`❎ Video có kích thước quá lớn (${fileSizeMB.toFixed(2)}MB) để gửi. Giới hạn là 25MB.`, threadID, messageID);
      }
      
      if (fileSizeMB < 0.1) {
        fs.unlinkSync(filePath);
        return api.sendMessage(`❎ File tải về quá nhỏ (${fileSizeMB.toFixed(2)}MB), có thể đã xảy ra lỗi. Vui lòng thử lại sau.`, threadID, messageID);
      }
      
      // Thêm thông tin về chất lượng nếu có
      const qualityInfo = result.quality ? `\n📹 Chất lượng: ${result.quality}` : '';
      
      // Gửi video
      console.log("Đang gửi video vào nhóm...");
      api.sendMessage({
        body: `🎬 Video từ Facebook${result.title ? `\n📝 Tiêu đề: ${result.title}` : ""}${qualityInfo}`,
        attachment: fs.createReadStream(filePath)
      }, threadID, () => {
        console.log("Đã gửi video thành công và xóa file tạm");
        fs.unlinkSync(filePath);
      }, messageID);
      
    } catch (err) {
      console.error("Lỗi tải video:", err);
      
      // Xử lý các loại lỗi cụ thể
      let errorMessage = `❎ Đã xảy ra lỗi khi tải video Facebook: `;
      
      if (err.message.includes("timeout") || err.message.includes("Quá thời gian")) {
        errorMessage += "Quá thời gian tải video. Vui lòng thử lại sau.";
      } 
      else if (err.message.includes("403")) {
        errorMessage += "Máy chủ từ chối truy cập (lỗi 403). Có thể video này được bảo vệ.";
      }
      else if (err.message.includes("404")) {
        errorMessage += "Không tìm thấy video (lỗi 404). Video có thể đã bị xóa hoặc được đặt ở chế độ riêng tư.";
      }
      else if (err.message.includes("không hợp lệ")) {
        errorMessage += "Link video không hợp lệ hoặc không được hỗ trợ.";
      }
      else if (err.message.includes("CSRF") || err.message.includes("token")) {
        errorMessage += "Lỗi xác thực với máy chủ tải video. Vui lòng thử lại sau.";
      }
      else if (err.message.includes("không nhận được") || err.message.includes("không tìm thấy link")) {
        errorMessage += "Không thể trích xuất link video. Video này có thể được bảo vệ hoặc chỉ có thể xem trực tiếp trên Facebook.";
      }
      else {
        // Giới hạn thông báo lỗi để tránh quá dài
        const shortError = err.message.length > 100 ? err.message.substring(0, 100) + "..." : err.message;
        errorMessage += `${shortError}. Vui lòng thử lại sau hoặc thử video khác.`;
      }
      
      return api.sendMessage(errorMessage, threadID, messageID);
    }
  }
};

module.exports.run = function({ api, event }) {
  // Không cần xử lý vì đây là lệnh noprefix
}; 
