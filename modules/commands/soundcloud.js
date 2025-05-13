const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const cheerio = require("cheerio");

module.exports.config = {
  name: "autodownsoundcloud",
  version: "1.0.0",
  hasPermssion: 0,
  credits: "LunarKrystal",
  description: "Tự động tải nhạc từ SoundCloud khi phát hiện link",
  commandCategory: "Tiện ích",
  usages: "",
  cooldowns: 5,
  dependencies: {
    "axios": "",
    "fs-extra": "",
    "cheerio": ""
  }
};

module.exports.handleEvent = async function({ api, event }) {
  const { threadID, messageID, body } = event;
  
  // Regex để tìm các link SoundCloud
  const scRegex = /(soundcloud\.com\/[a-zA-Z0-9-_]+\/[a-zA-Z0-9-_]+)/i;
  
  // Kiểm tra nếu tin nhắn chứa link SoundCloud
  if (scRegex.test(body)) {
    let scLink = body.match(scRegex)[0];
    if (!scLink.startsWith('http')) {
      scLink = 'https://' + scLink;
    }
    
    try {
      api.sendMessage("⏳ Đang tải nhạc từ SoundCloud...", threadID, messageID);
      
      // Bước 1: Lấy thông tin bài hát và tạo form để chuyển đổi
      const res = await axios.get('https://soundcloudmp3.org/id');
      const html = res.data;
      const $ = cheerio.load(html);
      const token = $('form[action="https://soundcloudmp3.org/converter"] > input[type="hidden"]').attr('value');
      
      // Bước 2: Gửi yêu cầu chuyển đổi
      const conversion = await axios.post('https://soundcloudmp3.org/converter', {
        url: scLink,
        token: token
      }, {
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/102.0.5005.63 Safari/537.36'
        }
      });
      
      const htmlConversion = conversion.data;
      const $2 = cheerio.load(htmlConversion);
      
      // Trích xuất thông tin
      const title = $2('div.info > p.title').text().trim();
      const thumbnail = $2('div.info > img.rounded').attr('src');
      const duration = $2('div.info > p.time').text().trim();
      const downloadLink = $2('a.btn.btn-success').attr('href');
      
      if (!downloadLink) {
        return api.sendMessage("❎ Không thể tải nhạc từ link này.", threadID, messageID);
      }
      
      // Tải ảnh thumbnail
      const thumbnailPath = path.join(__dirname, "..", "..", "..", "cache", `sc_thumbnail_${Date.now()}.jpg`);
      const thumbnailResponse = await axios.get(thumbnail, { responseType: 'arraybuffer' });
      fs.writeFileSync(thumbnailPath, Buffer.from(thumbnailResponse.data, 'binary'));
      
      // Tải file nhạc
      const audioPath = path.join(__dirname, "..", "..", "..", "cache", `sc_audio_${Date.now()}.mp3`);
      const audioResponse = await axios.get(downloadLink, { responseType: 'arraybuffer' });
      fs.writeFileSync(audioPath, Buffer.from(audioResponse.data, 'binary'));
      
      // Gửi nhạc và thumbnail
      api.sendMessage({
        body: `[ SOUNDCLOUD ]\n────────────────────\n📝 Tiêu đề: ${title}\n⏱️ Thời lượng: ${duration}`,
        attachment: [
          fs.createReadStream(thumbnailPath),
          fs.createReadStream(audioPath)
        ]
      }, threadID, () => {
        fs.unlinkSync(thumbnailPath);
        fs.unlinkSync(audioPath);
      }, messageID);
      
    } catch (err) {
      console.error(err);
      return api.sendMessage(`❎ Đã xảy ra lỗi khi tải nhạc SoundCloud: ${err.message}`, threadID, messageID);
    }
  }
};

module.exports.run = function({ api, event }) {
  // Không cần xử lý vì đây là lệnh noprefix
}; 
