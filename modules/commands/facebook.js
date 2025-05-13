const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const crypto = require("crypto");
const request = require("request");
const cheerio = require("cheerio");

module.exports.config = {
  name: "autodownfacebook",
  version: "1.4.0",
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

// Phương pháp 0: Sử dụng API đơn giản
async function downloadWithSimpleAPI(url, outputPath) {
  try {
    console.log("Đang tải video với Simple API");
    
    // Làm sạch URL
    let cleanUrl = url.trim();
    if (!cleanUrl.startsWith('http')) {
      cleanUrl = 'https://' + cleanUrl;
    }
    
    // Mã hóa URL để sử dụng trong API
    const encodedUrl = encodeURIComponent(cleanUrl);
    
    // Danh sách các API đơn giản để thử
    const apiEndpoints = [
      `https://api.qweb.lol/download?url=${encodedUrl}`,
      `https://api.onlinevideoconverter.pro/api/convert?url=${encodedUrl}`,
      `https://api-download.tubeflix.co/facebook?url=${encodedUrl}`
    ];
    
    let lastError = null;
    let downloadLink = null;
    let videoTitle = "Video Facebook";
    
    // Thử từng API cho đến khi tìm thấy một API hoạt động
    for (const apiUrl of apiEndpoints) {
      try {
        console.log(`Đang thử với API: ${apiUrl}`);
        
        const response = await axios.get(apiUrl, {
          headers: {
            'User-Agent': getRandomUserAgent(),
            'Accept': 'application/json'
          },
          timeout: 15000 // 15 giây timeout
        });
        
        if (response.data) {
          // Cấu trúc phản hồi có thể khác nhau giữa các API
          if (response.data.url || response.data.download || response.data.links || response.data.data) {
            // API thứ nhất
            if (response.data.url) {
              downloadLink = response.data.url;
              videoTitle = response.data.title || videoTitle;
            } 
            // API thứ hai
            else if (response.data.download) {
              downloadLink = response.data.download;
              videoTitle = response.data.title || videoTitle;
            }
            // API thứ ba
            else if (response.data.links && response.data.links.length > 0) {
              // Tìm link chất lượng cao nhất
              const hdLinks = response.data.links.filter(link => 
                link.quality && (link.quality.includes('hd') || link.quality.includes('HD'))
              );
              
              if (hdLinks.length > 0) {
                downloadLink = hdLinks[0].url;
              } else if (response.data.links.length > 0) {
                downloadLink = response.data.links[0].url;
              }
              
              videoTitle = response.data.title || videoTitle;
            }
            // API thứ tư
            else if (response.data.data && response.data.data.url) {
              downloadLink = response.data.data.url;
              videoTitle = response.data.data.title || videoTitle;
            }
            
            if (downloadLink) {
              console.log(`Đã tìm thấy link tải: ${downloadLink}`);
              break;
            }
          }
        }
      } catch (error) {
        console.log(`API ${apiUrl} bị lỗi: ${error.message}`);
        lastError = error;
      }
    }
    
    if (!downloadLink) {
      throw new Error("Không tìm thấy link tải từ tất cả các API đơn giản");
    }
    
    // Tải video
    console.log("Bắt đầu tải video...");
    const videoResponse = await axios({
      method: 'get',
      url: downloadLink,
      responseType: 'arraybuffer',
      timeout: 60000,
      headers: {
        'User-Agent': getRandomUserAgent(),
        'Accept': '*/*',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Referer': 'https://facebook.com/'
      }
    });
    
    fs.writeFileSync(outputPath, Buffer.from(videoResponse.data));
    console.log("Tải video hoàn tất qua Simple API");
    
    return {
      success: true,
      title: videoTitle,
      quality: 'HD'
    };
  } catch (error) {
    console.error("Lỗi Simple API:", error.message);
    throw error;
  }
}

// Phương pháp 1: Sử dụng APi SnapSave
async function downloadWithSnapSave(url, outputPath) {
  try {
    console.log("Đang tải video với SnapSave API");
    
    // Bước 1: Submit URL để lấy token
    const userAgent = getRandomUserAgent();
    
    const options = {
      method: 'POST',
      url: 'https://snapsave.app/action.php',
      headers: {
        'User-Agent': userAgent,
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'x-requested-with': 'XMLHttpRequest',
        'origin': 'https://snapsave.app',
        'referer': 'https://snapsave.app/'
      },
      data: `url=${encodeURIComponent(url)}`
    };
    
    const response = await axios(options);
    
    if (!response.data) {
      throw new Error("SnapSave không trả về dữ liệu");
    }
    
    // Phân tích kết quả HTML
    const html = response.data.toString();
    const $ = cheerio.load(html);
    
    let downloadLink = null;
    let videoTitle = "Video Facebook";
    
    // Tìm tiêu đề video
    const titleMatch = html.match(/<div class="video-title">(.*?)<\/div>/);
    if (titleMatch && titleMatch[1]) {
      videoTitle = titleMatch[1].trim();
    }
    
    // Tìm link tải HD trước, nếu không có thì lấy SD
    if (html.includes('id="download-section"')) {
      $('a.download-link').each((i, el) => {
        const quality = $(el).text().trim();
        const link = $(el).attr('href');
        if (quality.includes('HD') && link) {
          downloadLink = link;
          return false; // break loop
        } else if (!downloadLink && link) {
          downloadLink = link;
        }
      });
    }
    
    // Thử tìm trong cấu trúc HTML khác
    if (!downloadLink) {
      $('table.table a').each((i, el) => {
        const link = $(el).attr('href');
        const quality = $(el).text().trim();
        if (quality.includes('HD') && link) {
          downloadLink = link;
          return false; // break loop
        } else if (!downloadLink && link) {
          downloadLink = link;
        }
      });
    }
    
    // Nếu không tìm thấy, thử regex
    if (!downloadLink) {
      const linkMatches = html.match(/href="(https:\/\/[^"]+\.mp4[^"]*)"/g);
      if (linkMatches && linkMatches.length > 0) {
        const link = linkMatches[0].replace('href="', '').replace('"', '');
        downloadLink = link;
      }
    }
    
    if (!downloadLink) {
      throw new Error("Không tìm thấy link tải từ SnapSave");
    }
    
    // Bước 3: Tải video
    const videoResponse = await axios({
      method: 'get',
      url: downloadLink,
      responseType: 'arraybuffer',
      timeout: 60000,
      headers: {
        'User-Agent': userAgent,
        'Referer': 'https://snapsave.app/'
      }
    });
    
    fs.writeFileSync(outputPath, Buffer.from(videoResponse.data));
    console.log("Tải video hoàn tất qua SnapSave");
    
    return {
      success: true,
      title: videoTitle,
      quality: downloadLink.includes('hd=1') ? 'HD' : 'SD'
    };
  } catch (error) {
    console.error("Lỗi SnapSave:", error.message);
    throw error;
  }
}

// Phương pháp 2: Sử dụng SaveFrom
async function downloadWithSaveFrom(url, outputPath) {
  try {
    console.log("Đang tải video với SaveFrom API");
    
    // Bước 1: Lấy thông tin video
    const userAgent = getRandomUserAgent();
    const options = {
      method: 'POST',
      url: 'https://v18.x2download.com/api/ajaxSearch',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent': userAgent,
        'Origin': 'https://en.savefrom.net',
        'Referer': 'https://en.savefrom.net/'
      },
      data: `q=${encodeURIComponent(url)}`
    };
    
    const response = await axios(options);
    
    if (!response.data || !response.data.links || response.data.links.length === 0) {
      throw new Error("SaveFrom không trả về links");
    }
    
    // Tìm link tải tốt nhất
    let downloadLink = null;
    let videoTitle = response.data.title || "Video Facebook";
    let quality = "SD";
    
    for (const link of response.data.links) {
      if (link.type === "mp4") {
        if (!downloadLink || link.quality > quality) {
          downloadLink = link.url;
          quality = link.quality || "SD";
        }
      }
    }
    
    if (!downloadLink) {
      throw new Error("Không tìm thấy link tải từ SaveFrom");
    }
    
    // Bước 2: Tải video
    const videoResponse = await axios({
      method: 'get',
      url: downloadLink,
      responseType: 'arraybuffer',
      timeout: 60000,
      headers: {
        'User-Agent': userAgent,
        'Referer': 'https://en.savefrom.net/'
      }
    });
    
    fs.writeFileSync(outputPath, Buffer.from(videoResponse.data));
    console.log("Tải video hoàn tất qua SaveFrom");
    
    return {
      success: true,
      title: videoTitle,
      quality: quality
    };
  } catch (error) {
    console.error("Lỗi SaveFrom:", error.message);
    throw error;
  }
}

// Phương pháp 3: Sử dụng SSSTIK API
async function downloadWithSSSTIK(url, outputPath) {
  try {
    console.log("Đang tải video với SSSTIK API");
    
    // Bước 1: Lấy token và cookies
    const userAgent = getRandomUserAgent();
    const websiteResponse = await axios.get('https://ssstik.io/en', {
      headers: {
        'User-Agent': userAgent
      }
    });
    
    // Parse HTML để lấy token
    const $ = cheerio.load(websiteResponse.data);
    const tt = $('input[name="tt"]').val();
    
    if (!tt) {
      throw new Error("Không lấy được token từ SSSTIK");
    }
    
    // Lấy cookies
    const cookies = websiteResponse.headers['set-cookie'] ? 
      websiteResponse.headers['set-cookie'].join('; ') : '';
    
    // Bước 2: Gửi yêu cầu tải
    const formData = new URLSearchParams();
    formData.append('url', url);
    formData.append('tt', tt);
    
    const downloadResponse = await axios.post('https://ssstik.io/abc?url=dl', formData, {
      headers: {
        'User-Agent': userAgent,
        'Cookie': cookies,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Origin': 'https://ssstik.io',
        'Referer': 'https://ssstik.io/en'
      }
    });
    
    // Parse HTML kết quả để tìm link download
    const resultHtml = downloadResponse.data;
    const $result = cheerio.load(resultHtml);
    
    let downloadLink = null;
    let videoTitle = "Video Facebook";
    
    // Tìm link tải và tiêu đề
    downloadLink = $result('a.download_link').attr('href');
    videoTitle = $result('.result_heading').text().trim() || videoTitle;
    
    if (!downloadLink) {
      throw new Error("Không tìm thấy link tải từ SSSTIK");
    }
    
    // Bước 3: Tải video
    const videoResponse = await axios({
      method: 'get',
      url: downloadLink,
      responseType: 'arraybuffer',
      timeout: 60000,
      headers: {
        'User-Agent': userAgent,
        'Referer': 'https://ssstik.io/'
      }
    });
    
    fs.writeFileSync(outputPath, Buffer.from(videoResponse.data));
    console.log("Tải video hoàn tất qua SSSTIK");
    
    return {
      success: true,
      title: videoTitle,
      quality: "HD"
    };
  } catch (error) {
    console.error("Lỗi SSSTIK:", error.message);
    throw error;
  }
}

// Phương pháp 4: Sử dụng FbDown.net
async function downloadWithFbDown(url, outputPath) {
  try {
    console.log("Đang tải video với FbDown.net");
    
    // Bước 1: Submit URL để lấy kết quả
    const userAgent = getRandomUserAgent();
    const websiteUrl = 'https://www.fbdown.net/download.php';
    
    const response = await axios.get(websiteUrl, {
      params: { url: url },
      headers: {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Referer': 'https://www.fbdown.net/'
      }
    });
    
    // Bước 2: Parse HTML để tìm link tải
    const $ = cheerio.load(response.data);
    let downloadLink = null;
    let videoTitle = $('div.video-title').text().trim() || "Video Facebook";
    
    // Tìm link HD trước, nếu không có thì SD
    const hdLink = $('a.btn-primary[download][href*="https"]').attr('href');
    const sdLink = $('a.btn-secondary[download][href*="https"]').attr('href');
    
    if (hdLink) {
      downloadLink = hdLink;
    } else if (sdLink) {
      downloadLink = sdLink;
    }
    
    if (!downloadLink) {
      throw new Error("Không tìm thấy link tải từ FbDown.net");
    }
    
    // Bước 3: Tải video
    const videoResponse = await axios({
      method: 'get',
      url: downloadLink,
      responseType: 'arraybuffer',
      timeout: 60000,
      headers: {
        'User-Agent': userAgent,
        'Referer': 'https://www.fbdown.net/'
      }
    });
    
    fs.writeFileSync(outputPath, Buffer.from(videoResponse.data));
    console.log("Tải video hoàn tất qua FbDown.net");
    
    return {
      success: true,
      title: videoTitle,
      quality: hdLink ? 'HD' : 'SD'
    };
  } catch (error) {
    console.error("Lỗi FbDown.net:", error.message);
    throw error;
  }
}

// Phương pháp 5: Sử dụng dịch vụ FBvideodownloader
async function downloadWithFBDownloader(url, outputPath) {
  try {
    console.log("Đang tải video với dịch vụ FBvideodownloader");
    
    // CORS proxy để vượt qua hạn chế
    const corsProxy = 'https://corsproxy.io/?';
    const encodedUrl = encodeURIComponent(url);
    const serviceUrl = 'https://fbvideodownloader.io/facebook-reels-video-downloader';
    
    const userAgent = getRandomUserAgent();
    
    // Bước 1: Submit URL để lấy kết quả
    const formData = new URLSearchParams();
    formData.append('url', url);
    
    const response = await axios.post(corsProxy + encodeURIComponent(serviceUrl), formData, {
      headers: {
        'User-Agent': userAgent,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Origin': 'https://fbvideodownloader.io',
        'Referer': 'https://fbvideodownloader.io/facebook-reels-video-downloader'
      }
    });
    
    // Bước 2: Parse HTML để tìm link tải
    const $ = cheerio.load(response.data);
    let downloadLink = null;
    let videoTitle = "Video Facebook";
    
    // Tìm tiêu đề video
    videoTitle = $('h1.text-center').text().trim() || videoTitle;
    
    // Tìm link HD trước, nếu không có thì tìm SD
    $('.clip a.btn').each((i, el) => {
      const link = $(el).attr('href');
      const quality = $(el).text().trim();
      
      if (quality.includes('HD') && link && link.includes('https')) {
        downloadLink = link;
        return false; // break loop
      } else if (!downloadLink && link && link.includes('https')) {
        downloadLink = link;
      }
    });
    
    if (!downloadLink) {
      throw new Error("Không tìm thấy link tải từ FBvideodownloader");
    }
    
    // Bước 3: Tải video
    const videoResponse = await axios({
      method: 'get',
      url: downloadLink,
      responseType: 'arraybuffer',
      timeout: 60000,
      headers: {
        'User-Agent': userAgent,
        'Referer': 'https://fbvideodownloader.io/'
      }
    });
    
    fs.writeFileSync(outputPath, Buffer.from(videoResponse.data));
    console.log("Tải video hoàn tất qua FBvideodownloader");
    
    return {
      success: true,
      title: videoTitle,
      quality: downloadLink.includes('hd=1') ? 'HD' : 'SD'
    };
  } catch (error) {
    console.error("Lỗi FBvideodownloader:", error.message);
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
  
  // Phương pháp 0: Simple API
  try {
    console.log("Phương pháp 0: Simple API");
    return await downloadWithSimpleAPI(processedUrl, outputPath);
  } catch (error) {
    console.log("Phương pháp 0 thất bại:", error.message);
    errors.push(`Simple API: ${error.message}`);
  }
  
  // Phương pháp 1: SnapSave API
  try {
    console.log("Phương pháp 1: SnapSave API");
    return await downloadWithSnapSave(processedUrl, outputPath);
  } catch (error) {
    console.log("Phương pháp 1 thất bại:", error.message);
    errors.push(`SnapSave: ${error.message}`);
  }
  
  // Phương pháp 2: SaveFrom
  try {
    console.log("Phương pháp 2: SaveFrom");
    return await downloadWithSaveFrom(processedUrl, outputPath);
  } catch (error) {
    console.log("Phương pháp 2 thất bại:", error.message);
    errors.push(`SaveFrom: ${error.message}`);
  }
  
  // Phương pháp 3: SSSTIK
  try {
    console.log("Phương pháp 3: SSSTIK");
    return await downloadWithSSSTIK(processedUrl, outputPath);
  } catch (error) {
    console.log("Phương pháp 3 thất bại:", error.message);
    errors.push(`SSSTIK: ${error.message}`);
  }
  
  // Phương pháp 4: FbDown.net
  try {
    console.log("Phương pháp 4: FbDown.net");
    return await downloadWithFbDown(processedUrl, outputPath);
  } catch (error) {
    console.log("Phương pháp 4 thất bại:", error.message);
    errors.push(`FbDown.net: ${error.message}`);
  }
  
  // Phương pháp 5: FBvideodownloader
  try {
    console.log("Phương pháp 5: FBvideodownloader");
    return await downloadWithFBDownloader(processedUrl, outputPath);
  } catch (error) {
    console.log("Phương pháp 5 thất bại:", error.message);
    errors.push(`FBvideodownloader: ${error.message}`);
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
