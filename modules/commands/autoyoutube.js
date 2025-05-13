const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

module.exports.config = {
  name: "autodownyoutube",
  version: "1.0.2",
  hasPermssion: 0,
  credits: "LunarKrystal",
  description: "Tự động tải video từ YouTube khi phát hiện link",
  commandCategory: "Tiện ích",
  usages: "",
  cooldowns: 5,
  dependencies: {
    "axios": "",
    "fs-extra": ""
  }
};

function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds - (hours * 3600)) / 60);
  const secs = seconds - (hours * 3600) - (minutes * 60);
  
  return `${hours > 0 ? hours + 'h:' : ''}${minutes < 10 && hours > 0 ? '0' : ''}${minutes}m:${secs < 10 ? '0' : ''}${secs}s`;
}

function formatNumber(num) {
  return num.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
}

// Hàm tải video YouTube sử dụng API thay thế
async function downloadYouTubeVideo(videoId, outputPath) {
  try {
    // Thử sử dụng API y2mate để lấy thông tin video
    const infoResponse = await axios.get(`https://y2mate-api.onrender.com/api/info?url=https://www.youtube.com/watch?v=${videoId}`);
    
    if (!infoResponse.data || !infoResponse.data.formats) {
      throw new Error("Không thể lấy thông tin video");
    }
    
    // Lựa chọn định dạng 360p hoặc 720p nếu có
    let selectedFormat = null;
    const formats = infoResponse.data.formats.filter(f => f.hasVideo && f.hasAudio);
    
    // Ưu tiên 360p hoặc 720p
    selectedFormat = formats.find(f => f.qualityLabel === '360p') || 
                    formats.find(f => f.qualityLabel === '720p') ||
                    formats[0]; // Lấy định dạng đầu tiên nếu không có 360p hoặc 720p
    
    if (!selectedFormat) {
      throw new Error("Không tìm thấy định dạng video phù hợp");
    }
    
    // Tải video
    const videoResponse = await axios({
      method: 'get',
      url: selectedFormat.url,
      responseType: 'stream'
    });
    
    videoResponse.data.pipe(fs.createWriteStream(outputPath));
    
    return new Promise((resolve, reject) => {
      videoResponse.data.on('end', () => {
        resolve({
          title: infoResponse.data.title,
          dur: infoResponse.data.lengthSeconds,
          viewCount: infoResponse.data.viewCount,
          likes: infoResponse.data.likes,
          author: infoResponse.data.author.name,
          publishDate: infoResponse.data.publishDate
        });
      });
      
      videoResponse.data.on('error', (err) => {
        reject(err);
      });
    });
  } catch (error) {
    // Nếu API thứ nhất thất bại, thử API thứ hai
    try {
      const apiUrl = `https://api.neoxr.eu.org/api/youtube?url=https://www.youtube.com/watch?v=${videoId}&apikey=NanGC`;
      const apiResponse = await axios.get(apiUrl);
      
      if (!apiResponse.data || !apiResponse.data.data || !apiResponse.data.data.mp4) {
        throw new Error("API thứ hai không trả về định dạng video");
      }
      
      // Ưu tiên chất lượng 360p
      const videoUrl = apiResponse.data.data.mp4['360p'] || apiResponse.data.data.mp4['720p'] || Object.values(apiResponse.data.data.mp4)[0];
      
      // Tải video
      const videoResponse = await axios({
        method: 'get',
        url: videoUrl,
        responseType: 'stream'
      });
      
      videoResponse.data.pipe(fs.createWriteStream(outputPath));
      
      return new Promise((resolve, reject) => {
        videoResponse.data.on('end', () => {
          resolve({
            title: apiResponse.data.data.title,
            dur: Math.floor(apiResponse.data.data.duration),
            viewCount: apiResponse.data.data.views,
            likes: "N/A",
            author: apiResponse.data.data.channel,
            publishDate: "N/A"
          });
        });
        
        videoResponse.data.on('error', (err) => {
          reject(err);
        });
      });
    } catch (secondError) {
      // Thử API thứ ba nếu cả hai API đầu thất bại
      try {
        const rapidApiUrl = `https://youtube-video-download-info.p.rapidapi.com/dl?id=${videoId}`;
        const rapidApiResponse = await axios.get(rapidApiUrl, {
          headers: {
            'X-RapidAPI-Key': 'f57c9dc33dmshc0ddf227c6d1015p1eeb5fjsn91f889ad4a6a',
            'X-RapidAPI-Host': 'youtube-video-download-info.p.rapidapi.com'
          }
        });
        
        if (!rapidApiResponse.data || !rapidApiResponse.data.link) {
          throw new Error("API thứ ba không trả về link video");
        }
        
        // Lấy link video 360p hoặc thấp nhất có thể
        const videoFormats = rapidApiResponse.data.link.filter(l => l.type === "mp4" && l.qualityLabel);
        videoFormats.sort((a, b) => {
          const qualityA = parseInt(a.qualityLabel.replace('p', ''));
          const qualityB = parseInt(b.qualityLabel.replace('p', ''));
          return Math.abs(qualityA - 360) - Math.abs(qualityB - 360);
        });
        
        const bestFormat = videoFormats[0];
        
        // Tải video
        const videoResponse = await axios({
          method: 'get',
          url: bestFormat.url,
          responseType: 'stream'
        });
        
        videoResponse.data.pipe(fs.createWriteStream(outputPath));
        
        return new Promise((resolve, reject) => {
          videoResponse.data.on('end', () => {
            resolve({
              title: rapidApiResponse.data.title,
              dur: Math.floor(rapidApiResponse.data.duration),
              viewCount: rapidApiResponse.data.views,
              likes: rapidApiResponse.data.likes,
              author: rapidApiResponse.data.channel.name,
              publishDate: rapidApiResponse.data.uploadDate
            });
          });
          
          videoResponse.data.on('error', (err) => {
            reject(err);
          });
        });
      } catch (thirdError) {
        throw new Error(`Tất cả các API đều thất bại: ${error.message}, ${secondError.message}, ${thirdError.message}`);
      }
    }
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
      api.sendMessage("⏳ Đang tải video YouTube, vui lòng đợi...", threadID, messageID);
      
      // Kiểm tra thông tin video trước khi tải
      try {
        const videoInfoUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,snippet,statistics&id=${videoId}&key=AIzaSyDEE1-zZSRUN8bPyFaJkVSjTpPjVaqu6JY`;
        const videoInfoResponse = await axios.get(videoInfoUrl);
        
        if (videoInfoResponse.data.items.length === 0) {
          return api.sendMessage("❎ Không tìm thấy thông tin video này.", threadID, messageID);
        }
        
        const videoData = videoInfoResponse.data.items[0];
        
        // Phân tích thời lượng video từ ISO 8601 (PT1H2M3S)
        const duration = videoData.contentDetails.duration;
        const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        const hours = parseInt(match[1] || 0);
        const minutes = parseInt(match[2] || 0);
        const seconds = parseInt(match[3] || 0);
        const totalSeconds = hours * 3600 + minutes * 60 + seconds;
        
        if (totalSeconds > 900) { // Giới hạn 15 phút
          return api.sendMessage("❎ Không thể tải video dài hơn 15 phút.", threadID, messageID);
        }
      } catch (error) {
        console.error("Lỗi khi kiểm tra thông tin video:", error);
        // Không return ở đây, vẫn tiếp tục tải video
      }
      
      // Tạo đường dẫn lưu video
      const filePath = path.join(__dirname, "..", "..", "..", "cache", `yt-${Date.now()}.mp4`);
      
      // Tải video
      const data = await downloadYouTubeVideo(videoId, filePath);
      
      // Gửi video
      api.sendMessage({
        body: `🎬 Tiêu đề: ${data.title}\n⏱️ Thời lượng: ${formatDuration(data.dur)}\n👁️ Lượt xem: ${formatNumber(data.viewCount)}\n👍 Lượt thích: ${formatNumber(data.likes || 0)}\n👤 Kênh: ${data.author}\n📅 Ngày đăng: ${data.publishDate || "N/A"}`,
        attachment: fs.createReadStream(filePath)
      }, threadID, () => fs.unlinkSync(filePath), messageID);
      
    } catch (err) {
      console.error(err);
      return api.sendMessage(`❎ Đã xảy ra lỗi khi tải video YouTube: ${err.message}`, threadID, messageID);
    }
  }
};

module.exports.run = function({ api, event }) {
  // Không cần xử lý vì đây là lệnh noprefix
};
