import express = require("express");
import type {
  Express,
  Request,
  Response,
  NextFunction,
  RequestHandler,
} from "express";
import multer = require("multer");
import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import "dotenv/config";

import { dogActionList } from "./utils/dogActions.js";
import {
  petIntentToActionsMap,
  mathGameIntentToActionsMap,
  chatIntentToActionsMap,
} from "./utils/intentMap.js";
import { buildPrompt } from "./utils/prompts.js";

// Types
type Mode = "pet" | "math_game" | "chat";

interface UserMemory {
  history: string[];
}

interface TranscriptionResult {
  text: string;
  intent: string;
  entities: Record<string, any>;
}

interface LLMResponse {
  responseText: string;
  action: string;
}

interface ApiResponse {
  inputText: string;
  intent: string;
  action: string;
  responseText: string;
  audioUrl: string;
}

interface AudioRequest extends Request {
  file?: any;
  body: {
    userId?: string;
    mode?: Mode;
    skipTTS?: string;
    inputText?: string;
  };
}

type IntentToActionMap = {
  [key: string]: string;
};

const app: Express = express();
const upload = multer({ dest: "uploads/" });
const memoryDir = "./memory";
const ttsDir = "./tts_output";
if (!fs.existsSync(memoryDir)) fs.mkdirSync(memoryDir);
if (!fs.existsSync(ttsDir)) fs.mkdirSync(ttsDir);

app.use("/tts_output", express.static("tts_output"));
app.use(express.json());

const API_KEY = process.env.VSA_API_KEY;
const isLocalhost = process.env.NODE_ENV !== "production";
const serverUrl = isLocalhost ? "http://localhost:3000" : "https://vsa.fly.dev";
const port = 3000;

// 🔐 API Key Authentication
const authMiddleware: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
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
async function transcribeWithWit(
  audioPath: string
): Promise<TranscriptionResult> {
  const audioStream = fs.createReadStream(audioPath);
  const response = await axios.post(
    "https://api.wit.ai/speech?v=20230228",
    audioStream,
    {
      headers: {
        Authorization: `Bearer ${process.env.WIT_AI_TOKEN}`,
        "Content-Type": "audio/wav",
        "Transfer-Encoding": "chunked",
      },
      responseType: "stream",
    }
  );

  const rl = readline.createInterface({ input: response.data });
  return new Promise((resolve, reject) => {
    let bufferLines: string[] = [],
      braceCount = 0;
    let finalText = "",
      finalIntent = "unknown",
      entities: Record<string, any> = {};

    rl.on("line", (line: string) => {
      if (!line.trim()) return;
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
        } catch {}
        bufferLines = [];
      }
    });

    rl.on("close", () =>
      resolve({ text: finalText, intent: finalIntent, entities })
    );
    rl.on("error", reject);
  });
}

// 💬 Text Intent Analysis
async function analyzeTextIntent(
  inputText: string
): Promise<TranscriptionResult> {
  try {
    const response = await axios.get("https://api.wit.ai/message", {
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
  } catch (error) {
    console.error("Error analyzing text intent:", error);
    return {
      text: inputText,
      intent: "unknown",
      entities: {},
    };
  }
}

// 🧠 Memory Load/Save
function loadUserMemory(userId: string): UserMemory {
  const memoryPath = path.join(memoryDir, `${userId}.json`);
  return fs.existsSync(memoryPath)
    ? JSON.parse(fs.readFileSync(memoryPath, "utf-8"))
    : { history: [] };
}

function saveUserMemory(userId: string, memory: UserMemory): void {
  const memoryPath = path.join(memoryDir, `${userId}.json`);
  fs.writeFileSync(memoryPath, JSON.stringify(memory, null, 2));
}

// 💬 Update Conversation Memory
function updateConversationMemory(
  userId: string,
  userInput: string,
  aiResponse: string
): void {
  const memory = loadUserMemory(userId);
  memory.history.push(`User: ${userInput}`);
  memory.history.push(`Buddy: ${aiResponse}`);
  if (memory.history.length > 20) {
    memory.history = memory.history.slice(-20);
  }
  saveUserMemory(userId, memory);
}

// 🤖 LLM Response Generation
async function generateTextAndAction(
  userInput: string,
  memory: string[] = []
): Promise<LLMResponse> {
  const prompt = buildPrompt(memory, userInput);
  const res = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );

  try {
    const parsed = JSON.parse(res.data.choices[0].message.content);
    return {
      responseText: parsed.responseText || "",
      action: parsed.action || "idle",
    };
  } catch {
    return {
      responseText: "Sorry, I didn't get that.",
      action: "idle",
    };
  }
}

// 🔊 Speech Synthesis
async function synthesizeSpeech(text: string): Promise<string> {
  const res = await axios.post(
    "https://api.openai.com/v1/audio/speech",
    {
      model: "tts-1",
      voice: "nova",
      input: text,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      responseType: "arraybuffer",
    }
  );

  const filename = `tts_${Date.now()}.mp3`;
  const filePath = path.join(ttsDir, filename);
  fs.writeFileSync(filePath, res.data);
  return `/tts_output/${filename}`;
}

// 🔍 Filter Meaningless Input
function isMeaninglessInput(input: string): boolean {
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
  return (
    set.has(normalized) ||
    normalized.length <= 2 ||
    (normalized.split(/\s+/).length === 1 && normalized.length < 4)
  );
}

// 🔄 Mode Transition Handler
function handleModeTransition(currentMode: Mode, intent: string): Mode {
  switch (currentMode) {
    case "pet":
      if (intent === "start_chat") return "chat";
      if (intent === "start_math_game") return "math_game";
      break;
    case "math_game":
      if (intent === "end_math_game") return "pet";
      break;
    case "chat":
      if (intent === "end_chat") return "pet";
      break;
  }
  return currentMode;
}

// 🧠 Interaction Endpoint (/speech)
const speechHandler: RequestHandler = async (req, res) => {
  const audioReq = req as AudioRequest;
  const userId = audioReq.body.userId || "default";
  const skipTTS = audioReq.body.skipTTS === "true";
  const isAudio = !!audioReq.file;
  const mode: Mode = audioReq.body.mode || "pet";

  let inputText = "";
  let intent = "unknown";
  let entities: Record<string, any> = {};
  let action = "idle";
  let responseText = "";
  let audioUrl = "";
  let nextMode: Mode = mode;

  try {
    if (isAudio && audioReq.file) {
      const audioPath = audioReq.file.path;
      const result = await transcribeWithWit(audioPath);
      inputText = result.text || "";
      intent = result.intent || "unknown";
      entities = result.entities || {};
      fs.unlinkSync(audioPath);
    } else {
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
        if (
          petIntentToActionsMap[intent as keyof typeof petIntentToActionsMap]
        ) {
          action =
            petIntentToActionsMap[intent as keyof typeof petIntentToActionsMap];

          // Generate response only for start_chat intent
          if (intent === "start_chat") {
            const memory = loadUserMemory(userId);
            const result = await generateTextAndAction(
              inputText,
              memory.history
            );
            responseText = result.responseText;
            updateConversationMemory(userId, inputText, responseText);
          }
        } else {
          intent = "ignored";
        }
        break;

      case "math_game":
        if (
          mathGameIntentToActionsMap[
            intent as keyof typeof mathGameIntentToActionsMap
          ]
        ) {
          action =
            mathGameIntentToActionsMap[
              intent as keyof typeof mathGameIntentToActionsMap
            ];
        } else {
          intent = "ignored";
        }
        break;

      case "chat":
        if (
          chatIntentToActionsMap[intent as keyof typeof chatIntentToActionsMap]
        ) {
          action =
            chatIntentToActionsMap[
              intent as keyof typeof chatIntentToActionsMap
            ];

          // Generate response for end_chat intent
          if (intent === "end_chat") {
            const memory = loadUserMemory(userId);
            const result = await generateTextAndAction(
              inputText,
              memory.history
            );
            responseText = result.responseText;
            updateConversationMemory(userId, inputText, responseText);
          }
        } else if (!isMeaninglessInput(inputText)) {
          const memory = loadUserMemory(userId);
          const result = await generateTextAndAction(inputText, memory.history);
          responseText = result.responseText;
          action = result.action;
          updateConversationMemory(userId, inputText, responseText);
        } else {
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
  } catch (err) {
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
