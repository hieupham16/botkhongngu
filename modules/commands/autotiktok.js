const axios = require("axios");
const fs = require("fs-extra");
const request = require("request");

module.exports.config = {
  name: "autodowntiktok",
  version: "1.0.0",
  hasPermssion: 0,
  credits: "LunarKrystal",
  description: "Tự động tải video từ TikTok khi phát hiện link",
  commandCategory: "Tiện ích",
  usages: "",
  cooldowns: 5,
  dependencies: {
    "axios": "",
    "fs-extra": "",
    "request": ""
  }
};

module.exports.handleEvent = async function({ api, event }) {
  const { threadID, messageID, body } = event;
  
  // Regex để tìm các link TikTok phổ biến
  const tiktokRegex = /(tiktok.com|douyin.com|vm.tiktok.com|vt.tiktok.com|www.tiktok.com)\/([@a-zA-Z0-9_-]+\/)?([a-zA-Z0-9_-]+)/;
  
  // Kiểm tra nếu tin nhắn chứa link TikTok
  if (tiktokRegex.test(body)) {
    const link = body.match(tiktokRegex)[0];
    try {
      api.sendMessage("⏳ Đang tải video TikTok...", threadID, messageID);
      
      // Sử dụng API TikWM để tải video không watermark
      const res = await axios.get(`https://www.tikwm.com/api/?url=${link}`);
      
      if (res.data.code !== 0) {
        return api.sendMessage("❎ Không thể tải video TikTok này.", threadID);
      }
      
      const { play, author, music, digg_count, comment_count, play_count, share_count, download_count, title, duration, region } = res.data.data;
      
      // Tải video
      const videoPath = __dirname + "/cache/tiktok_autodown.mp4";
      
      const callback = () => {
        api.sendMessage({
          body: `[ TIKTOK VIDEO ]\n────────────────────\n🗺️ Quốc gia: ${region}\n📝 Tiêu đề: ${title}\n👤 Tên kênh: ${author.nickname}\n🌾 ID người dùng: ${author.unique_id}\n❤️ Lượt tim: ${digg_count}\n💬 Tổng bình luận: ${comment_count}\n🔎 Lượt xem: ${play_count}\n🔀 Lượt chia sẻ: ${share_count}\n⬇️ Lượt tải: ${download_count}\n⏳ Thời gian: ${duration} giây`,
          attachment: fs.createReadStream(videoPath)
        }, threadID, () => fs.unlinkSync(videoPath), messageID);
      };
      
      request(encodeURI(play)).pipe(fs.createWriteStream(videoPath)).on('close', callback);
    } catch (err) {
      console.error(err);
      return api.sendMessage("❎ Đã xảy ra lỗi khi tải video TikTok.", threadID, messageID);
    }
  }
};

module.exports.run = function({ api, event }) {
  // Không cần xử lý vì đây là lệnh noprefix
}; 
