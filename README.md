# 🐾 Virtual Service Animal API – Unity Integration Guide

This API enables your Unity client (e.g. a Meta Quest app) to communicate with a virtual service animal using **text or voice input**. The system supports **intent detection**, **natural dialogue**, and **optional TTS (Text-to-Speech)** audio output.

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

## 🎮 Integration Overview

Your Unity app sends either:

- **Text** via HTTP POST to `/text`
- **Recorded voice** as a `.wav` file via POST to `/speech`

The API returns:

- The **recognized intent**
- A **command string** (if it’s a pet action like `sit`, `fetch`, etc.)
- An **LLM-generated response** if it’s general conversation
- An **audio file URL** (optional, for speaking the response)

---

## ✏️ Text Input – `/text`

### ✅ Use this when:

- You’re sending typed or STT-converted text from Unity

### Request (POST):

```
https://vsa.fly.dev/text?userId=ha&skipTTS=false
```

#### Headers:

```
Content-Type: application/json
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

#### Unity Handling:

```csharp
if (response.command != null) {
    TriggerPetBehavior(response.command); // e.g., "sit_dog" → dog.MakeDogSit();
} else {
    DisplayDialogue(response.responseText);
    if (!string.IsNullOrEmpty(response.audioUrl)) {
        PlayAudioFromUrl(response.audioUrl);
    }
}
```

---

## 🎙️ Voice Input – `/speech`

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

- 🎮 Use `/text` for text commands or chat.
- 🎙️ Use `/speech` to upload `.wav` audio.
- 🎯 Use `command` for pet actions and `responseText` for conversational replies.
- 🔊 Use `audioUrl` if `skipTTS=false`.
- 💾 Conversations are stored in memory per user.

---

For any issues or questions, please contact the API maintainer or refer to the in-code comments for Unity integration logic.
