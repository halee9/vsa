// Voice Command Server with STT (Wit.ai), LLM (ChatGPT), and TTS (OpenAI)
// Refactored into functional modules for readability and maintainability

import express from "express";
import multer from "multer";
import axios from "axios";
import fs from "fs";
import path from "path";
import "dotenv/config";

const app = express();
const port = 3000;
const upload = multer({ dest: "uploads/" });
const memoryDir = "./memory";
const ttsDir = "./tts_output";
if (!fs.existsSync(memoryDir)) fs.mkdirSync(memoryDir);
if (!fs.existsSync(ttsDir)) fs.mkdirSync(ttsDir);

app.use("/tts_output", express.static("tts_output"));
app.use(express.json()); // to parse JSON body

function handleIntent(intent, text) {
  const response = {
    command: null,
    category: null,
    action: null,
    description: "",
  };

  switch (intent) {
    case "sit_dog":
    case "stop_dog":
    case "walk_dog":
      response.command = intent;
      response.category = "movement";
      response.action = intent.replace("_dog", "");
      response.description = `Perform action: ${response.action}`;
      break;
    case "wag_tail":
      response.command = "wag_tail";
      response.category = "reaction";
      response.action = "wag";
      response.description = "Dog wags its tail";
      break;
    case "dog_comfort":
    case "dog_angry":
    case "dog_eat":
      response.command = intent;
      response.category = "emotion";
      response.action = intent.split("_")[1];
      response.description = `Emotional response: ${response.action}`;
      break;
    case "math_game":
    case "math_game_setup":
    case "correct_math_answer":
    case "incorrect_math_answer":
    case "try_previous_math_problem":
    case "end_math_section":
      response.command = intent;
      response.category = "math_game";
      response.action = intent;
      response.description = `Math game intent: ${intent}`;
      break;
    case "throw_ball":
    case "fetch_object":
    case "get_ball":
      response.command = "fetch";
      response.category = "play";
      response.action = intent;
      response.description = "Play interaction command";
      break;
    case "move_forward":
    case "move_backward":
    case "move_left":
    case "move_right":
      response.command = "move";
      response.category = "navigation";
      response.action = intent.split("_")[1];
      response.description = `Move in direction: ${response.action}`;
      break;
    default:
      response.command = null;
      response.category = "unknown";
      response.action = null;
      response.description = `Unrecognized intent: ${intent}`;
      break;
  }
  return response;
}

async function transcribeWithWit(audioPath) {
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
    }
  );
  const text = response.data._text || "";
  const intent = response.data.intents?.[0]?.name || "unknown";
  return { text, intent };
}

async function analyzeTextIntent(inputText) {
  const res = await axios.get("https://api.wit.ai/message", {
    params: { v: "20230228", q: inputText },
    headers: {
      Authorization: `Bearer ${process.env.WIT_AI_TOKEN}`,
    },
  });
  const intent = res.data.intents?.[0]?.name || "unknown";
  return intent;
}

function loadUserMemory(userId) {
  const memoryPath = path.join(memoryDir, `${userId}.json`);
  if (fs.existsSync(memoryPath)) {
    return JSON.parse(fs.readFileSync(memoryPath));
  }
  return { history: [] };
}

function saveUserMemory(userId, memory) {
  const memoryPath = path.join(memoryDir, `${userId}.json`);
  fs.writeFileSync(memoryPath, JSON.stringify(memory, null, 2));
}

async function generateResponse(text, memory) {
  const prompt =
    `You are Buddy, a friendly service animal. Conversation history:\n` +
    memory.history
      .slice(-3)
      .map((h) => `- ${h}`)
      .join("\n") +
    `\nNow the user says: ${text}`;

  const gptRes = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );

  return gptRes.data.choices[0].message.content;
}

async function synthesizeSpeech(text) {
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

  const audioFilename = `tts_${Date.now()}.mp3`;
  const audioFilePath = path.join(ttsDir, audioFilename);
  fs.writeFileSync(audioFilePath, res.data);

  return `/tts_output/${audioFilename}`;
}

app.post("/speech", upload.single("audio"), async (req, res) => {
  const userId = req.query.userId || "default";
  const skipTTS = req.query.skipTTS === "true";
  const audioPath = req.file.path;

  try {
    const { text, intent } = await transcribeWithWit(audioPath);
    const intentInfo = handleIntent(intent, text);
    const memory = loadUserMemory(userId);

    let finalText = text;
    if (!intentInfo.command) {
      finalText = await generateResponse(text, memory);
    }

    memory.history.push(text);
    if (memory.history.length > 10) memory.history.shift();
    saveUserMemory(userId, memory);

    const response = {
      originalText: text,
      intent,
      ...intentInfo,
      responseText: finalText,
    };

    if (!skipTTS && !intentInfo.command) {
      const audioUrl = await synthesizeSpeech(finalText);
      response.audioUrl = `http://localhost:${port}${audioUrl}`;
    }

    res.json(response);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  } finally {
    fs.unlinkSync(audioPath);
  }
});

app.post("/text", async (req, res) => {
  const userId = req.query.userId || "default";
  const skipTTS = req.query.skipTTS === "true";
  const { inputText } = req.body;

  try {
    const intent = await analyzeTextIntent(inputText);
    const intentInfo = handleIntent(intent, inputText);
    const memory = loadUserMemory(userId);

    let finalText = inputText;
    if (!intentInfo.command) {
      finalText = await generateResponse(inputText, memory);
    }

    memory.history.push(inputText);
    if (memory.history.length > 10) memory.history.shift();
    saveUserMemory(userId, memory);

    const response = {
      originalText: inputText,
      intent,
      ...intentInfo,
      responseText: finalText,
    };

    if (!skipTTS && !intentInfo.command) {
      const audioUrl = await synthesizeSpeech(finalText);
      response.audioUrl = `http://localhost:${port}${audioUrl}`;
    }

    res.json(response);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});
