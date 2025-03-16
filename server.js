const express = require("express");
const multer = require("multer");
const axios = require("axios");
const fs = require("fs");
const FormData = require("form-data");
const path = require("path");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

// Add static file serving for audio files
app.use("/audio", express.static(path.join(__dirname, "public", "audio")));

// 환경변수에서 API 키 가져오기
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const WEATHER_API_KEY = process.env.WEATHER_API_KEY;

// API 키 존재 여부 확인
if (!OPENAI_API_KEY || !WEATHER_API_KEY) {
  console.error("Missing required API keys in environment variables");
  process.exit(1);
}

// Multer configuration for file uploads
const upload = multer({ dest: "uploads/" });

// 서버 URL을 환경변수로 설정
const SERVER_URL = process.env.SERVER_URL || `http://localhost:${port}`;

// Function to convert Celsius to Fahrenheit
function celsiusToFahrenheit(celsius) {
  return (celsius * 9) / 5 + 32;
}

// Function to get weather data
async function getWeatherData(city = "Seattle") {
  try {
    const response = await axios.get(
      `https://api.openweathermap.org/data/2.5/weather?q=${city}&units=metric&appid=${WEATHER_API_KEY}`
    );
    const tempC = response.data.main.temp;
    const feelsLikeC = response.data.main.feels_like;

    return {
      temperatureC: tempC,
      temperatureF: celsiusToFahrenheit(tempC),
      feelsLikeC: feelsLikeC,
      feelsLikeF: celsiusToFahrenheit(feelsLikeC),
      description: response.data.weather[0].description,
      humidity: response.data.main.humidity,
      windSpeed: response.data.wind.speed,
      city: response.data.name,
    };
  } catch (error) {
    console.error("Weather API Error:", error);
    return null;
  }
}

// Function to convert text to speech using OpenAI TTS
async function textToSpeech(text) {
  try {
    const response = await axios.post(
      "https://api.openai.com/v1/audio/speech",
      {
        model: "tts-1",
        voice: "alloy",
        input: text,
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        responseType: "arraybuffer",
      }
    );

    // Create a public directory for audio files if it doesn't exist
    const publicDir = path.join(__dirname, "public", "audio");
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }

    // Generate unique filename
    const fileName = `speech-${Date.now()}.mp3`;
    const filePath = path.join(publicDir, fileName);

    // Save the file
    fs.writeFileSync(filePath, response.data);

    // Return the URL path with the correct server URL
    return `/audio/${fileName}`;
  } catch (error) {
    console.error("TTS Error:", error);
    return null;
  }
}

// Common function to process text and generate response
async function processTextAndGenerateResponse(text) {
  try {
    const transcribedText = text.toLowerCase();
    console.log("Processing Text:", transcribedText);

    let finalResponse;

    // Check if the question is about weather
    if (transcribedText.includes("weather")) {
      const weatherData = await getWeatherData();
      if (weatherData) {
        const weatherContext = `Current weather information for ${
          weatherData.city
        }:
          - Temperature: ${weatherData.temperatureF.toFixed(
            1
          )}°F (${weatherData.temperatureC.toFixed(1)}°C)
          - Feels like: ${weatherData.feelsLikeF.toFixed(
            1
          )}°F (${weatherData.feelsLikeC.toFixed(1)}°C)
          - Conditions: ${weatherData.description}
          - Humidity: ${weatherData.humidity}%
          - Wind Speed: ${weatherData.windSpeed} m/s`;

        const chatResponse = await axios.post(
          "https://api.openai.com/v1/chat/completions",
          {
            model: "gpt-3.5-turbo",
            messages: [
              {
                role: "system",
                content:
                  "You are a helpful and friendly AI assistant. Provide brief and concise responses in 1-2 sentences. When discussing weather, be conversational but keep it short and to the point. Use Fahrenheit as the primary temperature unit.",
              },
              {
                role: "user",
                content: transcribedText,
              },
              {
                role: "assistant",
                content: weatherContext,
              },
            ],
          },
          {
            headers: {
              Authorization: `Bearer ${OPENAI_API_KEY}`,
              "Content-Type": "application/json",
            },
          }
        );
        finalResponse = chatResponse.data.choices[0].message.content;
      } else {
        finalResponse = "Sorry, I can't get the weather information right now.";
      }
    } else {
      const chatResponse = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content:
                "You are a helpful AI assistant. Provide brief and concise responses in 1-2 sentences maximum. Be direct and get straight to the point.",
            },
            {
              role: "user",
              content: transcribedText,
            },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );
      finalResponse = chatResponse.data.choices[0].message.content;
    }

    // Convert the response to speech
    const responseAudioPath = await textToSpeech(finalResponse);

    return {
      transcription: transcribedText,
      response: finalResponse,
      audioUrl: responseAudioPath ? `${SERVER_URL}${responseAudioPath}` : null,
    };
  } catch (error) {
    console.error("Processing Error:", error);
    throw error;
  }
}

// Endpoint for text input
app.post("/chat", express.json(), async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: "No text provided" });
    }

    const result = await processTextAndGenerateResponse(text);
    res.json(result);
  } catch (error) {
    console.error("Chat Error:", error);
    res.status(500).json({
      error: "Failed to process request",
      details: error.response?.data,
    });
  }
});

// Modified speech-to-text endpoint
app.post("/stt", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No audio file uploaded" });
    }

    console.log("Uploaded file details:", req.file);

    const uploadedAudioPath = req.file.path;
    const formData = new FormData();

    formData.append("file", fs.createReadStream(uploadedAudioPath), {
      filename: req.file.originalname,
      contentType: req.file.mimetype,
    });
    formData.append("model", "whisper-1");

    // Convert speech to text
    const sttResponse = await axios.post(
      "https://api.openai.com/v1/audio/transcriptions",
      formData,
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          ...formData.getHeaders(),
        },
      }
    );

    // Clean up the uploaded audio file
    fs.unlinkSync(uploadedAudioPath);

    // Process the transcribed text
    const result = await processTextAndGenerateResponse(sttResponse.data.text);
    res.json(result);
  } catch (error) {
    console.error("STT Error:", error);
    res.status(500).json({
      error: "Failed to process request",
      details: error.response?.data,
    });
  }
});

// 서버 상태 체크용 엔드포인트
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date(),
    uptime: process.uptime(),
  });
});

// 현재 날씨 정보를 가져오는 GET 엔드포인트
app.get("/weather", async (req, res) => {
  try {
    // 쿼리 파라미터로 도시를 받을 수 있음 (기본값: Seattle)
    const city = req.query.city || "Seattle";
    const weatherData = await getWeatherData(city);

    if (weatherData) {
      res.json({
        city: weatherData.city,
        temperature: {
          fahrenheit: Math.round(weatherData.temperatureF),
          celsius: Math.round(weatherData.temperatureC),
        },
        feelsLike: {
          fahrenheit: Math.round(weatherData.feelsLikeF),
          celsius: Math.round(weatherData.feelsLikeC),
        },
        conditions: weatherData.description,
        humidity: weatherData.humidity,
        windSpeed: weatherData.windSpeed,
      });
    } else {
      res.status(404).json({
        error: "Weather data not found",
        message: "Unable to fetch weather data for the specified city",
      });
    }
  } catch (error) {
    console.error("Weather API Error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to fetch weather data",
    });
  }
});

// Make sure uploads directory exists
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

// Make sure public/audio directory exists
const publicAudioDir = path.join(__dirname, "public", "audio");
if (!fs.existsSync(publicAudioDir)) {
  fs.mkdirSync(publicAudioDir, { recursive: true });
}

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Audio files will be available at ${SERVER_URL}/audio/`);
});
