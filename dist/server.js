"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const multer = require("multer");
const axios_1 = __importDefault(require("axios"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const readline = __importStar(require("readline"));
require("dotenv/config");
const intentMap_js_1 = require("./utils/intentMap.js");
const prompts_js_1 = require("./utils/prompts.js");
const app = express();
const upload = multer({ dest: "uploads/" });
const memoryDir = "./memory";
const ttsDir = "./tts_output";
if (!fs.existsSync(memoryDir))
    fs.mkdirSync(memoryDir);
if (!fs.existsSync(ttsDir))
    fs.mkdirSync(ttsDir);
app.use("/tts_output", express.static("tts_output"));
app.use(express.json());
const API_KEY = process.env.VSA_API_KEY;
const isLocalhost = process.env.NODE_ENV !== "production";
const serverUrl = isLocalhost ? "http://localhost:3000" : "https://vsa.fly.dev";
const port = 3000;
// 🔐 API Key Authentication
const authMiddleware = (req, res, next) => {
    const clientKey = req.headers["x-api-key"];
    if (!clientKey || clientKey !== API_KEY) {
        res.status(403).json({
            inputText: "",
            intent: "forbidden",
            action: "idle",
            responseText: "Access denied.",
            audioUrl: "",
        });
        return;
    }
    next();
};
app.use(authMiddleware);
// 🎙️ STT - Wit.ai
async function transcribeWithWit(audioPath) {
    const audioStream = fs.createReadStream(audioPath);
    const response = await axios_1.default.post("https://api.wit.ai/speech?v=20230228", audioStream, {
        headers: {
            Authorization: `Bearer ${process.env.WIT_AI_TOKEN}`,
            "Content-Type": "audio/wav",
            "Transfer-Encoding": "chunked",
        },
        responseType: "stream",
    });
    const rl = readline.createInterface({ input: response.data });
    return new Promise((resolve, reject) => {
        let bufferLines = [], braceCount = 0;
        let finalText = "", finalIntent = "unknown", entities = {};
        rl.on("line", (line) => {
            if (!line.trim())
                return;
            bufferLines.push(line);
            const open = (line.match(/{/g) || []).length;
            const close = (line.match(/}/g) || []).length;
            braceCount += open - close;
            if (braceCount === 0) {
                const jsonStr = bufferLines.join("\n");
                try {
                    const json = JSON.parse(jsonStr);
                    if (json.is_final) {
                        finalText = json.text || "";
                        finalIntent = json.intents?.[0]?.name || "unknown";
                        entities = json.entities || {};
                    }
                }
                catch { }
                bufferLines = [];
            }
        });
        rl.on("close", () => resolve({ text: finalText, intent: finalIntent, entities }));
        rl.on("error", reject);
    });
}
// 💬 Text Intent Analysis
async function analyzeTextIntent(inputText) {
    try {
        const response = await axios_1.default.get("https://api.wit.ai/message", {
            params: { v: "20230228", q: inputText },
            headers: {
                Authorization: `Bearer ${process.env.WIT_AI_TOKEN}`,
                "Content-Type": "application/json",
            },
        });
        const data = response.data;
        return {
            text: data.text || inputText,
            intent: data.intents?.[0]?.name || "unknown",
            entities: data.entities || {},
        };
    }
    catch (error) {
        console.error("Error analyzing text intent:", error);
        return {
            text: inputText,
            intent: "unknown",
            entities: {},
        };
    }
}
// 🧠 Memory Load/Save
function loadUserMemory(userId) {
    const memoryPath = path.join(memoryDir, `${userId}.json`);
    return fs.existsSync(memoryPath)
        ? JSON.parse(fs.readFileSync(memoryPath, "utf-8"))
        : { history: [] };
}
function saveUserMemory(userId, memory) {
    const memoryPath = path.join(memoryDir, `${userId}.json`);
    fs.writeFileSync(memoryPath, JSON.stringify(memory, null, 2));
}
// 💬 Update Conversation Memory
function updateConversationMemory(userId, userInput, aiResponse, userName) {
    const memory = loadUserMemory(userId);
    memory.history.push(`User: ${userInput}`);
    memory.history.push(`Buddy: ${aiResponse}`);
    if (userName) {
        memory.userName = userName;
    }
    if (memory.history.length > 20) {
        memory.history = memory.history.slice(-20);
    }
    saveUserMemory(userId, memory);
}
// 🤖 LLM Response Generation
async function generateTextAndAction(userInput, memory = []) {
    const prompt = (0, prompts_js_1.buildPrompt)(memory, userInput);
    const res = await axios_1.default.post("https://api.openai.com/v1/chat/completions", {
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
    }, {
        headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            "Content-Type": "application/json",
        },
    });
    try {
        const parsed = JSON.parse(res.data.choices[0].message.content);
        return {
            responseText: parsed.responseText || "",
            action: parsed.action || "idle",
        };
    }
    catch {
        return {
            responseText: "Sorry, I didn't get that.",
            action: "idle",
        };
    }
}
// 🔊 Speech Synthesis
async function synthesizeSpeech(text) {
    const res = await axios_1.default.post("https://api.openai.com/v1/audio/speech", {
        model: "tts-1",
        voice: "nova",
        input: text,
    }, {
        headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            "Content-Type": "application/json",
        },
        responseType: "arraybuffer",
    });
    const filename = `tts_${Date.now()}.mp3`;
    const filePath = path.join(ttsDir, filename);
    fs.writeFileSync(filePath, res.data);
    return `/tts_output/${filename}`;
}
// 🔍 Filter Meaningless Input
function isMeaninglessInput(input) {
    const set = new Set([
        "",
        "ah",
        "umm",
        "uh",
        "hmm",
        "hm",
        "mhm",
        "mm",
        "oh",
        "okay",
        "alright",
    ]);
    const normalized = input.toLowerCase().trim();
    return (set.has(normalized) ||
        normalized.length <= 2 ||
        (normalized.split(/\s+/).length === 1 && normalized.length < 4));
}
// 🔄 Mode Transition Handler
function handleModeTransition(currentMode, intent) {
    switch (currentMode) {
        case "pet":
            if (intent === "start_chat")
                return "chat";
            if (intent === "start_math_game")
                return "math_game";
            break;
        case "math_game":
            if (intent === "end_math_game")
                return "pet";
            break;
        case "chat":
            if (intent === "end_chat")
                return "pet";
            break;
    }
    return currentMode;
}
// 🧠 Interaction Endpoint (/speech)
const speechHandler = async (req, res) => {
    const audioReq = req;
    const userId = audioReq.body.userId || "default";
    const skipTTS = audioReq.body.skipTTS === "true";
    const isAudio = !!audioReq.file;
    const mode = audioReq.body.mode || "pet";
    let inputText = "";
    let intent = "unknown";
    let entities = {};
    let action = "idle";
    let responseText = "";
    let audioUrl = "";
    let nextMode = mode;
    try {
        if (isAudio && audioReq.file) {
            const audioPath = audioReq.file.path;
            const result = await transcribeWithWit(audioPath);
            inputText = result.text || "";
            intent = result.intent || "unknown";
            entities = result.entities || {};
            fs.unlinkSync(audioPath);
        }
        else {
            inputText = audioReq.body.inputText || "";
            if (inputText.trim() === "") {
                res.status(400).json({
                    inputText: "",
                    intent: "invalid",
                    action: "idle",
                    responseText: "You didn't say anything.",
                    audioUrl: "",
                    nextMode: mode,
                });
                return;
            }
            const result = await analyzeTextIntent(inputText);
            intent = result.intent;
            entities = result.entities;
        }
        // Handle different modes
        switch (mode) {
            case "pet":
                if (intentMap_js_1.petIntentToActionsMap[intent]) {
                    action =
                        intentMap_js_1.petIntentToActionsMap[intent];
                    // Generate response only for start_chat intent
                    if (intent === "start_chat") {
                        const memory = loadUserMemory(userId);
                        const result = await generateTextAndAction(inputText, memory.history);
                        responseText = result.responseText;
                        updateConversationMemory(userId, inputText, responseText);
                    }
                }
                else {
                    intent = "ignored";
                }
                break;
            case "math_game":
                if (intentMap_js_1.mathGameIntentToActionsMap[intent]) {
                    action =
                        intentMap_js_1.mathGameIntentToActionsMap[intent];
                }
                else {
                    intent = "ignored";
                }
                break;
            case "chat":
                if (intentMap_js_1.chatIntentToActionsMap[intent]) {
                    action =
                        intentMap_js_1.chatIntentToActionsMap[intent];
                }
                else if (!isMeaninglessInput(inputText)) {
                    const memory = loadUserMemory(userId);
                    // Check if the input is asking for the user's name
                    if (intent === "incorrect_answer" &&
                        inputText.toLowerCase().includes("name")) {
                        if (memory.userName) {
                            responseText = `Yes, I remember! Your name is ${memory.userName}.`;
                        }
                        else {
                            responseText =
                                "I'm sorry, I don't know your name yet. Could you please tell me your name?";
                        }
                        action = "idle";
                    }
                    else {
                        const result = await generateTextAndAction(inputText, memory.history);
                        responseText = result.responseText;
                        action = result.action;
                    }
                    updateConversationMemory(userId, inputText, responseText);
                }
                else {
                    intent = "ignored";
                }
                break;
        }
        // Handle mode transition
        nextMode = handleModeTransition(mode, intent);
        if (!skipTTS && responseText) {
            const url = await synthesizeSpeech(responseText);
            audioUrl = `${serverUrl}${url}`;
        }
        res.json({
            inputText,
            intent,
            action,
            responseText,
            audioUrl,
            nextMode,
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({
            inputText: inputText || "",
            intent: intent || "error",
            action: "idle",
            responseText: "Something went wrong.",
            audioUrl: "",
            nextMode: mode,
        });
    }
};
app.post("/speech", upload.single("audio"), speechHandler);
app.listen(port, () => {
    console.log(`🚀 Server running at ${serverUrl}`);
});
