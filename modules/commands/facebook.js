const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const crypto = require("crypto");
const cheerio = require("cheerio");
const FormData = require("form-data");

module.exports.config = {
  name: "autodownfacebook",
  version: "1.5.0",
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

// Hàm tải video từ FSave.net
async function downloadWithFSave(url, outputPath) {
  try {
    console.log("Đang tải video với FSave.net");
    const userAgent = getRandomUserAgent();
    
    // Bước 1: Truy cập vào trang FSave.net
    console.log("Bước 1: Truy cập FSave.net");
    const fsaveUrl = 'https://fsave.net/';
    const initialResponse = await axios.get(fsaveUrl, {
      headers: {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'max-age=0',
        'Connection': 'keep-alive',
        'Referer': 'https://www.google.com/'
      }
    });
    
    // Bước 2: Lấy cookie và token cần thiết
    console.log("Bước 2: Lấy cookie và token");
    const cookies = initialResponse.headers['set-cookie'];
    let cookieString = '';
    if (cookies && cookies.length > 0) {
      cookieString = cookies.join('; ');
    }
    
    // Parse trang để lấy token CSRF
    const $ = cheerio.load(initialResponse.data);
    const csrfToken = $('input[name="_token"]').val();
    
    if (!csrfToken) {
      throw new Error("Không tìm thấy CSRF token từ FSave.net");
    }
    
    console.log(`CSRF Token: ${csrfToken}`);
    
    // Bước 3: Gửi yêu cầu tải video
    console.log("Bước 3: Gửi yêu cầu tải video");
    
    // Tạo form data
    const formData = new FormData();
    formData.append('_token', csrfToken);
    formData.append('url', url);
    
    const submitResponse = await axios.post(fsaveUrl, formData, {
      headers: {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cookie': cookieString,
        'Origin': 'https://fsave.net',
        'Referer': 'https://fsave.net/',
        ...formData.getHeaders()
      }
    });
    
    // Bước 4: Phân tích trang kết quả để tìm link tải
    console.log("Bước 4: Phân tích trang kết quả");
    const $result = cheerio.load(submitResponse.data);
    
    // Lấy tiêu đề video
    let videoTitle = $result('.text-center.font-weight-bold').text().trim() || "Video Facebook";
    
    // Tìm các link tải có sẵn
    let downloadLink = null;
    let quality = "SD";
    
    // Ưu tiên HD trước, sau đó đến SD
    $result('.row.mt-5 a.btn').each((i, el) => {
      const link = $result(el).attr('href');
      const qualityText = $result(el).text().trim();
      
      if (qualityText.includes('HD') && link) {
        downloadLink = link;
        quality = "HD";
        return false; // break
      } else if (qualityText.includes('SD') && link && !downloadLink) {
        downloadLink = link;
        quality = "SD";
      }
    });
    
    // Nếu không tìm thấy link trong cấu trúc trên, tìm link theo cách khác
    if (!downloadLink) {
      $result('a.btn.btn-success[href]').each((i, el) => {
        const link = $result(el).attr('href');
        if (link && link.includes('http') && (link.includes('.mp4') || link.includes('fbcdn.net') || link.includes('fbsbx.com'))) {
          downloadLink = link;
          return false; // break
        }
      });
    }
    
    if (!downloadLink) {
      // Tìm kiếm bằng regex trong HTML nếu cần
      const htmlContent = submitResponse.data;
      const linkMatch = htmlContent.match(/href="(https:\/\/[^"]+\.mp4[^"]*)"/);
      if (linkMatch && linkMatch[1]) {
        downloadLink = linkMatch[1];
      }
    }
    
    if (!downloadLink) {
      throw new Error("Không tìm thấy link tải từ FSave.net");
    }
    
    console.log(`Đã tìm thấy link tải: ${downloadLink}`);
    
    // Bước 5: Tải video
    console.log("Bước 5: Tải video");
    const videoResponse = await axios({
      method: 'get',
      url: downloadLink,
      responseType: 'arraybuffer',
      timeout: 60000,
      headers: {
        'User-Agent': userAgent,
        'Accept': '*/*',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Referer': 'https://fsave.net/'
      }
    });
    
    // Ghi file
    fs.writeFileSync(outputPath, Buffer.from(videoResponse.data));
    console.log("Tải video hoàn tất từ FSave.net");
    
    return {
      success: true,
      title: videoTitle,
      quality: quality
    };
  } catch (error) {
    console.error("Lỗi FSave.net:", error.message);
    throw error;
  }
}

// Phương pháp dự phòng sử dụng VideoDL
async function downloadWithVideoDL(url, outputPath) {
  try {
    console.log("Đang tải video với VideoDL");
    const userAgent = getRandomUserAgent();
    
    // Bước 1: Truy cập trang VideoDL
    console.log("Bước 1: Truy cập VideoDL");
    const videoDlUrl = 'https://videopls.net/';
    
    const initialResponse = await axios.get(videoDlUrl, {
      headers: {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    
    // Bước 2: Submit URL video
    console.log("Bước 2: Submit URL video");
    
    const formData = new URLSearchParams();
    formData.append('url', url);
    
    const submitResponse = await axios.post(videoDlUrl, formData, {
      headers: {
        'User-Agent': userAgent,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Origin': 'https://videopls.net',
        'Referer': 'https://videopls.net/'
      }
    });
    
    // Bước 3: Phân tích kết quả
    console.log("Bước 3: Phân tích kết quả");
    const $ = cheerio.load(submitResponse.data);
    
    // Tìm tiêu đề video
    let videoTitle = $('.results h2').text().trim() || "Video Facebook";
    
    // Tìm link tải
    let downloadLink = null;
    let quality = "SD";
    
    // Ưu tiên link HD trước, sau đó đến SD
    $('a.download-button').each((i, el) => {
      const link = $(el).attr('href');
      const qualityText = $(el).text().trim();
      
      if (qualityText.includes('HD') && link) {
        downloadLink = link;
        quality = "HD";
        return false; // break
      } else if (link && !downloadLink) {
        downloadLink = link;
      }
    });
    
    if (!downloadLink) {
      throw new Error("Không tìm thấy link tải từ VideoDL");
    }
    
    console.log(`Đã tìm thấy link tải: ${downloadLink}`);
    
    // Bước 4: Tải video
    console.log("Bước 4: Tải video");
    const videoResponse = await axios({
      method: 'get',
      url: downloadLink,
      responseType: 'arraybuffer',
      timeout: 60000,
      headers: {
        'User-Agent': userAgent,
        'Accept': '*/*',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Referer': 'https://videopls.net/'
      }
    });
    
    // Ghi file
    fs.writeFileSync(outputPath, Buffer.from(videoResponse.data));
    console.log("Tải video hoàn tất từ VideoDL");
    
    return {
      success: true,
      title: videoTitle,
      quality: quality
    };
  } catch (error) {
    console.error("Lỗi VideoDL:", error.message);
    throw error;
  }
}

// Hàm tổng hợp tải video Facebook sử dụng nhiều phương pháp dự phòng
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
  
  // Phương pháp 1: FSave.net (Phương pháp chính)
  try {
    console.log("Phương pháp 1: FSave.net");
    return await downloadWithFSave(processedUrl, outputPath);
  } catch (error) {
    console.log("Phương pháp 1 thất bại:", error.message);
    errors.push(`FSave.net: ${error.message}`);
  }
  
  // Phương pháp 2: VideoDL (Phương pháp dự phòng)
  try {
    console.log("Phương pháp 2: VideoDL");
    return await downloadWithVideoDL(processedUrl, outputPath);
  } catch (error) {
    console.log("Phương pháp 2 thất bại:", error.message);
    errors.push(`VideoDL: ${error.message}`);
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
