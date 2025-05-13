const axios = require("axios");
const fs = require("fs-extra");
const ytdl = require("ytdl-core");
const path = require("path");

module.exports.config = {
  name: "autodownyoutube",
  version: "1.0.0",
  hasPermssion: 0,
  credits: "LunarKrystal",
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

async function downloadMusicFromYoutube(link, path) {
  return new Promise((resolve, reject) => {
    ytdl(link, {
      filter: format => 
        format.qualityLabel && format.qualityLabel.includes("360p") && format.hasAudio
    })
    .pipe(fs.createWriteStream(path))
    .on("close", async () => {
      try {
        const data = await ytdl.getInfo(link);
        const result = {
          title: data.videoDetails.title,
          dur: Number(data.videoDetails.lengthSeconds),
          viewCount: data.videoDetails.viewCount,
          likes: data.videoDetails.likes,
          author: data.videoDetails.author.name,
          authorUrl: data.videoDetails.author.channel_url,
          publishDate: data.videoDetails.publishDate
        };
        resolve(result);
      } catch (error) {
        reject(error);
      }
    });
  });
}

function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds - (hours * 3600)) / 60);
  const secs = seconds - (hours * 3600) - (minutes * 60);
  
  return `${hours > 0 ? hours + 'h:' : ''}${minutes < 10 && hours > 0 ? '0' : ''}${minutes}m:${secs < 10 ? '0' : ''}${secs}s`;
}

function formatNumber(num) {
  return num.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
}

module.exports.handleEvent = async function({ api, event }) {
  const { threadID, messageID, body } = event;
  
  // Regex để phát hiện link YouTube
  const ytRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=)?([^\s&]+)(?:&[^\s]*)?/;
  
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
    
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    
    try {
      api.sendMessage("⏳ Đang tải video YouTube, vui lòng đợi...", threadID, messageID);
      
      // Kiểm tra thông tin video trước khi tải để tránh tải video quá dài
      const info = await ytdl.getInfo(videoUrl);
      const videoLengthSeconds = Number(info.videoDetails.lengthSeconds);
      
      if (videoLengthSeconds > 900) { // Giới hạn 15 phút
        return api.sendMessage("❎ Không thể tải video dài hơn 15 phút.", threadID, messageID);
      }
      
      // Tạo đường dẫn lưu video
      const filePath = path.join(__dirname, "..", "..", "..", "cache", `yt-${Date.now()}.mp4`);
      
      // Tải video
      const data = await downloadMusicFromYoutube(videoUrl, filePath);
      
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
