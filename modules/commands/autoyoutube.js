const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

module.exports.config = {
  name: "autodownyoutube",
  version: "1.0.4",
  hasPermssion: 0,
  credits: "Dương Trần dev",
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

// Hàm tải video YouTube đơn giản hơn và đáng tin cậy hơn
async function downloadYouTubeVideo(videoId, outputPath) {
  try {
    console.log(`Đang tải video với ID: ${videoId}`);
    
    // Sử dụng API từ ssyoutube.com (savefrom)
    const apiUrl = `https://ssyoutube.com/api/convert`;
    const payload = {
      url: `https://www.youtube.com/watch?v=${videoId}`
    };
    
    console.log("Gửi yêu cầu đến API ssyoutube.com");
    const response = await axios.post(apiUrl, payload, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    if (!response.data || !response.data.url || !response.data.url.length) {
      throw new Error("API không trả về link video hợp lệ");
    }
    
    console.log("Đã nhận được phản hồi từ API, đang tìm định dạng video phù hợp");
    
    // Tìm định dạng mp4 tốt nhất
    const mp4Formats = response.data.url.filter(format => 
      format.ext === 'mp4' && format.quality && format.size
    );
    
    if (mp4Formats.length === 0) {
      throw new Error("Không tìm thấy định dạng mp4 phù hợp");
    }
    
    // Sắp xếp theo chất lượng, ưu tiên 360p hoặc 720p
    mp4Formats.sort((a, b) => {
      const qualityA = parseInt(a.quality);
      const qualityB = parseInt(b.quality);
      
      // Nếu một trong hai là 360p, ưu tiên nó
      if (qualityA === 360) return -1;
      if (qualityB === 360) return 1;
      
      // Nếu một trong hai là 720p, ưu tiên nó
      if (qualityA === 720) return -1;
      if (qualityB === 720) return 1;
      
      // Nếu không, chọn chất lượng thấp hơn 720p nếu có thể
      if (qualityA <= 720 && qualityB > 720) return -1;
      if (qualityB <= 720 && qualityA > 720) return 1;
      
      // Nếu cả hai đều > 720p hoặc < 720p, chọn cái nhỏ hơn
      return qualityA - qualityB;
    });
    
    const selectedFormat = mp4Formats[0];
    console.log(`Đã chọn định dạng: ${selectedFormat.quality}p, kích thước: ${selectedFormat.size}`);
    
    // Tải video
    console.log(`Đang tải video từ URL: ${selectedFormat.url}`);
    const videoResponse = await axios({
      method: 'get',
      url: selectedFormat.url,
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 60000 // 60 giây timeout
    });
    
    // Ghi file
    console.log(`Đang ghi file tới: ${outputPath}`);
    const writer = fs.createWriteStream(outputPath);
    videoResponse.data.pipe(writer);
    
    return new Promise((resolve, reject) => {
      writer.on('finish', async () => {
        console.log("Tải video hoàn tất, đang lấy thông tin chi tiết");
        try {
          // Lấy thông tin video từ API YouTube
          const infoUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoId}&key=AIzaSyBOei96lHKJJpqbX-oxWLI95MS0pHuM1BA`;
          const infoResponse = await axios.get(infoUrl);
          
          if (infoResponse.data.items && infoResponse.data.items.length > 0) {
            const videoInfo = infoResponse.data.items[0];
            const duration = videoInfo.contentDetails.duration;
            const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
            const hours = parseInt(match[1] || 0);
            const minutes = parseInt(match[2] || 0);
            const seconds = parseInt(match[3] || 0);
            const totalSeconds = hours * 3600 + minutes * 60 + seconds;
            
            resolve({
              title: videoInfo.snippet.title,
              dur: totalSeconds,
              viewCount: videoInfo.statistics.viewCount,
              likes: videoInfo.statistics.likeCount,
              author: videoInfo.snippet.channelTitle,
              publishDate: videoInfo.snippet.publishedAt.split('T')[0],
              quality: selectedFormat.quality,
              size: selectedFormat.size
            });
          } else {
            // Nếu không có thông tin từ API YouTube
            resolve({
              title: response.data.meta?.title || "Video YouTube",
              dur: 0,
              viewCount: "N/A",
              likes: "N/A",
              author: response.data.meta?.source || "YouTube Channel",
              publishDate: "N/A",
              quality: selectedFormat.quality,
              size: selectedFormat.size
            });
          }
        } catch (infoError) {
          console.error("Lỗi khi lấy thông tin video:", infoError.message);
          // Vẫn trả về thông tin cơ bản nếu không lấy được thông tin chi tiết
          resolve({
            title: response.data.meta?.title || "Video YouTube",
            dur: 0,
            viewCount: "N/A",
            likes: "N/A",
            author: response.data.meta?.source || "YouTube Channel",
            publishDate: "N/A",
            quality: selectedFormat.quality,
            size: selectedFormat.size
          });
        }
      });
      
      writer.on('error', (err) => {
        console.error("Lỗi khi ghi file:", err.message);
        fs.unlinkSync(outputPath); // Xóa file nếu tải lỗi
        reject(err);
      });
    });
    
  } catch (error) {
    console.error("Lỗi tải video:", error.message);
    
    // Thử phương pháp thứ hai: y2mate.is
    try {
      console.log("Đang thử phương pháp thứ hai với y2mate.is");
      
      // Bước 1: Phân tích video
      const analyzeUrl = `https://www.y2mate.is/analyze`;
      const analyzePayload = {
        url: `https://www.youtube.com/watch?v=${videoId}`
      };
      
      const analyzeResponse = await axios.post(analyzeUrl, analyzePayload, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      
      if (!analyzeResponse.data || !analyzeResponse.data.formats) {
        throw new Error("API y2mate.is không trả về định dạng video hợp lệ");
      }
      
      console.log("Đã nhận được phản hồi từ y2mate.is, đang tìm định dạng video phù hợp");
      
      // Lọc và tìm định dạng mp4 phù hợp
      const mp4Formats = analyzeResponse.data.formats.filter(format => 
        format.mimeType && format.mimeType.includes('video/mp4') && format.qualityLabel
      );
      
      if (mp4Formats.length === 0) {
        throw new Error("Không tìm thấy định dạng mp4 từ y2mate.is");
      }
      
      // Sắp xếp định dạng, ưu tiên 360p hoặc 720p
      mp4Formats.sort((a, b) => {
        const qualityA = parseInt(a.qualityLabel);
        const qualityB = parseInt(b.qualityLabel);
        
        if (qualityA === 360) return -1;
        if (qualityB === 360) return 1;
        if (qualityA === 720) return -1;
        if (qualityB === 720) return 1;
        
        if (qualityA <= 720 && qualityB > 720) return -1;
        if (qualityB <= 720 && qualityA > 720) return 1;
        
        return qualityA - qualityB;
      });
      
      const selectedFormat = mp4Formats[0];
      console.log(`Đã chọn định dạng từ y2mate.is: ${selectedFormat.qualityLabel}`);
      
      // Bước 2: Lấy link tải xuống
      const convertUrl = `https://www.y2mate.is/convert`;
      const convertPayload = {
        url: `https://www.youtube.com/watch?v=${videoId}`,
        format: selectedFormat.itag.toString()
      };
      
      const convertResponse = await axios.post(convertUrl, convertPayload, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      
      if (!convertResponse.data || !convertResponse.data.url) {
        throw new Error("API y2mate.is không trả về link tải xuống");
      }
      
      console.log(`Đang tải video từ URL y2mate.is: ${convertResponse.data.url}`);
      
      // Tải video
      const videoResponse = await axios({
        method: 'get',
        url: convertResponse.data.url,
        responseType: 'stream',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        timeout: 60000
      });
      
      // Ghi file
      const writer = fs.createWriteStream(outputPath);
      videoResponse.data.pipe(writer);
      
      return new Promise((resolve, reject) => {
        writer.on('finish', async () => {
          console.log("Tải video từ y2mate.is hoàn tất");
          try {
            // Lấy thông tin video từ YouTube API
            const infoUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoId}&key=AIzaSyBOei96lHKJJpqbX-oxWLI95MS0pHuM1BA`;
            const infoResponse = await axios.get(infoUrl);
            
            if (infoResponse.data.items && infoResponse.data.items.length > 0) {
              const videoInfo = infoResponse.data.items[0];
              const duration = videoInfo.contentDetails.duration;
              const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
              const hours = parseInt(match[1] || 0);
              const minutes = parseInt(match[2] || 0);
              const seconds = parseInt(match[3] || 0);
              const totalSeconds = hours * 3600 + minutes * 60 + seconds;
              
              resolve({
                title: videoInfo.snippet.title,
                dur: totalSeconds,
                viewCount: videoInfo.statistics.viewCount,
                likes: videoInfo.statistics.likeCount,
                author: videoInfo.snippet.channelTitle,
                publishDate: videoInfo.snippet.publishedAt.split('T')[0],
                quality: selectedFormat.qualityLabel.replace('p', '')
              });
            } else {
              resolve({
                title: analyzeResponse.data.title || "Video YouTube",
                dur: 0,
                viewCount: "N/A",
                likes: "N/A",
                author: "YouTube Channel",
                publishDate: "N/A",
                quality: selectedFormat.qualityLabel.replace('p', '')
              });
            }
          } catch (infoError) {
            console.error("Lỗi khi lấy thông tin video:", infoError.message);
            resolve({
              title: analyzeResponse.data.title || "Video YouTube",
              dur: 0,
              viewCount: "N/A",
              likes: "N/A",
              author: "YouTube Channel",
              publishDate: "N/A",
              quality: selectedFormat.qualityLabel.replace('p', '')
            });
          }
        });
        
        writer.on('error', (err) => {
          console.error("Lỗi khi ghi file từ y2mate.is:", err.message);
          fs.unlinkSync(outputPath);
          reject(err);
        });
      });
      
    } catch (secondError) {
      console.error("Lỗi phương pháp thứ hai:", secondError.message);
      throw new Error("Không thể tải video. Vui lòng thử lại sau.");
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
      api.sendMessage("⏳ Đang tải video YouTube, vui lòng đợi (có thể mất đến 1-2 phút)...", threadID, messageID);
      
      // Tạo đường dẫn lưu video
      const filePath = path.join(__dirname, "..", "..", "..", "cache", `yt-${Date.now()}.mp4`);
      
      // Kiểm tra thời lượng video trước khi tải (nếu có thể)
      try {
        const videoInfoUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${videoId}&key=AIzaSyBOei96lHKJJpqbX-oxWLI95MS0pHuM1BA`;
        const videoInfoResponse = await axios.get(videoInfoUrl);
        
        if (videoInfoResponse.data.items.length > 0) {
          const duration = videoInfoResponse.data.items[0].contentDetails.duration;
          const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
          const hours = parseInt(match[1] || 0);
          const minutes = parseInt(match[2] || 0);
          const seconds = parseInt(match[3] || 0);
          const totalSeconds = hours * 3600 + minutes * 60 + seconds;
          
          if (totalSeconds > 900) { // Giới hạn 15 phút
            return api.sendMessage("❎ Không thể tải video dài hơn 15 phút.", threadID, messageID);
          }
        }
      } catch (error) {
        // Bỏ qua lỗi kiểm tra thời lượng, vẫn tiếp tục tải
        console.error("Lỗi khi kiểm tra thông tin video:", error.message);
      }
      
      // Tải video bằng API mới
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
      let sizeInfo = data.size ? `\n📦 Kích thước: ${data.size}` : '';
      
      api.sendMessage({
        body: `🎬 Tiêu đề: ${data.title}\n⏱️ Thời lượng: ${formatDuration(data.dur)}\n👁️ Lượt xem: ${formatNumber(data.viewCount)}\n👍 Lượt thích: ${formatNumber(data.likes)}\n👤 Kênh: ${data.author}\n📅 Ngày đăng: ${data.publishDate || "N/A"}${qualityInfo}${sizeInfo}`,
        attachment: fs.createReadStream(filePath)
      }, threadID, () => fs.unlinkSync(filePath), messageID);
      
    } catch (err) {
      console.error("Lỗi tải video:", err);
      return api.sendMessage(`❎ Đã xảy ra lỗi khi tải video YouTube: ${err.message}`, threadID, messageID);
    }
  }
};

module.exports.run = function({ api, event }) {
  // Không cần xử lý vì đây là lệnh noprefix
};
