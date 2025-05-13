const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const crypto = require("crypto");
const request = require("request");
const cheerio = require("cheerio");

module.exports.config = {
  name: "autodownfacebook",
  version: "1.3.0",
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

// Phương pháp 1: Sử dụng FbDownloader.app
async function downloadWithFbDownloaderApp(url, outputPath) {
  try {
    console.log("Đang tải video với FbDownloader.app");
    
    // Bước 1: Gửi URL để lấy token và video ID
    const userAgent = getRandomUserAgent();
    const initialResponse = await axios.get('https://fbdownloader.app/api/ajaxSearch', {
      params: {
        q: url,
        lang: 'vi'
      },
      headers: {
        'User-Agent': userAgent,
        'Referer': 'https://fbdownloader.app/',
        'Accept': 'application/json',
        'sec-ch-ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"'
      }
    });
    
    if (!initialResponse.data || !initialResponse.data.token) {
      throw new Error("Không thể lấy token từ FbDownloader");
    }
    
    // Bước 2: Sử dụng token để lấy link tải
    const token = initialResponse.data.token;
    const downloadResponse = await axios.get('https://fbdownloader.app/api/ajaxConvert', {
      params: {
        token: token,
        lang: 'vi'
      },
      headers: {
        'User-Agent': userAgent,
        'Referer': 'https://fbdownloader.app/',
        'Accept': 'application/json',
        'sec-ch-ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"'
      }
    });
    
    if (!downloadResponse.data || !downloadResponse.data.links || downloadResponse.data.links.length === 0) {
      throw new Error("Không tìm thấy link tải từ FbDownloader.app");
    }
    
    // Tìm link video HD (hoặc lấy SD nếu không có HD)
    let downloadLink = null;
    for (const link of downloadResponse.data.links) {
      if (link.quality === 'hd' && link.url) {
        downloadLink = link.url;
        break;
      } else if (link.quality === 'sd' && link.url) {
        downloadLink = link.url;
      }
    }
    
    if (!downloadLink) {
      throw new Error("Không tìm thấy link tải HD hoặc SD");
    }
    
    // Bước 3: Tải video
    const videoResponse = await axios({
      method: 'get',
      url: downloadLink,
      responseType: 'arraybuffer',
      timeout: 60000,
      headers: {
        'User-Agent': userAgent,
        'Referer': 'https://fbdownloader.app/'
      }
    });
    
    fs.writeFileSync(outputPath, Buffer.from(videoResponse.data));
    console.log("Tải video hoàn tất qua FbDownloader.app");
    
    return {
      success: true,
      title: downloadResponse.data.title || "Video Facebook",
      quality: downloadLink.includes('hd=1') ? 'HD' : 'SD'
    };
  } catch (error) {
    console.error("Lỗi FbDownloader.app:", error.message);
    throw error;
  }
}

// Phương pháp 2: Sử dụng GetFVid
async function downloadWithGetFVid(url, outputPath) {
  try {
    console.log("Đang tải video với GetFVid");
    
    // Bước 1: Submit URL để lấy kết quả
    const userAgent = getRandomUserAgent();
    const formData = new URLSearchParams();
    formData.append('url', url);
    
    const response = await axios.post('https://www.getfvid.com/downloader', formData, {
      headers: {
        'User-Agent': userAgent,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Origin': 'https://www.getfvid.com',
        'Referer': 'https://www.getfvid.com/',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
      }
    });
    
    // Bước 2: Phân tích HTML để tìm link tải HD
    const $ = cheerio.load(response.data);
    let downloadLink = null;
    let videoTitle = $('h5.card-title').text().trim() || "Video Facebook";
    
    // Tìm link video HD (nếu có) hoặc SD
    $('.btns-download .btn.btn-primary').each((index, element) => {
      const text = $(element).text().trim();
      const link = $(element).attr('href');
      
      if (text.includes('HD')) {
        downloadLink = link;
        return false; // break the loop
      } else if (text.includes('SD') && !downloadLink) {
        downloadLink = link;
      }
    });
    
    if (!downloadLink) {
      throw new Error("Không tìm thấy link tải từ GetFVid");
    }
    
    // Bước 3: Tải video
    const videoResponse = await axios({
      method: 'get',
      url: downloadLink,
      responseType: 'arraybuffer',
      timeout: 60000,
      headers: {
        'User-Agent': userAgent,
        'Referer': 'https://www.getfvid.com/'
      }
    });
    
    fs.writeFileSync(outputPath, Buffer.from(videoResponse.data));
    console.log("Tải video hoàn tất qua GetFVid");
    
    return {
      success: true,
      title: videoTitle,
      quality: downloadLink.includes('hd=1') ? 'HD' : 'SD'
    };
  } catch (error) {
    console.error("Lỗi GetFVid:", error.message);
    throw error;
  }
}

// Phương pháp 3: Sử dụng FBDownloader.net
async function downloadWithFBDownloaderNet(url, outputPath) {
  try {
    console.log("Đang tải video với FBDownloader.net");
    
    // Bước 1: Submit URL để lấy kết quả
    const userAgent = getRandomUserAgent();
    const formData = new URLSearchParams();
    formData.append('url', url);
    
    const response = await axios.post('https://fbdownloader.net/process-link', formData, {
      headers: {
        'User-Agent': userAgent,
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest',
        'Origin': 'https://fbdownloader.net',
        'Referer': 'https://fbdownloader.net/'
      }
    });
    
    if (!response.data || !response.data.success) {
      throw new Error("FBDownloader.net không xử lý được link");
    }
    
    // Bước 2: Parse HTML để lấy link tải
    const $ = cheerio.load(response.data.data);
    let downloadLink = null;
    
    // Ưu tiên link HD trước
    $('a.download-link').each((index, element) => {
      const link = $(element).attr('href');
      const quality = $(element).text().trim();
      
      if (quality.includes('HD') || quality.includes('720p')) {
        downloadLink = link;
        return false; // break the loop
      } else if (quality.includes('SD') && !downloadLink) {
        downloadLink = link;
      }
    });
    
    if (!downloadLink) {
      throw new Error("Không tìm thấy link tải từ FBDownloader.net");
    }
    
    // Bước 3: Tải video
    const videoResponse = await axios({
      method: 'get',
      url: downloadLink,
      responseType: 'arraybuffer',
      timeout: 60000,
      headers: {
        'User-Agent': userAgent,
        'Referer': 'https://fbdownloader.net/'
      }
    });
    
    fs.writeFileSync(outputPath, Buffer.from(videoResponse.data));
    console.log("Tải video hoàn tất qua FBDownloader.net");
    
    // Lấy tiêu đề video nếu có
    const videoTitle = $('div.titre').text().trim() || "Video Facebook";
    
    return {
      success: true,
      title: videoTitle,
      quality: downloadLink.includes('hd=1') ? 'HD' : 'SD'
    };
  } catch (error) {
    console.error("Lỗi FBDownloader.net:", error.message);
    throw error;
  }
}

// Phương pháp 4: Sử dụng FBVideo
async function downloadWithFBVideo(url, outputPath) {
  return new Promise((resolve, reject) => {
    try {
      console.log("Đang tải video với FBVideo");
      
      // Tạo một cookie ngẫu nhiên để tránh bị phát hiện là bot
      const userAgent = getRandomUserAgent();
      const randomCookie = `sb=${crypto.randomBytes(12).toString('hex')}; datr=${crypto.randomBytes(12).toString('hex')}; locale=en_US`;
      
      // Thực hiện request đến Facebook với tham số mobile_iframe=1 để lấy mobile version
      const fbUrl = url.includes('?') ? `${url}&mobile_iframe=1` : `${url}?mobile_iframe=1`;
      
      request({
        url: fbUrl,
        headers: {
          'User-Agent': userAgent, 
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
          console.log("Đã nhận phản hồi từ Facebook, đang phân tích...");
          
          // Lấy tiêu đề video
          const $ = cheerio.load(body);
          let videoTitle = $('meta[property="og:title"]').attr('content') || "Video Facebook";
          
          // Tìm URL video trong file HTML (mobile version thường hiển thị video trực tiếp)
          let videoURL = null;
          
          // Phương pháp 1: Tìm trong thẻ meta
          videoURL = $('meta[property="og:video:url"]').attr('content') || 
                    $('meta[property="og:video"]').attr('content') || 
                    $('meta[property="og:video:secure_url"]').attr('content');
          
          // Phương pháp 2: Tìm trong thẻ video
          if (!videoURL) {
            const videoElement = $('video source').attr('src');
            if (videoElement) {
              videoURL = videoElement;
            }
          }
          
          // Phương pháp 3: Tìm trong các script
          if (!videoURL) {
            const scriptTags = $('script').map((i, el) => $(el).html()).get();
            
            for (const script of scriptTags) {
              // Tìm các chuỗi có dạng "videoUrl":"http...mp4"
              const urlMatches = script.match(/"(?:playable_url(?:_quality_hd)?|video_url|videoURL|video_data|video)"\s*:\s*"([^"]+\.mp4[^"]*)"/);
              if (urlMatches && urlMatches[1]) {
                videoURL = urlMatches[1].replace(/\\/g, '');
                break;
              }
              
              // Tìm theo cấu trúc JSON
              if (script.includes('videoData') || script.includes('video_data')) {
                try {
                  // Tìm đoạn JSON chứa thông tin video
                  const jsonStart = script.indexOf('{');
                  const jsonEnd = script.lastIndexOf('}') + 1;
                  
                  if (jsonStart >= 0 && jsonEnd > jsonStart) {
                    const jsonStr = script.substring(jsonStart, jsonEnd);
                    const jsonData = JSON.parse(jsonStr);
                    
                    if (jsonData.videoData && jsonData.videoData.video_url) {
                      videoURL = jsonData.videoData.video_url;
                      break;
                    } else if (jsonData.video_data && jsonData.video_data.progressive) {
                      // Lấy link chất lượng cao nhất
                      const progressive = jsonData.video_data.progressive;
                      if (progressive && progressive.length > 0) {
                        progressive.sort((a, b) => (b.width || 0) - (a.width || 0));
                        videoURL = progressive[0].url;
                        break;
                      }
                    }
                  }
                } catch (e) {
                  // Bỏ qua lỗi phân tích JSON
                  console.log("Lỗi phân tích JSON:", e.message);
                }
              }
            }
          }
          
          if (!videoURL) {
            return reject(new Error("Không tìm thấy URL video trong mã nguồn trang"));
          }
          
          // Giải mã URL (nếu cần)
          videoURL = videoURL.replace(/\\u0025/g, '%')
                           .replace(/\\u002F/g, '/')
                           .replace(/\\u003A/g, ':')
                           .replace(/\\u003F/g, '?')
                           .replace(/\\u003D/g, '=')
                           .replace(/\\u0026/g, '&')
                           .replace(/\\/g, '');
          
          console.log(`Đã tìm thấy URL video: ${videoURL}`);
          
          // Đôi khi URL không có giao thức, thêm vào nếu cần
          if (videoURL.startsWith('//')) {
            videoURL = 'https:' + videoURL;
          }
          
          // Tải video
          request({
            url: videoURL,
            headers: {
              'User-Agent': userAgent,
              'Referer': url
            }
          })
          .on('error', function(err) {
            reject(new Error(`Lỗi khi tải video: ${err.message}`));
          })
          .pipe(fs.createWriteStream(outputPath))
          .on('close', function() {
            console.log("Tải video hoàn tất bằng phương pháp FBVideo");
            resolve({
              success: true,
              title: videoTitle
            });
          });
        } catch (err) {
          reject(new Error(`Lỗi khi phân tích mã nguồn: ${err.message}`));
        }
      });
    } catch (error) {
      reject(new Error(`Lỗi FBVideo: ${error.message}`));
    }
  });
}

// Hàm tổng hợp tải video Facebook sử dụng nhiều phương pháp dự phòng
async function downloadFacebookVideo(videoUrl, outputPath) {
  let errors = [];
  
  // Kiểm tra URL - đảm bảo sửa đổi URL để có thể truy cập được trên mobile
  let processedUrl = videoUrl;
  
  // Nếu là URL reel, thêm tham số để dễ truy cập
  if (processedUrl.includes('facebook.com/reel/')) {
    processedUrl = processedUrl.includes('?') ? 
      `${processedUrl}&_rdr` : 
      `${processedUrl}?_rdr`;
  }
  
  console.log(`URL được xử lý: ${processedUrl}`);
  
  // Phương pháp 1: FBVideo - Truy cập trực tiếp vào Facebook
  try {
    console.log("Phương pháp 1: FBVideo - Truy cập trực tiếp");
    return await downloadWithFBVideo(processedUrl, outputPath);
  } catch (error) {
    console.log("Phương pháp 1 thất bại:", error.message);
    errors.push(`FBVideo: ${error.message}`);
  }
  
  // Phương pháp 2: FbDownloader.app
  try {
    console.log("Phương pháp 2: FbDownloader.app");
    return await downloadWithFbDownloaderApp(processedUrl, outputPath);
  } catch (error) {
    console.log("Phương pháp 2 thất bại:", error.message);
    errors.push(`FbDownloader.app: ${error.message}`);
  }
  
  // Phương pháp 3: GetFVid
  try {
    console.log("Phương pháp 3: GetFVid");
    return await downloadWithGetFVid(processedUrl, outputPath);
  } catch (error) {
    console.log("Phương pháp 3 thất bại:", error.message);
    errors.push(`GetFVid: ${error.message}`);
  }
  
  // Phương pháp 4: FBDownloader.net
  try {
    console.log("Phương pháp 4: FBDownloader.net");
    return await downloadWithFBDownloaderNet(processedUrl, outputPath);
  } catch (error) {
    console.log("Phương pháp 4 thất bại:", error.message);
    errors.push(`FBDownloader.net: ${error.message}`);
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
