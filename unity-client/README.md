# 🐾 Virtual Service Animal - Unity Client Integration

This folder contains the Unity client code for integrating with the Virtual Service Animal API.

## 📦 Overview

We offer two different approaches for handling voice commands:

1. **Server-based approach**:

   - The Unity client sends audio data to a Node.js server (`server.js`).
   - The server handles:
     - Speech-to-text using Wit.ai
     - Intent detection and LLM response generation using ChatGPT
     - Text-to-speech (TTS) synthesis
   - This keeps the Unity client lightweight and shifts most of the processing to the backend.

2. **Client-based approach**:
   - The Unity client directly handles the entire pipeline:
     - Sends audio to Wit.ai for STT
     - Sends the transcribed text to ChatGPT for a response
     - Converts the response to audio using a TTS API
   - This removes the need for a backend server but requires more logic and API management inside Unity.

## 📚 Usage

For detailed instructions on how to use each approach, please refer to the following README files:

- **Server-based approach**: [Server README](server-based-approach/README.md)
- **Client-based approach**: [Client README](client-based-approach/README.md)

## 📝 Key Features

- Voice command recognition
- TTS response playback
- Mode switching (pet, math_game, chat)
- Per-user memory

## 🐛 Troubleshooting

- Make sure your API key and server URL are set correctly.
- Check your audio and object assignments in the Inspector.

## 📚 API Documentation

See the [main README](../../README.md) for full API documentation.
