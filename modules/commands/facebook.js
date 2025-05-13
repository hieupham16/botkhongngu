const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const crypto = require("crypto");
const cheerio = require("cheerio");
const FormData = require("form-data");
const tough = require('tough-cookie');
const { CookieJar } = tough;

module.exports.config = {
  name: "autodownfacebook",
  version: "1.8.0",
  hasPermssion: 0,
  credits: "Dương Trân dev & LunarKrystal",
  description: "Tự động tải video từ Facebook (cả video thường và reels) khi phát hiện link",
  commandCategory: "Tiện ích",
  usages: "",
  cooldowns: 5,
  dependencies: {
    "axios": "",
    "fs-extra": "",
    "cheerio": "",
    "form-data": "",
    "tough-cookie": ""
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

// Phương pháp 1: Tải video từ Facebook sử dụng Getmyfb.com
async function downloadWithGetmyfb(url, outputPath) {
  try {
    console.log("Đang tải video với Getmyfb.com");
    const userAgent = getRandomUserAgent();
    
    // Bước 1: Truy cập trang Getmyfb.com
    console.log("Bước 1: Truy cập Getmyfb.com");
    const getmyfbUrl = 'https://getmyfb.com/';
    
    const initialResponse = await axios.get(getmyfbUrl, {
      headers: {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 10000
    });
    
    // Bước 2: Submit URL video vào form
    console.log("Bước 2: Submit URL");
    const formData = new URLSearchParams();
    formData.append('url', url);
    
    const submitResponse = await axios.post(getmyfbUrl, formData, {
      headers: {
        'User-Agent': userAgent,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Origin': 'https://getmyfb.com',
        'Referer': 'https://getmyfb.com/'
      },
      timeout: 30000
    });
    
    // Bước 3: Phân tích kết quả
    console.log("Bước 3: Phân tích kết quả");
    const $ = cheerio.load(submitResponse.data);
    
    // Tìm tiêu đề video
    let videoTitle = $('h2.card-title').text().trim() || "Facebook Video";
    
    // Tìm link tải
    let downloadLink = null;
    let quality = "SD";
    
    // Tìm tất cả các link tải
    $('a.btn-download').each((i, el) => {
      const link = $(el).attr('href');
      const qualityText = $(el).text().trim();
      
      if (link && link.includes('http') && !link.includes('getmyfb.com')) {
        if (qualityText.includes('HD') && !downloadLink) {
          downloadLink = link;
          quality = "HD";
        } else if (!downloadLink) {
          downloadLink = link;
        }
      }
    });
    
    if (!downloadLink) {
      throw new Error("Không tìm thấy link tải từ Getmyfb.com");
    }
    
    console.log(`Đã tìm thấy link tải: ${downloadLink}`);
    
    // Bước 4: Tải video
    console.log("Bước 4: Tải video");
    const videoResponse = await axios({
      method: 'get',
      url: downloadLink,
      responseType: 'arraybuffer',
      timeout: 60000,
      headers: {
        'User-Agent': userAgent,
        'Accept': '*/*',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Referer': 'https://getmyfb.com/'
      }
    });
    
    // Ghi file
    fs.writeFileSync(outputPath, Buffer.from(videoResponse.data));
    console.log("Tải video hoàn tất từ Getmyfb.com");
    
    return {
      success: true,
      title: videoTitle,
      quality: quality
    };
  } catch (error) {
    console.error("Lỗi Getmyfb.com:", error.message);
    throw error;
  }
}

// Phương pháp 2: Tải video từ Facebook sử dụng Fbdownloader.online
async function downloadWithFbDownloader(url, outputPath) {
  try {
    console.log("Đang tải video với Fbdownloader.online");
    const userAgent = getRandomUserAgent();
    
    // Bước 1: Truy cập trang Fbdownloader.online
    console.log("Bước 1: Truy cập Fbdownloader.online");
    const fbDownloaderUrl = 'https://fbdownloader.online/';
    
    // Bước 2: Submit URL video
    console.log("Bước 2: Submit URL");
    const formData = new FormData();
    formData.append('URLz', url);
    
    const submitResponse = await axios.post(`${fbDownloaderUrl}`, formData, {
      headers: {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Origin': 'https://fbdownloader.online',
        'Referer': 'https://fbdownloader.online/',
        ...formData.getHeaders()
      },
      timeout: 30000
    });
    
    // Bước 3: Phân tích kết quả
    console.log("Bước 3: Phân tích kết quả");
    const $ = cheerio.load(submitResponse.data);
    
    // Tìm tiêu đề video
    let videoTitle = $('div.download-links h2').text().trim() || "Facebook Video";
    
    // Tìm link tải
    let downloadLink = null;
    let quality = "SD";
    
    // Tìm tất cả các link tải
    $('a.btn-download').each((i, el) => {
      const link = $(el).attr('href');
      const qualityText = $(el).text().trim();
      
      if (link && link.includes('http') && (link.includes('.mp4') || link.includes('fbcdn.net'))) {
        if ((qualityText.includes('HD') || qualityText.includes('720p')) && !downloadLink) {
          downloadLink = link;
          quality = "HD";
        } else if (!downloadLink) {
          downloadLink = link;
        }
      }
    });
    
    // Nếu không tìm thấy qua class, thử tìm qua thuộc tính
    if (!downloadLink) {
      $('a[download]').each((i, el) => {
        const link = $(el).attr('href');
        if (link && link.includes('http') && !downloadLink) {
          downloadLink = link;
        }
      });
    }
    
    if (!downloadLink) {
      throw new Error("Không tìm thấy link tải từ Fbdownloader.online");
    }
    
    console.log(`Đã tìm thấy link tải: ${downloadLink}`);
    
    // Bước 4: Tải video
    console.log("Bước 4: Tải video");
    const videoResponse = await axios({
      method: 'get',
      url: downloadLink,
      responseType: 'arraybuffer',
      timeout: 60000,
      headers: {
        'User-Agent': userAgent,
        'Accept': '*/*',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Referer': 'https://fbdownloader.online/'
      }
    });
    
    // Ghi file
    fs.writeFileSync(outputPath, Buffer.from(videoResponse.data));
    console.log("Tải video hoàn tất từ Fbdownloader.online");
    
    return {
      success: true,
      title: videoTitle,
      quality: quality
    };
  } catch (error) {
    console.error("Lỗi Fbdownloader.online:", error.message);
    throw error;
  }
}

// Phương pháp 3: Tải video sử dụng Facebook-downloader.tgz.pm
async function downloadWithFacebookDownloader(url, outputPath) {
  try {
    console.log("Đang tải video với Facebook-downloader");
    const userAgent = getRandomUserAgent();
    
    // Bước 1: Truy cập và Submit URL
    console.log("Bước 1: Submit URL");
    const fbDownloaderUrl = 'https://facebook-downloader.tgz.pm/download/facebook';
    
    const response = await axios.get(`${fbDownloaderUrl}`, {
      params: {
        url: url
      },
      headers: {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Referer': 'https://facebook-downloader.tgz.pm/'
      },
      timeout: 30000
    });
    
    // Bước 2: Phân tích kết quả
    console.log("Bước 2: Phân tích kết quả");
    const $ = cheerio.load(response.data);
    
    // Tìm tiêu đề video
    let videoTitle = $('h2.download-title').text().trim() || "Facebook Video";
    
    // Tìm link tải
    let downloadLink = null;
    let quality = "SD";
    
    // Duyệt qua tất cả các nút download
    $('a.download-link').each((i, el) => {
      const link = $(el).attr('href');
      const qualityText = $(el).text().trim();
      
      if (link && link.includes('http')) {
        if (qualityText.includes('HD') && !downloadLink) {
          downloadLink = link;
          quality = "HD";
        } else if (!downloadLink) {
          downloadLink = link;
        }
      }
    });
    
    if (!downloadLink) {
      throw new Error("Không tìm thấy link tải từ Facebook-downloader");
    }
    
    console.log(`Đã tìm thấy link tải: ${downloadLink}`);
    
    // Bước 3: Tải video
    console.log("Bước 3: Tải video");
    const videoResponse = await axios({
      method: 'get',
      url: downloadLink,
      responseType: 'arraybuffer',
      timeout: 60000,
      headers: {
        'User-Agent': userAgent,
        'Accept': '*/*',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Referer': 'https://facebook-downloader.tgz.pm/'
      }
    });
    
    // Ghi file
    fs.writeFileSync(outputPath, Buffer.from(videoResponse.data));
    console.log("Tải video hoàn tất từ Facebook-downloader");
    
    return {
      success: true,
      title: videoTitle,
      quality: quality
    };
  } catch (error) {
    console.error("Lỗi Facebook-downloader:", error.message);
    throw error;
  }
}

// Phương pháp 4: Tải video trực tiếp từ API
async function downloadWithDirectApi(url, outputPath) {
  try {
    console.log("Đang tải video với Direct API");
    const userAgent = getRandomUserAgent();
    
    // Chuẩn bị URL cho API
    const encodedUrl = encodeURIComponent(url);
    
    // Danh sách các API có thể sử dụng
    const apiUrls = [
      `https://ssyoutube.com/api/convert?url=${encodedUrl}`,
      `https://yt5s.io/api/ajaxSearch?q=${encodedUrl}`,
      `https://sssinstagram.com/r/${encodedUrl}`
    ];
    
    // Thử từng API
    for (const apiUrl of apiUrls) {
      try {
        console.log(`Đang thử API: ${apiUrl}`);
        
        const response = await axios.get(apiUrl, {
          headers: {
            'User-Agent': userAgent,
            'Accept': 'application/json',
            'Origin': new URL(apiUrl).origin,
            'Referer': new URL(apiUrl).origin
          },
          timeout: 15000
        });
        
        if (response.data) {
          let downloadLink = null;
          let videoTitle = "Facebook Video";
          
          // Xử lý phản hồi từ API khác nhau
          if (response.data.url || response.data.links || response.data.data) {
            // API ssyoutube.com
            if (response.data.url) {
              downloadLink = response.data.url;
              videoTitle = response.data.title || videoTitle;
            } 
            // API yt5s.io
            else if (response.data.links && response.data.links.mp4) {
              const mp4Links = response.data.links.mp4;
              const qualities = Object.keys(mp4Links);
              
              if (qualities.length > 0) {
                // Ưu tiên 720p, sau đó là chất lượng cao nhất có sẵn
                if (mp4Links['720p']) {
                  downloadLink = mp4Links['720p'].url;
                } else {
                  downloadLink = mp4Links[qualities[0]].url;
                }
              }
              
              videoTitle = response.data.title || videoTitle;
            }
            // API sssinstagram.com
            else if (response.data.data && response.data.data.length > 0) {
              for (const item of response.data.data) {
                if (item.url && (item.type === 'video' || item.type === 'mp4')) {
                  downloadLink = item.url;
                  break;
                }
              }
              
              videoTitle = response.data.title || videoTitle;
            }
            
            if (downloadLink) {
              console.log(`Đã tìm thấy link tải: ${downloadLink}`);
              
              // Tải video
              console.log("Đang tải video từ API");
              const videoResponse = await axios({
                method: 'get',
                url: downloadLink,
                responseType: 'arraybuffer',
                timeout: 60000,
                headers: {
                  'User-Agent': userAgent,
                  'Accept': '*/*',
                  'Accept-Encoding': 'gzip, deflate, br',
                  'Connection': 'keep-alive',
                  'Referer': new URL(apiUrl).origin
                }
              });
              
              // Ghi file
              fs.writeFileSync(outputPath, Buffer.from(videoResponse.data));
              console.log("Tải video hoàn tất từ Direct API");
              
              return {
                success: true,
                title: videoTitle,
                quality: 'HD'
              };
            }
          }
        }
      } catch (apiError) {
        console.log(`Lỗi với API ${apiUrl}: ${apiError.message}`);
        // Tiếp tục thử API khác
      }
    }
    
    throw new Error("Không thể tải video từ tất cả các API");
  } catch (error) {
    console.error("Lỗi Direct API:", error.message);
    throw error;
  }
}

// Phương pháp 5: Tải video sử dụng FSave.net
async function downloadWithFSave(url, outputPath) {
  try {
    console.log("Đang tải video với FSave.net");
    const userAgent = getRandomUserAgent();
    const cookieJar = new CookieJar();
    
    // Cấu hình axios với cookieJar
    const axiosInstance = axios.create({
      headers: {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      timeout: 30000
    });
    
    // Hàm giả lập lưu và gửi cookie
    axiosInstance.interceptors.request.use(async (config) => {
      const cookies = await cookieJar.getCookieString(config.url);
      if (cookies) {
        config.headers.Cookie = cookies;
      }
      return config;
    });
    
    axiosInstance.interceptors.response.use(async (response) => {
      const cookies = response.headers['set-cookie'];
      if (cookies) {
        cookies.forEach(async (cookie) => {
          await cookieJar.setCookie(cookie, response.config.url);
        });
      }
      return response;
    });
    
    // Bước 1: Truy cập trang chủ FSave.net để lấy cookie và token
    console.log("Bước 1: Truy cập FSave.net");
    const fsaveUrl = 'https://fsave.net/';
    
    const initialResponse = await axiosInstance.get(fsaveUrl);
    const $ = cheerio.load(initialResponse.data);
    
    // Tìm CSRF token
    const csrfToken = $('meta[name="csrf-token"]').attr('content');
    if (!csrfToken) {
      console.log("Không tìm thấy CSRF token, HTML trả về:", initialResponse.data);
      throw new Error("Không tìm thấy CSRF token từ FSave.net");
    }
    
    console.log(`CSRF Token: ${csrfToken}`);
    
    // Bước 2: Gửi request đến API để phân tích video
    console.log("Bước 2: Gửi request đến API");
    
    const formData = new FormData();
    formData.append('url', url);
    formData.append('_token', csrfToken);
    
    const submitResponse = await axiosInstance.post(`${fsaveUrl}download`, formData, {
      headers: {
        ...formData.getHeaders(),
        'X-CSRF-TOKEN': csrfToken,
        'X-Requested-With': 'XMLHttpRequest',
        'Origin': 'https://fsave.net',
        'Referer': 'https://fsave.net/'
      }
    });
    
    if (!submitResponse.data || !submitResponse.data.html) {
      console.log("Dữ liệu phản hồi không hợp lệ:", submitResponse.data);
      throw new Error("Không nhận được dữ liệu hợp lệ từ FSave.net");
    }
    
    // Bước 3: Phân tích HTML kết quả để tìm link tải
    console.log("Bước 3: Phân tích HTML kết quả");
    const resultHtml = submitResponse.data.html;
    const result$ = cheerio.load(resultHtml);
    
    // Tìm tiêu đề video
    let videoTitle = result$('.download-title').text().trim() || "Facebook Video";
    
    // Tìm tất cả các link tải
    let downloadLink = null;
    let quality = "SD";
    
    result$('.download-links a').each((i, el) => {
      const link = result$(el).attr('href');
      const qualityText = result$(el).text().trim();
      
      if (link && link.includes('http')) {
        if ((qualityText.includes('HD') || qualityText.includes('720p')) && !downloadLink) {
          downloadLink = link;
          quality = "HD";
        } else if (!downloadLink) {
          downloadLink = link;
        }
      }
    });
    
    if (!downloadLink) {
      throw new Error("Không tìm thấy link tải từ FSave.net");
    }
    
    console.log(`Đã tìm thấy link tải: ${downloadLink}`);
    
    // Bước 4: Tải video
    console.log("Bước 4: Tải video");
    const videoResponse = await axiosInstance({
      method: 'get',
      url: downloadLink,
      responseType: 'arraybuffer',
      timeout: 60000,
      headers: {
        'Referer': 'https://fsave.net/'
      }
    });
    
    // Ghi file
    fs.writeFileSync(outputPath, Buffer.from(videoResponse.data));
    console.log("Tải video hoàn tất từ FSave.net");
    
    return {
      success: true,
      title: videoTitle,
      quality: quality
    };
  } catch (error) {
    console.error("Lỗi FSave.net:", error.message);
    throw error;
  }
}

// Phương pháp 6: Sử dụng SaveAs.co API
async function downloadWithSaveAs(url, outputPath) {
  try {
    console.log("Đang tải video với SaveAs.co");
    const userAgent = getRandomUserAgent();
    
    // Bước 1: Gửi URL đến API
    console.log("Bước 1: Gửi URL đến API");
    const apiUrl = 'https://api.saveas.co/download';
    
    const payload = {
      url: url
    };
    
    const response = await axios.post(apiUrl, payload, {
      headers: {
        'User-Agent': userAgent,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Origin': 'https://saveas.co',
        'Referer': 'https://saveas.co/'
      },
      timeout: 30000
    });
    
    if (!response.data || !response.data.url) {
      console.log("Dữ liệu phản hồi không hợp lệ:", response.data);
      throw new Error("Không nhận được link tải từ SaveAs.co");
    }
    
    const downloadLink = response.data.url;
    const videoTitle = response.data.title || "Facebook Video";
    
    console.log(`Đã tìm thấy link tải: ${downloadLink}`);
    
    // Bước 2: Tải video
    console.log("Bước 2: Tải video");
    const videoResponse = await axios({
      method: 'get',
      url: downloadLink,
      responseType: 'arraybuffer',
      timeout: 60000,
      headers: {
        'User-Agent': userAgent,
        'Accept': '*/*',
        'Referer': 'https://saveas.co/'
      }
    });
    
    // Ghi file
    fs.writeFileSync(outputPath, Buffer.from(videoResponse.data));
    console.log("Tải video hoàn tất từ SaveAs.co");
    
    return {
      success: true,
      title: videoTitle,
      quality: "HD"
    };
  } catch (error) {
    console.error("Lỗi SaveAs.co:", error.message);
    throw error;
  }
}

// Phương pháp 7: Sử dụng SnipDL.com
async function downloadWithSnipDL(url, outputPath) {
  try {
    console.log("Đang tải video với SnipDL.com");
    const userAgent = getRandomUserAgent();
    const cookieJar = new CookieJar();
    
    // Cấu hình axios với cookieJar
    const axiosInstance = axios.create({
      headers: {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      timeout: 30000
    });
    
    // Hàm giả lập lưu và gửi cookie
    axiosInstance.interceptors.request.use(async (config) => {
      const cookies = await cookieJar.getCookieString(config.url);
      if (cookies) {
        config.headers.Cookie = cookies;
      }
      return config;
    });
    
    axiosInstance.interceptors.response.use(async (response) => {
      const cookies = response.headers['set-cookie'];
      if (cookies) {
        cookies.forEach(async (cookie) => {
          await cookieJar.setCookie(cookie, response.config.url);
        });
      }
      return response;
    });
    
    // Bước 1: Truy cập trang chủ SnipDL.com để lấy cookie
    console.log("Bước 1: Truy cập SnipDL.com");
    const snipdlUrl = 'https://snipdl.com/';
    
    const initialResponse = await axiosInstance.get(snipdlUrl);
    const $ = cheerio.load(initialResponse.data);
    
    // Tìm CSRF token nếu có
    const csrfToken = $('meta[name="csrf-token"]').attr('content') || '';
    
    // Bước 2: Submit URL video
    console.log("Bước 2: Submit URL");
    const formData = new FormData();
    formData.append('url', url);
    
    if (csrfToken) {
      formData.append('_token', csrfToken);
    }
    
    const submitResponse = await axiosInstance.post(`${snipdlUrl}parse-url`, formData, {
      headers: {
        ...formData.getHeaders(),
        'X-Requested-With': 'XMLHttpRequest',
        'Origin': 'https://snipdl.com',
        'Referer': 'https://snipdl.com/'
      }
    });
    
    if (!submitResponse.data || !submitResponse.data.links) {
      console.log("Dữ liệu phản hồi không hợp lệ:", submitResponse.data);
      throw new Error("Không nhận được dữ liệu hợp lệ từ SnipDL.com");
    }
    
    // Bước 3: Tìm link tải video chất lượng cao nhất
    console.log("Bước 3: Tìm link tải");
    const links = submitResponse.data.links;
    let downloadLink = null;
    let quality = "SD";
    let videoTitle = submitResponse.data.title || "Facebook Video";
    
    // Tìm link chất lượng cao nhất
    if (Array.isArray(links) && links.length > 0) {
      // Ưu tiên HD hoặc chất lượng cao nhất
      for (const link of links) {
        if (link.quality && (link.quality.includes('HD') || link.quality.includes('720') || link.quality.includes('1080'))) {
          downloadLink = link.url;
          quality = link.quality;
          break;
        }
      }
      
      // Nếu không có link HD, lấy link đầu tiên
      if (!downloadLink && links[0].url) {
        downloadLink = links[0].url;
        quality = links[0].quality || "SD";
      }
    }
    
    if (!downloadLink) {
      throw new Error("Không tìm thấy link tải từ SnipDL.com");
    }
    
    console.log(`Đã tìm thấy link tải: ${downloadLink}`);
    console.log(`Chất lượng: ${quality}`);
    
    // Bước 4: Tải video
    console.log("Bước 4: Tải video");
    const videoResponse = await axiosInstance({
      method: 'get',
      url: downloadLink,
      responseType: 'arraybuffer',
      timeout: 60000,
      headers: {
        'Referer': 'https://snipdl.com/'
      }
    });
    
    // Ghi file
    fs.writeFileSync(outputPath, Buffer.from(videoResponse.data));
    console.log("Tải video hoàn tất từ SnipDL.com");
    
    return {
      success: true,
      title: videoTitle,
      quality: quality
    };
  } catch (error) {
    console.error("Lỗi SnipDL.com:", error.message);
    throw error;
  }
}

// Phương pháp 8: Sử dụng FBVideos.cc
async function downloadWithFBVideos(url, outputPath) {
  try {
    console.log("Đang tải video với FBVideos.cc");
    const userAgent = getRandomUserAgent();
    
    // Bước 1: Truy cập và gửi URL
    console.log("Bước 1: Submit URL");
    const encodedUrl = encodeURIComponent(url);
    const apiUrl = `https://fbvideos.cc/api/ja-jp/process-video?url=${encodedUrl}`;
    
    const response = await axios.get(apiUrl, {
      headers: {
        'User-Agent': userAgent,
        'Accept': 'application/json',
        'Referer': 'https://fbvideos.cc/',
        'Origin': 'https://fbvideos.cc'
      },
      timeout: 30000
    });
    
    if (!response.data || !response.data.links) {
      console.log("Dữ liệu phản hồi không hợp lệ:", response.data);
      throw new Error("Không nhận được link tải từ FBVideos.cc");
    }
    
    // Bước 2: Tìm link tải chất lượng cao nhất
    console.log("Bước 2: Tìm link tải");
    const links = response.data.links;
    let downloadLink = null;
    let quality = "SD";
    let videoTitle = response.data.title || "Facebook Video";
    
    // Tìm link HD trước
    if (links.hd && links.hd.url) {
      downloadLink = links.hd.url;
      quality = "HD";
    } 
    // Nếu không có, tìm link SD
    else if (links.sd && links.sd.url) {
      downloadLink = links.sd.url;
      quality = "SD";
    }
    
    if (!downloadLink) {
      throw new Error("Không tìm thấy link tải từ FBVideos.cc");
    }
    
    console.log(`Đã tìm thấy link tải: ${downloadLink}`);
    console.log(`Chất lượng: ${quality}`);
    
    // Bước 3: Tải video
    console.log("Bước 3: Tải video");
    const videoResponse = await axios({
      method: 'get',
      url: downloadLink,
      responseType: 'arraybuffer',
      timeout: 60000,
      headers: {
        'User-Agent': userAgent,
        'Accept': '*/*',
        'Referer': 'https://fbvideos.cc/'
      }
    });
    
    // Ghi file
    fs.writeFileSync(outputPath, Buffer.from(videoResponse.data));
    console.log("Tải video hoàn tất từ FBVideos.cc");
    
    return {
      success: true,
      title: videoTitle,
      quality: quality
    };
  } catch (error) {
    console.error("Lỗi FBVideos.cc:", error.message);
    throw error;
  }
}

// Hàm tổng hợp tải video Facebook sử dụng nhiều phương pháp dự phòng
async function downloadFacebookVideo(videoUrl, outputPath) {
  let errors = [];
  
  // Làm sạch URL và thêm 'https://' nếu cần
  let processedUrl = videoUrl.trim();
  if (!processedUrl.startsWith('http')) {
    processedUrl = 'https://' + processedUrl;
  }
  
  // Đảm bảo URL hợp lệ
  try {
    new URL(processedUrl);
  } catch (e) {
    throw new Error(`URL không hợp lệ: ${e.message}`);
  }
  
  console.log(`URL được xử lý: ${processedUrl}`);
  
  // Thử từng phương pháp, bắt đầu từ các phương pháp mới nhất
  
  // Phương pháp 7: SnipDL.com
  try {
    console.log("Phương pháp 7: SnipDL.com");
    return await downloadWithSnipDL(processedUrl, outputPath);
  } catch (error) {
    console.log("Phương pháp 7 thất bại:", error.message);
    errors.push(`SnipDL.com: ${error.message}`);
  }
  
  // Phương pháp 8: FBVideos.cc
  try {
    console.log("Phương pháp 8: FBVideos.cc");
    return await downloadWithFBVideos(processedUrl, outputPath);
  } catch (error) {
    console.log("Phương pháp 8 thất bại:", error.message);
    errors.push(`FBVideos.cc: ${error.message}`);
  }
  
  // Phương pháp 5: FSave.net
  try {
    console.log("Phương pháp 5: FSave.net");
    return await downloadWithFSave(processedUrl, outputPath);
  } catch (error) {
    console.log("Phương pháp 5 thất bại:", error.message);
    errors.push(`FSave.net: ${error.message}`);
  }
  
  // Phương pháp 6: SaveAs.co
  try {
    console.log("Phương pháp 6: SaveAs.co");
    return await downloadWithSaveAs(processedUrl, outputPath);
  } catch (error) {
    console.log("Phương pháp 6 thất bại:", error.message);
    errors.push(`SaveAs.co: ${error.message}`);
  }
  
  // Phương pháp 1: Getmyfb.com
  try {
    console.log("Phương pháp 1: Getmyfb.com");
    return await downloadWithGetmyfb(processedUrl, outputPath);
  } catch (error) {
    console.log("Phương pháp 1 thất bại:", error.message);
    errors.push(`Getmyfb.com: ${error.message}`);
  }
  
  // Phương pháp 2: Fbdownloader.online
  try {
    console.log("Phương pháp 2: Fbdownloader.online");
    return await downloadWithFbDownloader(processedUrl, outputPath);
  } catch (error) {
    console.log("Phương pháp 2 thất bại:", error.message);
    errors.push(`Fbdownloader.online: ${error.message}`);
  }
  
  // Phương pháp 3: Facebook-downloader
  try {
    console.log("Phương pháp 3: Facebook-downloader");
    return await downloadWithFacebookDownloader(processedUrl, outputPath);
  } catch (error) {
    console.log("Phương pháp 3 thất bại:", error.message);
    errors.push(`Facebook-downloader: ${error.message}`);
  }
  
  // Phương pháp 4: Direct API
  try {
    console.log("Phương pháp 4: Direct API");
    return await downloadWithDirectApi(processedUrl, outputPath);
  } catch (error) {
    console.log("Phương pháp 4 thất bại:", error.message);
    errors.push(`Direct API: ${error.message}`);
  }
  
  // Nếu tất cả các phương pháp đều thất bại, ném lỗi tổng hợp
  throw new Error(`Không thể tải video Facebook sau khi thử tất cả các phương pháp. Chi tiết lỗi: ${errors.join(', ')}`);
}

module.exports.handleEvent = async function({ api, event }) {
  const { threadID, messageID, body } = event;
  
  // Regex được cải tiến để bắt tất cả các loại link Facebook (video thường và reels)
  // Thêm group capture để dễ dàng debug
  const fbRegex = /(?:https?:\/\/)?(?:www\.|web\.|m\.)?(?:facebook\.com|fb\.watch|fb\.com)\/(?:(?:watch\/?\?v=|reel\/|share\/v\/|watch\/|story\.php\?story_fbid=|[^\/]+\/videos\/|video\.php\?v=|[^\/]+\/reels\/|reels\/|watch\?v=|posts\/|sharer\/sharer\.php\?u=)([^\s&\/\?]+))/i;
  
  // Debug: In ra toàn bộ tin nhắn để kiểm tra
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
      
      // Đặt timeout dài hơn cho toàn bộ quá trình tải
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Quá thời gian tải video (3 phút)")), 3 * 60 * 1000);
      });
      
      // Tải video với timeout
      const downloadPromise = downloadFacebookVideo(fbLink, filePath);
      
      // Race giữa timeout và download
      const result = await Promise.race([downloadPromise, timeoutPromise]);
      
      console.log("Tải video thành công");
      
      // Kiểm tra kích thước file trước khi gửi
      const fileStats = fs.statSync(filePath);
      const fileSizeMB = fileStats.size / (1024 * 1024);
      
      console.log(`Kích thước file: ${fileSizeMB.toFixed(2)}MB`);
      
      if (fileSizeMB > 25) {
        fs.unlinkSync(filePath);
        return api.sendMessage(`❎ Video có kích thước quá lớn (${fileSizeMB.toFixed(2)}MB) để gửi. Giới hạn là 25MB.`, threadID, messageID);
      }
      
      if (fileSizeMB < 0.1) {
        fs.unlinkSync(filePath);
        return api.sendMessage(`❎ File tải về quá nhỏ (${fileSizeMB.toFixed(2)}MB), có thể đã xảy ra lỗi. Vui lòng thử lại sau.`, threadID, messageID);
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
      
      // Xử lý các loại lỗi cụ thể
      let errorMessage = `❎ Đã xảy ra lỗi khi tải video Facebook: `;
      
      if (err.message.includes("timeout") || err.message.includes("Quá thời gian")) {
        errorMessage += "Quá thời gian tải video. Vui lòng thử lại sau.";
      } 
      else if (err.message.includes("403")) {
        errorMessage += "Máy chủ từ chối truy cập (lỗi 403). Có thể video này được bảo vệ.";
      }
      else if (err.message.includes("404")) {
        errorMessage += "Không tìm thấy video (lỗi 404). Video có thể đã bị xóa hoặc được đặt ở chế độ riêng tư.";
      }
      else if (err.message.includes("không hợp lệ")) {
        errorMessage += "Link video không hợp lệ hoặc không được hỗ trợ.";
      }
      else if (err.message.includes("CSRF") || err.message.includes("token")) {
        errorMessage += "Lỗi xác thực với máy chủ tải video. Vui lòng thử lại sau.";
      }
      else if (err.message.includes("không nhận được") || err.message.includes("không tìm thấy link")) {
        errorMessage += "Không thể trích xuất link video. Video này có thể được bảo vệ hoặc chỉ có thể xem trực tiếp trên Facebook.";
      }
      else {
        // Giới hạn thông báo lỗi để tránh quá dài
        const shortError = err.message.length > 100 ? err.message.substring(0, 100) + "..." : err.message;
        errorMessage += `${shortError}. Vui lòng thử lại sau hoặc thử video khác.`;
      }
      
      return api.sendMessage(errorMessage, threadID, messageID);
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
