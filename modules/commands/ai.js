const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

// Kiểm tra thư viện @google/generative-ai đã được cài đặt chưa
let useGemini = false;
let GoogleGenerativeAI;
try {
  GoogleGenerativeAI = require('@google/generative-ai');
  useGemini = true;
} catch (error) {
  console.warn("Thư viện @google/generative-ai không có sẵn, sẽ sử dụng OpenAI API");
}

module.exports.config = {
  name: "ai",
  version: "1.0.1",
  hasPermssion: 0,
  credits: "LunarKrystal",
  description: "Chat với AI (GPT-3.5-turbo hoặc Google Gemini)",
  commandCategory: "Tiện ích",
  usages: "[nội dung cần hỏi]",
  cooldowns: 5,
  dependencies: {
    "axios": "",
    "fs-extra": "",
    "@google/generative-ai": ""
  }
};

// Cấu hình API keys - thay đổi trong file này hoặc tạo file config
const configPath = path.join(__dirname, 'cache', 'ai_config.json');
let config = {
  openaiApiKey: "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", // Thay bằng API key OpenAI của bạn
  geminiApiKey: "AIzaSyC24jumviNdxX3wplx4fQ9PTdMdvmkMHvE", // Thay bằng API key Gemini của bạn
  defaultModel: "openai" // hoặc "openai"
};

// Tạo hoặc đọc file cấu hình
if (fs.existsSync(configPath)) {
  try {
    config = { ...config, ...JSON.parse(fs.readFileSync(configPath, 'utf8')) };
  } catch (error) {
    console.error("Lỗi khi đọc file cấu hình AI:", error);
  }
} else {
  if (!fs.existsSync(path.join(__dirname, 'cache'))) {
    fs.mkdirSync(path.join(__dirname, 'cache'), { recursive: true });
  }
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
}

// Lưu trữ lịch sử chat của mỗi người dùng
const conversationHistory = {};
const HISTORY_LENGTH = 4; // Giữ lại 4 lượt tương tác gần nhất
const MAX_TOKENS = 500; // Giới hạn độ dài câu trả lời

// Hàm xóa lịch sử chat
function clearHistory(userID) {
  if (conversationHistory[userID]) {
    conversationHistory[userID] = [];
    return true;
  }
  return false;
}

// Hàm khởi tạo hoặc lấy lịch sử chat
function getHistory(userID) {
  if (!conversationHistory[userID]) {
    conversationHistory[userID] = [];
  }
  return conversationHistory[userID];
}

// Hàm thêm tin nhắn vào lịch sử
function addToHistory(userID, role, content) {
  const history = getHistory(userID);
  history.push({ role, content });
  
  // Giữ lịch sử chỉ với HISTORY_LENGTH tin nhắn gần nhất
  while (history.length > HISTORY_LENGTH * 2) { // *2 vì mỗi lượt có 2 tin nhắn (user và assistant)
    history.shift();
  }
}

// Hàm truy vấn OpenAI
async function queryOpenAI(userMessage, userID) {
  // Thêm tin nhắn của người dùng vào lịch sử
  addToHistory(userID, "user", userMessage);

  // Chuẩn bị tin nhắn để gửi đến API
  const messages = [
    { role: "system", content: "Bạn là một trợ lý AI thông minh, nhiệt tình và hữu ích. Hãy trả lời một cách chính xác, đầy đủ nhưng ngắn gọn trong khoảng 50-300 từ. Nếu bạn không biết câu trả lời, hãy nói thật là bạn không biết. Bạn được tạo bởi OpenAI." },
    ...getHistory(userID)
  ];

  // Gọi API OpenAI
  const response = await axios.post("https://api.openai.com/v1/chat/completions", {
    model: "gpt-3.5-turbo",
    messages: messages,
    max_tokens: MAX_TOKENS,
    temperature: 0.7,
  }, {
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${config.openaiApiKey}`
    }
  });

  // Lấy câu trả lời
  const aiResponse = response.data.choices[0].message.content.trim();
  
  // Thêm câu trả lời vào lịch sử
  addToHistory(userID, "assistant", aiResponse);
  
  return aiResponse;
}

// Hàm truy vấn Gemini
async function queryGemini(userMessage, userID) {
  // Thêm tin nhắn của người dùng vào lịch sử
  addToHistory(userID, "user", userMessage);

  // Khởi tạo API Gemini
  const genAI = new GoogleGenerativeAI(config.geminiApiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-pro" });

  // Chuẩn bị lịch sử để gửi API
  let chatHistory = getHistory(userID).map(msg => ({
    role: msg.role === "user" ? "user" : "model",
    parts: [{ text: msg.content }]
  }));

  // Tạo chat session
  const chat = model.startChat({
    history: chatHistory.slice(0, -1), // Không bao gồm tin nhắn cuối cùng (sẽ gửi dưới dạng prompt)
    generationConfig: {
      maxOutputTokens: MAX_TOKENS,
      temperature: 0.7,
    },
  });

  // Gửi tin nhắn mới nhất và nhận phản hồi
  const latestMessage = chatHistory[chatHistory.length - 1];
  const result = await chat.sendMessage(latestMessage.parts[0].text);
  const aiResponse = result.response.text();

  // Thêm câu trả lời vào lịch sử
  addToHistory(userID, "assistant", aiResponse);
  
  return aiResponse;
}

module.exports.run = async function({ api, event, args }) {
  const { threadID, messageID, senderID } = event;
  const content = args.join(" ");

  if (!content) {
    return api.sendMessage("Vui lòng nhập nội dung cần hỏi AI!", threadID, messageID);
  }

  // Xử lý lệnh đặc biệt
  if (content.toLowerCase() === "clear") {
    const cleared = clearHistory(senderID);
    return api.sendMessage(cleared ? "Đã xóa lịch sử chat của bạn!" : "Bạn chưa có lịch sử chat nào!", threadID, messageID);
  }
  
  if (content.toLowerCase().startsWith("switch")) {
    const model = content.toLowerCase().replace("switch", "").trim();
    if (model === "openai" || model === "gemini") {
      config.defaultModel = model;
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
      return api.sendMessage(`Đã chuyển sang sử dụng model ${model.toUpperCase()}!`, threadID, messageID);
    } else {
      return api.sendMessage("Model không hợp lệ. Vui lòng chọn 'openai' hoặc 'gemini'!", threadID, messageID);
    }
  }

  // Báo người dùng chờ
  api.sendMessage(`🤖 AI đang xử lý câu hỏi của bạn (sử dụng ${config.defaultModel.toUpperCase()})...`, threadID, messageID);

  try {
    let aiResponse;
    
    // Chọn model để sử dụng
    if (config.defaultModel === "gemini" && useGemini) {
      aiResponse = await queryGemini(content, senderID);
    } else {
      aiResponse = await queryOpenAI(content, senderID);
    }

    // Gửi câu trả lời cho người dùng
    api.sendMessage(`🤖 AI: ${aiResponse}`, threadID, messageID);
  } catch (error) {
    console.error("Lỗi khi truy vấn AI:", error);
    if (error.response) {
      console.error("Response error:", error.response.data);
    }
    api.sendMessage(`❌ Đã xảy ra lỗi khi truy vấn AI (${config.defaultModel}). Vui lòng thử lại sau!`, threadID, messageID);
  }
}; 
