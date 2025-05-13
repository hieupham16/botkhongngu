const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

module.exports.config = {
  name: "autodownfacebook",
  version: "1.0.0",
  hasPermssion: 0,
  credits: "Dương Trân dev",
  description: "Tự động tải video từ Facebook khi phát hiện link",
  commandCategory: "Tiện ích",
  usages: "",
  cooldowns: 5,
  dependencies: {
    "axios": "",
    "fs-extra": ""
  }
};

async function downloadFacebookVideo(videoUrl, outputPath) {
  try {
    // Sử dụng API hoặc thư viện để tải video từ Facebook
    const response = await axios.get(videoUrl, { responseType: 'arraybuffer' });
    fs.writeFileSync(outputPath, Buffer.from(response.data));
    console.log("Tải video hoàn tất");
  } catch (error) {
    console.error("Lỗi tải video Facebook:", error.message);
    throw error;
  }
}

module.exports.handleEvent = async function({ api, event }) {
  const { threadID, messageID, body } = event;
  
  // Regex để phát hiện link Facebook
  const fbRegex = /(?:https?:\/\/)?(?:www\.)?(?:facebook\.com)\/(?:watch\/\?v=)?([^\s&]+)/;
  
  if (fbRegex.test(body)) {
    const fbLink = body.match(fbRegex)[0];
    
    try {
      api.sendMessage(`⏳ Đang tải video Facebook, vui lòng đợi...`, threadID, messageID);
      
      const filePath = path.join(__dirname, "..", "..", "..", "cache", `fb-video.mp4`);
      
      await downloadFacebookVideo(fbLink, filePath);
      
      const fileStats = fs.statSync(filePath);
      const fileSizeMB = fileStats.size / (1024 * 1024);
      
      if (fileSizeMB > 25) {
        fs.unlinkSync(filePath);
        return api.sendMessage(`❎ Video có kích thước quá lớn (${fileSizeMB.toFixed(2)}MB) để gửi. Giới hạn là 25MB.`, threadID, messageID);
      }
      
      api.sendMessage({
        body: `🎬 Video từ Facebook`,
        attachment: fs.createReadStream(filePath)
      }, threadID, () => fs.unlinkSync(filePath), messageID);
      
    } catch (err) {
      console.error("Lỗi tải video:", err);
      return api.sendMessage(`❎ Đã xảy ra lỗi khi tải video Facebook: ${err.message}. Vui lòng thử lại sau hoặc thử video khác.`, threadID, messageID);
    }
  }
};

module.exports.run = function({ api, event }) {
  // Không cần xử lý vì đây là lệnh noprefix
}; 
