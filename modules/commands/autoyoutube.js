const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
// Không sử dụng ytdl-core để tương thích tốt hơn với Render
// const ytdl = require("ytdl-core");
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
    "fs-extra": ""
    // Loại bỏ ytdl-core khỏi dependencies
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

// Thêm API mới: Y2mate API
async function downloadWithY2mate(videoId, outputPath) {
  try {
    console.log("Đang tải video với Y2mate API");
    
    // Bước 1: Lấy thông tin tải từ Y2mate
    const firstResponse = await axios.post('https://www.y2mate.com/mates/analyze/ajax', 
      new URLSearchParams({
        'k_query': `https://www.youtube.com/watch?v=${videoId}`,
        'k_page': 'home',
        'hl': 'vi',
        'q_auto': '0'
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
          'X-Requested-With': 'XMLHttpRequest'
        }
      }
    );
    
    if (!firstResponse.data || !firstResponse.data.result) {
      throw new Error("Y2mate không trả về kết quả phân tích");
    }
    
    // Tìm định dạng mp4 360p
    const htmlResult = firstResponse.data.result;
    const videoTitle = firstResponse.data.title || "YouTube Video";
    
    // Trích xuất id của video trong hệ thống Y2mate
    const videoIdMatch = htmlResult.match(/var k__id\s*=\s*["']([^"']+)["']/);
    if (!videoIdMatch) {
      throw new Error("Không tìm thấy ID video trong Y2mate");
    }
    const k__id = videoIdMatch[1];
    
    // Bước 2: Tìm link mp4 chất lượng 360p
    const formatId = htmlResult.includes('mp4a') ? 'mp4a' : 'mp4';
    const qualityId = '18'; // Mã cho 360p
    
    // Yêu cầu link tải
    const secondResponse = await axios.post('https://www.y2mate.com/mates/convert', 
      new URLSearchParams({
        'type': 'youtube',
        '_id': k__id,
        'v_id': videoId,
        'ajax': '1',
        'token': '',
        'ftype': formatId,
        'fquality': qualityId
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
          'X-Requested-With': 'XMLHttpRequest'
        }
      }
    );
    
    if (!secondResponse.data || !secondResponse.data.result) {
      throw new Error("Y2mate không trả về link tải");
    }
    
    // Trích xuất link tải từ HTML
    const downloadLinkMatch = secondResponse.data.result.match(/href="([^"]+)"/);
    if (!downloadLinkMatch) {
      throw new Error("Không tìm thấy link tải trong kết quả Y2mate");
    }
    
    const downloadLink = downloadLinkMatch[1];
    
    // Tải video
    console.log(`Đang tải video từ: ${downloadLink}`);
    const videoResponse = await axios({
      method: 'get',
      url: downloadLink,
      responseType: 'arraybuffer',
      timeout: 60000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
      }
    });
    
    // Ghi file
    fs.writeFileSync(outputPath, Buffer.from(videoResponse.data));
    console.log("Tải video hoàn tất qua Y2mate");
    
    // Lấy thông tin video
    const info = await getVideoInfo(videoId);
    return {
      title: info.title || videoTitle,
      dur: info.lengthSeconds,
      viewCount: info.viewCount,
      likes: info.likeCount,
      author: info.author,
      publishDate: info.publishedAt,
      quality: "360"
    };
  } catch (error) {
    console.error("Lỗi Y2mate:", error.message);
    throw error;
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

// Thêm API mới: SSYT API
async function downloadWithSSYT(videoId, outputPath) {
  try {
    console.log("Đang tải video với SSYT API");
    
    // Sử dụng dịch vụ SSYouTube.com
    const ssytUrl = `https://ssyoutube.com/api/convert`;
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    
    const response = await axios.post(ssytUrl, {
      url: videoUrl
    }, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Origin': 'https://ssyoutube.com',
        'Referer': 'https://ssyoutube.com/'
      }
    });
    
    if (!response.data || !response.data.url) {
      throw new Error("SSYT API không trả về link tải");
    }
    
    // Tìm link mp4 chất lượng thích hợp
    let downloadUrl = '';
    const formats = response.data.url || [];
    let mp4formats = formats.filter(format => format.ext === 'mp4' && format.audioAvailable);
    
    // Sắp xếp theo chất lượng, ưu tiên 360p
    mp4formats.sort((a, b) => {
      if (a.quality === '360p') return -1;
      if (b.quality === '360p') return 1;
      if (a.quality === '720p') return -1;
      if (b.quality === '720p') return 1;
      return parseInt(a.quality) - parseInt(b.quality);
    });
    
    if (mp4formats.length > 0) {
      downloadUrl = mp4formats[0].url;
    } else if (formats.length > 0 && formats[0].url) {
      downloadUrl = formats[0].url;
    }
    
    if (!downloadUrl) {
      throw new Error("Không tìm thấy link tải phù hợp từ SSYT");
    }
    
    // Tải video
    const videoResponse = await axios({
      method: 'get',
      url: downloadUrl,
      responseType: 'arraybuffer',
      timeout: 60000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
      }
    });
    
    // Ghi file
    fs.writeFileSync(outputPath, Buffer.from(videoResponse.data));
    console.log("Tải video hoàn tất qua SSYT API");
    
    // Lấy thông tin video
    const info = await getVideoInfo(videoId);
    const quality = mp4formats.length > 0 ? mp4formats[0].quality.replace('p', '') : "360";
    
    return {
      title: info.title || response.data.meta?.title || "YouTube Video",
      dur: info.lengthSeconds || response.data.meta?.duration || 0,
      viewCount: info.viewCount,
      likes: info.likeCount,
      author: info.author || response.data.meta?.source || "YouTube",
      publishDate: info.publishedAt,
      quality: quality
    };
  } catch (error) {
    console.error("Lỗi SSYT API:", error.message);
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
  
  // Phương pháp 2: Sử dụng Y2mate API
  try {
    return await downloadWithY2mate(videoId, outputPath);
  } catch (error) {
    console.log("Phương pháp 2 thất bại, đang thử phương pháp 3...");
    lastError = error;
  }
  
  // Phương pháp 3: Sử dụng SSYT API
  try {
    return await downloadWithSSYT(videoId, outputPath);
  } catch (error) {
    console.log("Phương pháp 3 thất bại, đang thử phương pháp 4...");
    lastError = error;
  }
  
  // Phương pháp 4: Sử dụng PytubeAPI
  try {
    return await downloadWithPytubeAPI(videoId, outputPath);
  } catch (error) {
    console.error("Tất cả các phương pháp đều thất bại:", error.message);
    throw new Error("Tất cả các API đều thất bại. Vui lòng thử lại sau.");
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
