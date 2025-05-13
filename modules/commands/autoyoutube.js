const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

module.exports.config = {
  name: "autodownyoutube",
  version: "1.0.3",
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
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds - (hours * 3600)) / 60);
  const secs = seconds - (hours * 3600) - (minutes * 60);
  
  return `${hours > 0 ? hours + 'h:' : ''}${minutes < 10 && hours > 0 ? '0' : ''}${minutes}m:${secs < 10 ? '0' : ''}${secs}s`;
}

function formatNumber(num) {
  if (!num) return "N/A";
  return num.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
}

// Hàm tải video YouTube sử dụng API đáng tin cậy
async function downloadYouTubeVideo(videoId, outputPath) {
  try {
    // API thứ nhất - yt5s API
    const formData = new URLSearchParams();
    formData.append('q', `https://www.youtube.com/watch?v=${videoId}`);
    formData.append('vt', 'mp4');
    
    const response = await axios.post('https://yt5s.io/api/ajaxSearch', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36'
      }
    });
    
    if (!response.data.links || !response.data.title) {
      throw new Error("Không thể lấy thông tin video từ API 1");
    }
    
    // Tìm định dạng 360p hoặc tương tự
    const formats = Object.values(response.data.links);
    let selectedFormat = null;
    
    for (const format of formats) {
      if (format.q === '360p' || format.q === '720p') {
        selectedFormat = format;
        break;
      }
    }
    
    if (!selectedFormat) {
      selectedFormat = formats[0];
    }
    
    // Lấy link tải xuống
    const vid = response.data.vid;
    const k = selectedFormat.k;
    
    const downloadFormData = new URLSearchParams();
    downloadFormData.append('vid', vid);
    downloadFormData.append('k', k);
    
    const downloadResponse = await axios.post('https://yt5s.io/api/ajaxConvert', downloadFormData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36'
      }
    });
    
    if (!downloadResponse.data.dlink) {
      throw new Error("Không thể lấy link tải xuống từ API 1");
    }
    
    // Tải video
    const videoResponse = await axios({
      method: 'get',
      url: downloadResponse.data.dlink,
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36'
      }
    });
    
    videoResponse.data.pipe(fs.createWriteStream(outputPath));
    
    return new Promise((resolve, reject) => {
      videoResponse.data.on('end', () => {
        // Lấy thông tin video từ YouTube API
        axios.get(`https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoId}&key=AIzaSyBOei96lHKJJpqbX-oxWLI95MS0pHuM1BA`)
          .then(infoResponse => {
            if (infoResponse.data.items && infoResponse.data.items.length > 0) {
              const videoInfo = infoResponse.data.items[0];
              // Chuyển đổi thời lượng từ ISO 8601 sang giây
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
                publishDate: videoInfo.snippet.publishedAt.split('T')[0]
              });
            } else {
              resolve({
                title: response.data.title,
                dur: 0,
                viewCount: "N/A",
                likes: "N/A",
                author: "YouTube Channel",
                publishDate: "N/A"
              });
            }
          })
          .catch(() => {
            // Nếu không lấy được thông tin chi tiết, sử dụng thông tin cơ bản
            resolve({
              title: response.data.title,
              dur: 0,
              viewCount: "N/A",
              likes: "N/A",
              author: "YouTube Channel",
              publishDate: "N/A"
            });
          });
      });
      
      videoResponse.data.on('error', (err) => {
        reject(err);
      });
    });
    
  } catch (error) {
    // API thứ hai - y2mate API
    try {
      // Lấy token từ y2mate
      const initResponse = await axios.get('https://www.y2mate.com/mates/analyzeV2/ajax', {
        params: {
          k_query: `https://www.youtube.com/watch?v=${videoId}`,
          k_page: 'mp4',
          hl: 'en',
          q_auto: '0'
        },
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36'
        }
      });
      
      if (!initResponse.data.links || !initResponse.data.vid) {
        throw new Error("Không thể lấy thông tin video từ API 2");
      }
      
      // Lấy thông tin các định dạng
      const formats = initResponse.data.links.mp4;
      let selectedFormat = null;
      
      // Tìm định dạng 360p hoặc 480p
      for (const key in formats) {
        if (formats[key].q === '360p' || formats[key].q === '480p') {
          selectedFormat = formats[key];
          break;
        }
      }
      
      if (!selectedFormat) {
        // Nếu không có 360p/480p, lấy định dạng đầu tiên
        selectedFormat = Object.values(formats)[0];
      }
      
      // Lấy link tải xuống
      const downloadResponse = await axios.get('https://www.y2mate.com/mates/convertV2/index', {
        params: {
          vid: initResponse.data.vid,
          k: selectedFormat.k
        },
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36'
        }
      });
      
      if (!downloadResponse.data.dlink) {
        throw new Error("Không thể lấy link tải xuống từ API 2");
      }
      
      // Tải video
      const videoResponse = await axios({
        method: 'get',
        url: downloadResponse.data.dlink,
        responseType: 'stream',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36'
        }
      });
      
      videoResponse.data.pipe(fs.createWriteStream(outputPath));
      
      return new Promise((resolve, reject) => {
        videoResponse.data.on('end', () => {
          // Lấy thông tin video từ YouTube API
          axios.get(`https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoId}&key=AIzaSyBOei96lHKJJpqbX-oxWLI95MS0pHuM1BA`)
            .then(infoResponse => {
              if (infoResponse.data.items && infoResponse.data.items.length > 0) {
                const videoInfo = infoResponse.data.items[0];
                // Chuyển đổi thời lượng
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
                  publishDate: videoInfo.snippet.publishedAt.split('T')[0]
                });
              } else {
                resolve({
                  title: initResponse.data.title,
                  dur: 0,
                  viewCount: "N/A",
                  likes: "N/A",
                  author: "YouTube Channel",
                  publishDate: "N/A"
                });
              }
            })
            .catch(() => {
              resolve({
                title: initResponse.data.title,
                dur: 0,
                viewCount: "N/A",
                likes: "N/A",
                author: "YouTube Channel",
                publishDate: "N/A"
              });
            });
        });
        
        videoResponse.data.on('error', (err) => {
          reject(err);
        });
      });
      
    } catch (secondError) {
      // API thứ ba - 9Convert API
      try {
        // Bước 1: Lấy token
        const initResponse = await axios.get(`https://9convert.com/api/ajaxSearch/index`, {
          params: {
            query: `https://www.youtube.com/watch?v=${videoId}`,
            vt: 'home'
          },
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36'
          }
        });
        
        if (!initResponse.data.links || !initResponse.data.title) {
          throw new Error("Không thể lấy thông tin video từ API 3");
        }
        
        // Chọn định dạng 360p hoặc 480p
        const formats = initResponse.data.links;
        let selectedFormat = null;
        
        for (const key in formats) {
          if (formats[key].q === '360p' || formats[key].q === '480p') {
            selectedFormat = formats[key];
            break;
          }
        }
        
        if (!selectedFormat) {
          // Lấy định dạng đầu tiên nếu không có 360p/480p
          selectedFormat = Object.values(formats)[0];
        }
        
        // Bước 2: Lấy link tải xuống
        const downloadResponse = await axios.get(`https://9convert.com/api/ajaxConvert/convert`, {
          params: {
            vid: initResponse.data.vid,
            k: selectedFormat.k
          },
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36'
          }
        });
        
        if (!downloadResponse.data.dlink) {
          throw new Error("Không thể lấy link tải xuống từ API 3");
        }
        
        // Tải video
        const videoResponse = await axios({
          method: 'get',
          url: downloadResponse.data.dlink,
          responseType: 'stream',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36'
          }
        });
        
        videoResponse.data.pipe(fs.createWriteStream(outputPath));
        
        return new Promise((resolve, reject) => {
          videoResponse.data.on('end', () => {
            // Lấy thông tin video từ YouTube API
            axios.get(`https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoId}&key=AIzaSyBOei96lHKJJpqbX-oxWLI95MS0pHuM1BA`)
              .then(infoResponse => {
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
                    publishDate: videoInfo.snippet.publishedAt.split('T')[0]
                  });
                } else {
                  resolve({
                    title: initResponse.data.title,
                    dur: 0,
                    viewCount: "N/A",
                    likes: "N/A",
                    author: "YouTube Channel",
                    publishDate: "N/A"
                  });
                }
              })
              .catch(() => {
                resolve({
                  title: initResponse.data.title,
                  dur: 0,
                  viewCount: "N/A",
                  likes: "N/A",
                  author: "YouTube Channel",
                  publishDate: "N/A"
                });
              });
          });
          
          videoResponse.data.on('error', (err) => {
            reject(err);
          });
        });
        
      } catch (thirdError) {
        throw new Error(`Tất cả các API đều thất bại. Vui lòng thử lại sau!`);
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
      
      // Gửi video
      api.sendMessage({
        body: `🎬 Tiêu đề: ${data.title}\n⏱️ Thời lượng: ${formatDuration(data.dur)}\n👁️ Lượt xem: ${formatNumber(data.viewCount)}\n👍 Lượt thích: ${formatNumber(data.likes)}\n👤 Kênh: ${data.author}\n📅 Ngày đăng: ${data.publishDate || "N/A"}`,
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
