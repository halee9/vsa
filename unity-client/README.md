# 🐾 Virtual Service Animal - Unity Client Integration

This folder contains the Unity client code for integrating with the Virtual Service Animal API.

## 📦 Installation

1. Copy all C# scripts from the `Scripts` folder into your Unity project's `Assets` folder.
2. Use only the `ServerVoiceCommandHandler.cs` script. **Do not use the old `WitVoiceCommandHandler.cs` script.**

## 🎮 Usage

1. In your Unity scene, create an empty GameObject (e.g., `WitVoiceCommandManager`).
2. Attach the `ServerVoiceCommandHandler` script to this GameObject.
3. Assign the required objects in the Inspector:

   - **Dog**: Assign your dog movement object.
   - **Player**: Assign the player (e.g., Main Camera).
   - **Tennis Ball**: Assign the tennis ball object.
   - **Curry Plate**: Assign the curry plate object.
   - **Server Url**: Set to `https://vsa.fly.dev/speech`
   - **Api Key**: Enter your API key.
   - **Stopping Distance From Player**: Set as needed (e.g., 0.2).

4. **Disable or remove** the old `WitVoiceCommandHandler` script if present.

## 🖼️ Example Inspector Setup

Below is an example of how your GameObject should look in the Unity Inspector:

![Inspector Example](inspector_example.png)

> _If you update or replace the screenshot, keep the file name as `inspector_example.png`._

## 📝 Key Features

- Voice command recognition
- TTS response playback
- Mode switching (pet, math_game, chat)
- Per-user memory

## 🐛 Troubleshooting

- Make sure your API key and server URL are set correctly.
- Only use `ServerVoiceCommandHandler.cs` (disable any old scripts).
- Check your audio and object assignments in the Inspector.

## 📚 API Documentation

See the [main README](../../README.md) for full API documentation.
