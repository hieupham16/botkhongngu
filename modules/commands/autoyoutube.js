const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const ytdl = require("ytdl-core");
const stream = require("stream");
const { promisify } = require("util");
const pipeline = promisify(stream.pipeline);

module.exports.config = {
  name: "autodownyoutube",
  version: "1.1.0",
  hasPermssion: 0,
  credits: "Dương Trần dev & LunarKrystal",
  description: "Tự động tải video từ YouTube khi phát hiện link",
  commandCategory: "Tiện ích",
  usages: "",
  cooldowns: 5,
  dependencies: {
    "axios": "",
    "fs-extra": "",
    "ytdl-core": ""
  }
};

function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return "N/A";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds - (hours * 3600)) / 60);
  const secs = seconds - (hours * 3600) - (minutes * 60);
  
  return `${hours > 0 ? hours + 'h:' : ''}${minutes < 10 && hours > 0 ? '0' : ''}${minutes}m:${secs < 10 ? '0' : ''}${secs}s`;
}

function formatNumber(num) {
  if (!num) return "N/A";
  return num.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
}

// API mới phân tích thông tin video YouTube
async function getVideoInfo(videoId) {
  try {
    const response = await axios.get(`https://vid.puffyan.us/api/v1/videos/${videoId}`);
    if (response.data) {
      return response.data;
    }
    throw new Error("Không lấy được thông tin video");
  } catch (error) {
    console.error("Lỗi getVideoInfo:", error.message);
    // Thử dùng API dự phòng
    try {
      const backupResponse = await axios.get(`https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoId}&key=AIzaSyBOei96lHKJJpqbX-oxWLI95MS0pHuM1BA`);
      
      if (backupResponse.data.items && backupResponse.data.items.length > 0) {
        const videoInfo = backupResponse.data.items[0];
        const duration = videoInfo.contentDetails.duration;
        const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        const hours = parseInt(match[1] || 0);
        const minutes = parseInt(match[2] || 0);
        const seconds = parseInt(match[3] || 0);
        const totalSeconds = hours * 3600 + minutes * 60 + seconds;
        
        return {
          title: videoInfo.snippet.title,
          lengthSeconds: totalSeconds,
          viewCount: videoInfo.statistics.viewCount,
          likeCount: videoInfo.statistics.likeCount,
          author: videoInfo.snippet.channelTitle,
          publishedAt: videoInfo.snippet.publishedAt.split('T')[0]
        };
      }
      
      throw new Error("API dự phòng không trả về dữ liệu");
    } catch (backupError) {
      console.error("Lỗi API dự phòng:", backupError.message);
      throw error; // Ném lại lỗi ban đầu
    }
  }
}

// Phương pháp 1: Sử dụng pytube API proxy
async function downloadWithPytubeAPI(videoId, outputPath) {
  try {
    console.log("Đang tải video với PytubeAPI");
    const apiUrl = `https://pytube-api.vercel.app/api/download?videoId=${videoId}&format=mp4&quality=360`;
    
    const response = await axios({
      method: 'get',
      url: apiUrl,
      responseType: 'arraybuffer',
      timeout: 60000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
      }
    });
    
    if (!response.data) {
      throw new Error("Không nhận được dữ liệu video");
    }
    
    // Ghi file
    fs.writeFileSync(outputPath, Buffer.from(response.data));
    console.log("Tải video hoàn tất qua PytubeAPI");
    
    // Lấy thông tin video
    const info = await getVideoInfo(videoId);
    return {
      title: info.title,
      dur: info.lengthSeconds,
      viewCount: info.viewCount,
      likes: info.likeCount,
      author: info.author,
      publishDate: info.publishedAt,
      quality: "360"
    };
  } catch (error) {
    console.error("Lỗi PytubeAPI:", error.message);
    throw error;
  }
}

// Phương pháp 2: Sử dụng Invidious API
async function downloadWithInvidious(videoId, outputPath) {
  try {
    console.log("Đang tải video với Invidious API");
    
    // Lấy thông tin video từ Invidious
    const infoResponse = await axios.get(`https://vid.puffyan.us/api/v1/videos/${videoId}`);
    
    if (!infoResponse.data || !infoResponse.data.formatStreams) {
      throw new Error("Không lấy được thông tin video từ Invidious");
    }
    
    // Chọn format phù hợp (ưu tiên 360p hoặc 720p mp4)
    let selectedFormat = null;
    const mp4Formats = infoResponse.data.formatStreams.filter(format => format.container === 'mp4');
    
    for (const format of mp4Formats) {
      if (format.resolution === '360p') {
        selectedFormat = format;
        break;
      }
      if (format.resolution === '720p') {
        selectedFormat = format;
      }
    }
    
    if (!selectedFormat && mp4Formats.length > 0) {
      selectedFormat = mp4Formats[0];
    }
    
    if (!selectedFormat) {
      throw new Error("Không tìm thấy định dạng video phù hợp");
    }
    
    // Tải video
    console.log(`Đang tải video ${selectedFormat.resolution} từ Invidious`);
    const videoResponse = await axios({
      method: 'get',
      url: selectedFormat.url,
      responseType: 'arraybuffer',
      timeout: 60000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
      }
    });
    
    // Ghi file
    fs.writeFileSync(outputPath, Buffer.from(videoResponse.data));
    console.log("Tải video hoàn tất qua Invidious");
    
    return {
      title: infoResponse.data.title,
      dur: infoResponse.data.lengthSeconds,
      viewCount: infoResponse.data.viewCount,
      likes: infoResponse.data.likeCount,
      author: infoResponse.data.author,
      publishDate: new Date(infoResponse.data.published * 1000).toISOString().split('T')[0],
      quality: selectedFormat.resolution.replace('p', '')
    };
  } catch (error) {
    console.error("Lỗi Invidious:", error.message);
    throw error;
  }
}

// Phương pháp 3: Sử dụng RapidAPI YouTube
async function downloadWithRapidAPI(videoId, outputPath) {
  try {
    console.log("Đang tải video với RapidAPI");
    
    // Lấy thông tin video và link tải
    const options = {
      method: 'GET',
      url: 'https://youtube-mp36.p.rapidapi.com/dl',
      params: {id: videoId, format: 'mp4'},
      headers: {
        'X-RapidAPI-Key': '2a54a31822msh37f2b82797f1c6dp1c1960jsn54bb50dd41e4', // Thay key của bạn vào đây
        'X-RapidAPI-Host': 'youtube-mp36.p.rapidapi.com'
      }
    };
    
    const response = await axios.request(options);
    
    if (!response.data || !response.data.link) {
      throw new Error("RapidAPI không trả về link tải");
    }
    
    // Tải video
    const videoResponse = await axios({
      method: 'get',
      url: response.data.link,
      responseType: 'arraybuffer',
      timeout: 60000
    });
    
    // Ghi file
    fs.writeFileSync(outputPath, Buffer.from(videoResponse.data));
    console.log("Tải video hoàn tất qua RapidAPI");
    
    // Lấy thông tin video
    const info = await getVideoInfo(videoId);
    return {
      title: info.title || response.data.title,
      dur: info.lengthSeconds,
      viewCount: info.viewCount,
      likes: info.likeCount,
      author: info.author,
      publishDate: info.publishedAt,
      quality: "360"
    };
  } catch (error) {
    console.error("Lỗi RapidAPI:", error.message);
    throw error;
  }
}

// Hàm tổng hợp tải video YouTube sử dụng nhiều phương pháp dự phòng
async function downloadYouTubeVideo(videoId, outputPath) {
  let lastError = null;
  
  // Phương pháp 1: Sử dụng Invidious API
  try {
    return await downloadWithInvidious(videoId, outputPath);
  } catch (error) {
    console.log("Phương pháp 1 thất bại, đang thử phương pháp 2...");
    lastError = error;
  }
  
  // Phương pháp 2: Sử dụng PytubeAPI
  try {
    return await downloadWithPytubeAPI(videoId, outputPath);
  } catch (error) {
    console.log("Phương pháp 2 thất bại, đang thử phương pháp 3...");
    lastError = error;
  }
  
  // Phương pháp 3: Sử dụng RapidAPI
  try {
    return await downloadWithRapidAPI(videoId, outputPath);
  } catch (error) {
    console.log("Phương pháp 3 thất bại, đang thử cách cuối...");
    lastError = error;
  }
  
  // Phương pháp 4: Sử dụng ytdl-core với cấu hình đặc biệt (giữ lại để tương thích)
  try {
    console.log(`Đang tải video với ID: ${videoId} bằng ytdl-core`);
    
    // Thiết lập cookie và header đặc biệt để vượt qua giới hạn của YouTube
    const options = {
      quality: 'highest',
      filter: format => format.container === 'mp4' && format.hasVideo && format.hasAudio,
      requestOptions: {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Cookie': 'CONSENT=YES+; VISITOR_INFO1_LIVE=unique-id; GPS=1',
          'Connection': 'keep-alive',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1'
        }
      }
    };
    
    // Bắt thông tin video trước
    const info = await ytdl.getInfo(videoId, options);
    
    // Tìm format video mp4 chất lượng tốt nhất (ưu tiên 360p hoặc 720p)
    let selectedFormat = null;
    const formats = info.formats.filter(format => 
      format.container === 'mp4' && format.hasVideo && format.hasAudio
    );
    
    // Sắp xếp theo chất lượng
    formats.sort((a, b) => {
      const aHeight = a.height || 0;
      const bHeight = b.height || 0;
      
      // Ưu tiên 360p hoặc 720p
      if (aHeight === 360) return -1;
      if (bHeight === 360) return 1;
      if (aHeight === 720) return -1;
      if (bHeight === 720) return 1;
      
      // Nếu không có 360p/720p, ưu tiên chất lượng thấp hơn 720p
      if (aHeight <= 720 && bHeight > 720) return -1;
      if (bHeight <= 720 && aHeight > 720) return 1;
      
      return aHeight - bHeight;
    });
    
    selectedFormat = formats[0];
    if (!selectedFormat) {
      throw new Error("Không tìm thấy định dạng video phù hợp");
    }
    
    console.log(`Đã chọn định dạng: ${selectedFormat.qualityLabel}, bitrate: ${selectedFormat.bitrate}`);
    
    // Tải video
    console.log("Bắt đầu tải video...");
    const videoReadable = ytdl.downloadFromInfo(info, { 
      format: selectedFormat,
      requestOptions: options.requestOptions
    });
    
    // Ghi file
    console.log(`Đang ghi file tới: ${outputPath}`);
    await pipeline(videoReadable, fs.createWriteStream(outputPath));
    
    console.log("Tải video hoàn tất");
    
    // Trả về thông tin video
    return {
      title: info.videoDetails.title,
      dur: parseInt(info.videoDetails.lengthSeconds),
      viewCount: info.videoDetails.viewCount,
      likes: info.videoDetails.likes,
      author: info.videoDetails.author.name,
      publishDate: info.videoDetails.publishDate,
      quality: selectedFormat.qualityLabel.replace('p', '')
    };
  } catch (error) {
    console.error("Tất cả các phương pháp đều thất bại:", error.message);
    
    // Nếu tất cả các phương pháp đều thất bại, ném lỗi cuối cùng
    throw lastError || error;
  }
}

module.exports.handleEvent = async function({ api, event }) {
  const { threadID, messageID, body } = event;
  
  // Regex để phát hiện link YouTube
  const ytRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=|shorts\/)?([^\s&]+)(?:&[^\s]*)?/;
  
  // Kiểm tra xem tin nhắn có chứa link YouTube không
  if (ytRegex.test(body)) {
    const ytLink = body.match(ytRegex)[0];
    let videoId = '';
    
    // Trích xuất video ID từ link
    if (ytLink.includes('youtu.be')) {
      videoId = ytLink.split('youtu.be/')[1].split(/[?&]/)[0];
    } else if (ytLink.includes('youtube.com/watch')) {
      videoId = ytLink.split('v=')[1].split(/[?&]/)[0];
    } else if (ytLink.includes('youtube.com/shorts')) {
      videoId = ytLink.split('shorts/')[1].split(/[?&]/)[0];
    }
    
    if (!videoId) return;
    
    try {
      api.sendMessage(`⏳ Đang tải video YouTube ID: ${videoId}, vui lòng đợi (có thể mất đến 1-2 phút)...`, threadID, messageID);
      
      // Tạo đường dẫn lưu video
      const filePath = path.join(__dirname, "..", "..", "..", "cache", `yt-${videoId}.mp4`);
      
      // Kiểm tra thời lượng video trước khi tải (nếu có thể)
      try {
        const videoInfo = await getVideoInfo(videoId);
        
        if (videoInfo && videoInfo.lengthSeconds) {
          const totalSeconds = videoInfo.lengthSeconds;
          
          if (totalSeconds > 900) { // Giới hạn 15 phút
            return api.sendMessage("❎ Không thể tải video dài hơn 15 phút.", threadID, messageID);
          }
        }
      } catch (error) {
        // Bỏ qua lỗi kiểm tra thời lượng, vẫn tiếp tục tải
        console.error("Lỗi khi kiểm tra thông tin video:", error.message);
      }
      
      // Tải video bằng phương pháp mới
      const data = await downloadYouTubeVideo(videoId, filePath);
      
      // Kiểm tra kích thước file trước khi gửi
      const fileStats = fs.statSync(filePath);
      const fileSizeMB = fileStats.size / (1024 * 1024);
      
      if (fileSizeMB > 25) {
        fs.unlinkSync(filePath);
        return api.sendMessage(`❎ Video có kích thước quá lớn (${fileSizeMB.toFixed(2)}MB) để gửi. Giới hạn là 25MB.`, threadID, messageID);
      }
      
      // Gửi video
      let qualityInfo = data.quality ? `\n🎞️ Chất lượng: ${data.quality}p` : '';
      
      api.sendMessage({
        body: `🎬 Tiêu đề: ${data.title}\n⏱️ Thời lượng: ${formatDuration(data.dur)}\n👁️ Lượt xem: ${formatNumber(data.viewCount)}\n👍 Lượt thích: ${formatNumber(data.likes)}\n👤 Kênh: ${data.author}\n📅 Ngày đăng: ${data.publishDate || "N/A"}${qualityInfo}`,
        attachment: fs.createReadStream(filePath)
      }, threadID, () => fs.unlinkSync(filePath), messageID);
      
    } catch (err) {
      console.error("Lỗi tải video:", err);
      return api.sendMessage(`❎ Đã xảy ra lỗi khi tải video YouTube: ${err.message}. Vui lòng thử lại sau hoặc thử video khác.`, threadID, messageID);
    }
  }
};

module.exports.run = function({ api, event }) {
  // Không cần xử lý vì đây là lệnh noprefix
};
