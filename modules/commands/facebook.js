const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const crypto = require("crypto");
const request = require("request");
const cheerio = require("cheerio");

module.exports.config = {
  name: "autodownfacebook",
  version: "1.2.0",
  hasPermssion: 0,
  credits: "Dương Trân dev & LunarKrystal",
  description: "Tự động tải video từ Facebook (cả video thường và reels) khi phát hiện link",
  commandCategory: "Tiện ích",
  usages: "",
  cooldowns: 5,
  dependencies: {
    "axios": "",
    "fs-extra": "",
    "request": "",
    "cheerio": ""
  }
};

// Hàm tạo ID ngẫu nhiên cho tên file
function generateRandomId() {
  return crypto.randomBytes(8).toString("hex");
}

// Hàm tải video trực tiếp từ Facebook sử dụng phương pháp scraping
async function downloadFacebookVideoWithScraping(url, outputPath) {
  return new Promise((resolve, reject) => {
    try {
      console.log("Đang tải video bằng phương pháp scraping");
      
      // Tạo một cookie ngẫu nhiên để tránh bị phát hiện là bot
      const randomCookie = `sb=${crypto.randomBytes(12).toString('hex')}; datr=${crypto.randomBytes(12).toString('hex')}; locale=en_US`;
      
      // Tạo request đến URL của video Facebook
      request({
        url: url,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Cookie': randomCookie
        }
      }, (error, response, body) => {
        if (error) {
          return reject(new Error(`Lỗi khi tải trang Facebook: ${error.message}`));
        }
        
        if (response.statusCode !== 200) {
          return reject(new Error(`Lỗi khi tải trang Facebook: ${response.statusCode}`));
        }
        
        try {
          // Tìm link video HD trong mã nguồn trang
          const $ = cheerio.load(body);
          let videoTitle = $('meta[property="og:title"]').attr('content') || "Video Facebook";
          
          // Tìm URL của video trong JSON data
          let videoURL = null;
          const scriptTags = $('script').map((i, el) => $(el).html()).get();
          
          for (const script of scriptTags) {
            // Tìm đoạn script chứa thông tin về video
            if (script.includes('"playable_url"') || script.includes('"playable_url_quality_hd"')) {
              const jsonStart = script.indexOf('{');
              const jsonEnd = script.lastIndexOf('}') + 1;
              
              if (jsonStart >= 0 && jsonEnd > jsonStart) {
                try {
                  const jsonStr = script.substring(jsonStart, jsonEnd);
                  const parsed = JSON.parse(jsonStr);
                  
                  // Tìm URL video trong các cấu trúc dữ liệu khác nhau
                  if (parsed.playable_url_quality_hd) {
                    videoURL = parsed.playable_url_quality_hd;
                  } else if (parsed.playable_url) {
                    videoURL = parsed.playable_url;
                  } else if (parsed.data && parsed.data.video) {
                    const videoData = parsed.data.video;
                    if (videoData.playable_url_quality_hd) {
                      videoURL = videoData.playable_url_quality_hd;
                    } else if (videoData.playable_url) {
                      videoURL = videoData.playable_url;
                    }
                  }
                  
                  if (videoURL) break;
                } catch (e) {
                  // Bỏ qua lỗi phân tích JSON
                  console.log("Lỗi phân tích JSON:", e.message);
                }
              }
            }
          }
          
          // Phương pháp dự phòng: Tìm URL video từ thẻ meta
          if (!videoURL) {
            videoURL = $('meta[property="og:video:url"]').attr('content') || 
                      $('meta[property="og:video"]').attr('content') || 
                      $('meta[property="og:video:secure_url"]').attr('content');
          }
          
          // Tải video
          if (videoURL) {
            console.log(`Đã tìm thấy URL video: ${videoURL}`);
            
            request({
              url: videoURL,
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                'Referer': url
              }
            })
            .on('error', function(err) {
              reject(new Error(`Lỗi khi tải video: ${err.message}`));
            })
            .pipe(fs.createWriteStream(outputPath))
            .on('close', function() {
              console.log("Tải video hoàn tất bằng phương pháp scraping");
              resolve({
                success: true,
                title: videoTitle
              });
            });
          } else {
            reject(new Error("Không tìm thấy URL video trong mã nguồn trang"));
          }
        } catch (err) {
          reject(new Error(`Lỗi khi phân tích mã nguồn: ${err.message}`));
        }
      });
    } catch (error) {
      reject(new Error(`Lỗi scraping: ${error.message}`));
    }
  });
}

// Phương pháp 1: Sử dụng SSSGrab API
async function downloadWithSSSGrab(url, outputPath) {
  try {
    console.log("Đang tải video với SSSGrab API");
    
    // Gọi API lấy link tải
    const response = await axios.get(`https://api.sssgrab.com/media?url=${encodeURIComponent(url)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Referer': 'https://sssgrab.com/'
      },
      timeout: 30000
    });
    
    if (!response.data || !response.data.url) {
      throw new Error("SSSGrab API không trả về link tải");
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
    console.log("Tải video hoàn tất qua SSSGrab API");
    
    return {
      success: true,
      title: response.data.title || "Video Facebook"
    };
  } catch (error) {
    console.error("Lỗi SSSGrab API:", error.message);
    throw error;
  }
}

// Phương pháp 2: Sử dụng SaveAs API
async function downloadWithSaveAs(url, outputPath) {
  try {
    console.log("Đang tải video với SaveAs API");
    
    // Gọi API để lấy link tải
    const response = await axios.get(`https://api.saveas.co/get_url?url=${encodeURIComponent(url)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Referer': 'https://saveas.co/'
      },
      timeout: 30000
    });
    
    if (!response.data || !response.data.url) {
      throw new Error("SaveAs API không trả về link tải");
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
    console.log("Tải video hoàn tất qua SaveAs API");
    
    return {
      success: true,
      title: response.data.title || "Video Facebook"
    };
  } catch (error) {
    console.error("Lỗi SaveAs API:", error.message);
    throw error;
  }
}

// Phương pháp 3: Sử dụng Y2Mate API
async function downloadWithY2Mate(url, outputPath) {
  try {
    console.log("Đang tải video với Y2Mate API");
    
    // Bước 1: Lấy thông tin video
    const analyzeResponse = await axios.post('https://www.y2mate.com/mates/analyzeV2/ajax', 
      new URLSearchParams({
        'k_query': url,
        'k_page': 'facebook',
        'hl': 'en',
        'q_auto': 0
      }), {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Requested-With': 'XMLHttpRequest',
          'Origin': 'https://www.y2mate.com',
          'Referer': 'https://www.y2mate.com/facebook-downloader'
        }
      });
    
    if (!analyzeResponse.data || !analyzeResponse.data.links || Object.keys(analyzeResponse.data.links).length === 0) {
      throw new Error("Y2Mate không tìm thấy link tải");
    }
    
    // Chọn link chất lượng tốt nhất
    const availableLinks = analyzeResponse.data.links;
    let selectedFormat = null;
    
    // Lấy danh sách kích thước để sắp xếp theo chất lượng
    const formatSizes = Object.keys(availableLinks).filter(size => size.includes('mp4'));
    
    if (formatSizes.length > 0) {
      // Tìm định dạng mp4 đầu tiên
      selectedFormat = formatSizes[0];
    } else {
      throw new Error("Không tìm thấy định dạng MP4");
    }
    
    const videoInfo = availableLinks[selectedFormat];
    const videoId = analyzeResponse.data.vid;
    
    // Bước 2: Gửi yêu cầu tải
    const convertResponse = await axios.post('https://www.y2mate.com/mates/convertV2/index', 
      new URLSearchParams({
        'vid': videoId,
        'k': videoInfo.k
      }), {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Requested-With': 'XMLHttpRequest',
          'Origin': 'https://www.y2mate.com',
          'Referer': 'https://www.y2mate.com/facebook-downloader'
        }
      });
    
    if (!convertResponse.data || !convertResponse.data.dlink) {
      throw new Error("Y2Mate không trả về link tải");
    }
    
    const downloadLink = convertResponse.data.dlink;
    
    // Tải video từ link
    const videoResponse = await axios({
      method: 'get',
      url: downloadLink,
      responseType: 'arraybuffer',
      timeout: 60000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Referer': 'https://www.y2mate.com/'
      }
    });
    
    fs.writeFileSync(outputPath, Buffer.from(videoResponse.data));
    console.log("Tải video hoàn tất qua Y2Mate API");
    
    return {
      success: true,
      title: analyzeResponse.data.title || "Video Facebook"
    };
  } catch (error) {
    console.error("Lỗi Y2Mate API:", error.message);
    throw error;
  }
}

// Hàm tổng hợp tải video Facebook sử dụng nhiều phương pháp dự phòng
async function downloadFacebookVideo(videoUrl, outputPath) {
  let errors = [];
  
  // Phương pháp 1: Trực tiếp scraping từ Facebook
  try {
    console.log("Phương pháp 1: Trực tiếp từ Facebook");
    return await downloadFacebookVideoWithScraping(videoUrl, outputPath);
  } catch (error) {
    console.log("Phương pháp 1 thất bại:", error.message);
    errors.push(`Scraping: ${error.message}`);
  }
  
  // Phương pháp 2: SSSGrab API
  try {
    console.log("Phương pháp 2: SSSGrab API");
    return await downloadWithSSSGrab(videoUrl, outputPath);
  } catch (error) {
    console.log("Phương pháp 2 thất bại:", error.message);
    errors.push(`SSSGrab: ${error.message}`);
  }
  
  // Phương pháp 3: SaveAs API
  try {
    console.log("Phương pháp 3: SaveAs API");
    return await downloadWithSaveAs(videoUrl, outputPath);
  } catch (error) {
    console.log("Phương pháp 3 thất bại:", error.message);
    errors.push(`SaveAs: ${error.message}`);
  }
  
  // Phương pháp 4: Y2Mate API
  try {
    console.log("Phương pháp 4: Y2Mate API");
    return await downloadWithY2Mate(videoUrl, outputPath);
  } catch (error) {
    console.log("Phương pháp 4 thất bại:", error.message);
    errors.push(`Y2Mate: ${error.message}`);
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
