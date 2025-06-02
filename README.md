# 🐾 Virtual Service Animal API – Unity Integration Guide

This API enables your Unity client (e.g. a Meta Quest app) to communicate with a virtual service animal using **voice or text input**. The system supports **multiple interaction modes**, **intent detection**, **natural dialogue**, and **optional TTS (Text-to-Speech)** audio output.

## 📦 Unity Client Integration

The Unity client integration code is located in the `unity-client` folder. For details, see the [Unity Client README](unity-client/README.md).

### Quick Start

1. Copy the C# script from the `unity-client/Scripts` folder into your Unity project.
2. Set your API key and server URL.
3. Use the `ServerVoiceCommandHandler` component to handle voice commands.

---

## 🔐 Authentication

All requests to the API must include a valid API key in the request header.

### Required Header:

```
x-api-key: YOUR_SECRET_KEY
```

In Unity, this is how you add the header:

```csharp
request.SetRequestHeader("x-api-key", "your_secret_key");
```

---

## 🎮 Interaction Modes

The service animal operates in three distinct modes:

| Mode           | Description                         | Example Intents                    |
| -------------- | ----------------------------------- | ---------------------------------- |
| 🐕 `pet`       | Default mode for basic pet commands | `sit`, `fetch`, `come_here`        |
| 🧮 `math_game` | Interactive math game mode          | `start_math_game`, `end_math_game` |
| 💬 `chat`      | Natural conversation mode           | `start_chat`, `end_chat`           |

### Mode Transitions:

- From `pet` mode: Can transition to `chat` or `math_game`
- From `chat` mode: Returns to `pet` mode on `end_chat`
- From `math_game` mode: Returns to `pet` mode on `end_math_game`

---

## 🧭 Key Features

The Virtual Service Animal API provides:

- 🐶 **Multiple Interaction Modes**: Pet commands, math games, and natural conversation
- 🧠 **Smart Responses**: Uses ChatGPT for natural, friendly dialogue
- 🔊 **Voice Support**: Optional TTS responses with OpenAI's Nova voice
- 💾 **Memory System**: Maintains conversation history per user
- 🎯 **Intent Detection**: Powered by Wit.ai for command recognition
- 🤝 **Friendly Personality**: Designed to be a companion, not just a service provider

### Behavior Examples:

| Mode         | Input             | Response                       |
| ------------ | ----------------- | ------------------------------ |
| 🐕 Pet       | "Sit down"        | Performs sit action            |
| 🧮 Math Game | "Let's play math" | Transitions to math game mode  |
| 💬 Chat      | "How are you?"    | Natural, friendly conversation |

---

## 🔗 Base URL

```
https://vsa.fly.dev
```

---

## 🎙️ Voice Input – `/speech`

This is the **primary interface for Unity clients.** Unity records the user's voice, sends it to the server, and receives a recognized intent and optional audio reply.

### Request (POST):

```
https://vsa.fly.dev/speech
```

#### Body: `multipart/form-data`

| Field Name | Type   | Required | Description                                     |
| ---------- | ------ | -------- | ----------------------------------------------- |
| `audio`    | File   | ✅       | Must be `.wav`, 16kHz recommended               |
| `userId`   | string | ❌       | User identifier for memory (default: "default") |
| `mode`     | string | ❌       | Current interaction mode (default: "pet")       |
| `skipTTS`  | string | ❌       | Skip audio response (default: "false")          |

---

## 🧠 Intent Types by Mode

### Pet Mode Intents

| Intent      | Example        | Action         |
| ----------- | -------------- | -------------- |
| `sit`       | "Sit down"     | Pet sits       |
| `fetch`     | "Get the ball" | Pet fetches    |
| `come_here` | "Come here"    | Pet approaches |

### Math Game Mode Intents

| Intent            | Example           | Action     |
| ----------------- | ----------------- | ---------- |
| `start_math_game` | "Let's play math" | Start game |
| `end_math_game`   | "Stop playing"    | End game   |

### Chat Mode Intents

| Intent       | Example      | Action     |
| ------------ | ------------ | ---------- |
| `start_chat` | "Let's talk" | Start chat |
| `end_chat`   | "Goodbye"    | End chat   |

---

## ✅ Summary

- 🎮 Three interaction modes: pet, math game, and chat
- 🎙️ Use `/speech` for voice input in Unity
- 🧠 Intent-based actions with natural language processing
- 💬 Friendly, conversational responses
- 💾 Per-user memory for context awareness
- 🔐 API key authentication required
