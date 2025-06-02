# 🐾 Virtual Service Animal API – Unity Integration Guide

This API enables your Unity client (e.g. a Meta Quest app) to communicate with a virtual service animal using **voice or text input**. The system supports **multiple interaction modes**, **intent detection**, **natural dialogue**, and **optional TTS (Text-to-Speech)** audio output.

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

| Mode           | Description                         | Example Intents                        |
| -------------- | ----------------------------------- | -------------------------------------- |
| 🐕 `pet`       | Default mode for basic pet commands | `sit_dog`, `fetch_object`, `come_here` |
| 🧮 `math_game` | Interactive math game mode          | `start_math_game`, `end_math_game`     |
| 💬 `chat`      | Natural conversation mode           | `start_chat`, `end_chat`               |

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

## 🎙️ Voice Input – `/speech` (Recommended for Unity)

This is the **primary interface for Unity clients.** Unity records the user's voice, sends it to the server, and receives a recognized intent and optional audio reply.

### Request (POST):

```
https://vsa.fly.dev/speech?userId=ha&mode=pet&skipTTS=false
```

#### Query Parameters:

| Parameter | Type    | Default | Description                |
| --------- | ------- | ------- | -------------------------- |
| `userId`  | string  | default | User identifier for memory |
| `mode`    | string  | pet     | Current interaction mode   |
| `skipTTS` | boolean | false   | Skip audio response        |

#### Body: `multipart/form-data`

| Field Name | Type | Required | Notes                             |
| ---------- | ---- | -------- | --------------------------------- |
| `audio`    | File | ✅       | Must be `.wav`, 16kHz recommended |

### 🧪 Sample Unity Upload Code

```csharp
IEnumerator SendAudioToServer(string filePath)
{
    byte[] audioData = File.ReadAllBytes(filePath);
    WWWForm form = new WWWForm();
    form.AddBinaryData("audio", audioData, "voice.wav", "audio/wav");

    UnityWebRequest request = UnityWebRequest.Post(
        "https://vsa.fly.dev/speech?userId=ha&mode=pet&skipTTS=false",
        form
    );
    request.SetRequestHeader("x-api-key", "your_secret_key");

    yield return request.SendWebRequest();

    if (request.result == UnityWebRequest.Result.Success)
    {
        var response = JsonUtility.FromJson<APIResponse>(request.downloadHandler.text);
        // Handle response.intent, response.action, response.audioUrl etc.
    }
    else
    {
        Debug.LogError("Error: " + request.error);
    }
}
```

---

## ✏️ Text Input – `/text` (For Testing)

Use this endpoint for testing without Unity. In production, use `/speech`.

### Request (POST):

```
https://vsa.fly.dev/text?userId=ha&mode=pet&skipTTS=false
```

#### Headers:

```
Content-Type: application/json
x-api-key: YOUR_SECRET_KEY
```

#### Body (JSON):

```json
{
  "inputText": "Can you sit down?"
}
```

### 🔁 Response:

```json
{
  "inputText": "Can you sit down?",
  "intent": "sit_dog",
  "action": "sit",
  "responseText": "Sure, I'll sit down!",
  "audioUrl": "https://vsa.fly.dev/tts_output/tts_1747379404687.mp3",
  "nextMode": "pet"
}
```

---

## 🧠 Intent Types by Mode

### Pet Mode Intents

| Intent         | Example        | Action         |
| -------------- | -------------- | -------------- |
| `sit_dog`      | "Sit down"     | Pet sits       |
| `fetch_object` | "Get the ball" | Pet fetches    |
| `come_here`    | "Come here"    | Pet approaches |

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

## 🔊 Unity Audio Playback Example

```csharp
IEnumerator PlayAudioResponse(string audioUrl)
{
    UnityWebRequest www = UnityWebRequestMultimedia.GetAudioClip(audioUrl, AudioType.MPEG);
    yield return www.SendWebRequest();

    if (www.result == UnityWebRequest.Result.Success)
    {
        AudioClip clip = DownloadHandlerAudioClip.GetContent(www);
        audioSource.clip = clip;
        audioSource.Play();
    }
}
```

---

## ✅ Summary

- 🎮 Three interaction modes: pet, math game, and chat
- 🎙️ Use `/speech` for voice input in Unity
- ✏️ Use `/text` for testing
- 🧠 Intent-based actions with natural language processing
- 💬 Friendly, conversational responses
- 💾 Per-user memory for context awareness
- 🔐 API key authentication required

---

For any issues or questions, please contact the API maintainer or refer to the in-code comments for Unity integration logic.
