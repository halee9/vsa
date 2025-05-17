# 🐾 Virtual Service Animal API – Unity Integration Guide

This API enables your Unity client (e.g. a Meta Quest app) to communicate with a virtual service animal using **voice or text input**. The system supports **intent detection**, **natural dialogue**, and **optional TTS (Text-to-Speech)** audio output.

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

## 🧭 Why Use This API?

The Virtual Service Animal API gives your Unity project an intelligent, responsive service animal companion that:

- 🐶 Understands basic **pet commands** like `sit`, `fetch`, `come here`, etc.
- 🧠 Responds to **conversational speech** using ChatGPT (LLM) when the input is not a command
- 🔊 Provides **text-to-speech** audio responses (optional)
- 🧾 **Remembers past conversations** per user via server-side memory

### Behavior Overview:

| Scenario                       | API Behavior                                                                               |
| ------------------------------ | ------------------------------------------------------------------------------------------ |
| 🎙️ Voice says "Sit down"       | Recognized as intent `sit_dog`, response includes `command = sit_dog`, no audio if skipped |
| 💬 User says "Tell me a story" | No pet command detected → routed to LLM → returns story text + optional TTS                |

This makes the animal behave like an intelligent NPC (non-playable character) that can **follow commands and also talk** when needed.

---

## ✨ Key Features

- ✅ Easy HTTP integration (text or audio input)
- 🧠 Wit.ai-powered intent analysis
- 🤖 ChatGPT (GPT-3.5 Turbo) used for free-form responses
- 🗣️ Optional OpenAI TTS for spoken replies
- 📚 Per-user memory history stored server-side
- 🦴 Designed for real-time, immersive VR/AR interactions

---

## 🔗 Base URL

```
https://vsa.fly.dev
```

---

## 🎙️ Voice Input – `/speech` (Recommended for Unity)

This is the **primary interface for Unity clients.** Unity records the user's voice, sends it to the server, and receives a recognized intent and optional audio reply.

### ✅ Use this when:

- You record audio in Unity and want to send it for STT + intent processing

### Request (POST):

```
https://vsa.fly.dev/speech?userId=ha&skipTTS=true
```

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

    UnityWebRequest request = UnityWebRequest.Post("https://vsa.fly.dev/speech?userId=ha&skipTTS=false", form);
    request.SetRequestHeader("x-api-key", "your_secret_key");

    yield return request.SendWebRequest();

    if (request.result == UnityWebRequest.Result.Success)
    {
        Debug.Log("Response: " + request.downloadHandler.text);
        // Parse JSON and handle intent, command, audioUrl etc.
    }
    else
    {
        Debug.LogError("Error: " + request.error);
    }
}
```

---

## ✏️ Text Input – `/text` (Primarily for API Testing)

This endpoint allows you to send plain text to the API. It's mainly intended for **testing without a Unity client**, such as from Postman or Thunder Client.

In production, `/speech` is typically used.

### Request (POST):

```
https://vsa.fly.dev/text?userId=ha&skipTTS=false
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
  "originalText": "Can you sit down?",
  "intent": "sit_dog",
  "command": "sit_dog",
  "category": "movement",
  "action": "sit",
  "responseText": "Can you sit down?",
  "audioUrl": "https://vsa.fly.dev/tts_output/tts_1747379404687.mp3"
}
```

---

## 🧠 Intent Types

| Intent Example | Meaning               | Action                 |
| -------------- | --------------------- | ---------------------- |
| `sit_dog`      | “Sit down”            | Pet sits               |
| `fetch_object` | “Get the ball”        | Pet fetches ball       |
| `dog_comfort`  | “I’m feeling sad”     | Pet reacts emotionally |
| `unknown`      | No clear intent found | Use LLM response       |

---

## 🛠 Query Parameters Explained

| Parameter | Type    | Default | Description                         |
| --------- | ------- | ------- | ----------------------------------- |
| `userId`  | string  | default | Keeps conversation history separate |
| `skipTTS` | boolean | false   | If true, `audioUrl` is not returned |

---

## 🔊 Unity Audio Playback Example

```csharp
UnityWebRequest www = UnityWebRequestMultimedia.GetAudioClip(audioUrl, AudioType.MPEG);
yield return www.SendWebRequest();

AudioClip clip = DownloadHandlerAudioClip.GetContent(www);
audioSource.clip = clip;
audioSource.Play();
```

---

## ✅ Summary

- 🎙️ Use `/speech` from Unity to send `.wav` audio and receive command/response.
- ✏️ Use `/text` for Postman or local testing purposes.
- 🎯 Use `command` to trigger behaviors in Unity.
- 🔊 Use `audioUrl` if `skipTTS=false`.
- 💾 Server stores memory per user to enable conversational continuity.
- 🔐 All requests require `x-api-key` authentication.

---

For any issues or questions, please contact the API maintainer or refer to the in-code comments for Unity integration logic.
