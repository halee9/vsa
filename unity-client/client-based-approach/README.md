# Client-Based Voice Command Handling

This folder contains the client-side implementation for handling voice commands directly within the Unity client.

## 📦 Installation

1. Ensure you have Unity installed on your system.
2. Open your Unity project and navigate to the `Assets` folder.
3. Copy the necessary scripts from the `client` folder into your project.

## 🚀 Usage

1. In your Unity scene, attach the `ClientVoiceCommandHandler` script to a GameObject.
2. Configure the script in the Inspector:

   - **Wit.ai API Key**: Enter your Wit.ai API key.
   - **ChatGPT API Key**: Enter your ChatGPT API key.
   - **TTS API Key**: Enter your TTS API key.

3. The client will handle the entire pipeline:
   - Sends audio to Wit.ai for STT
   - Sends the transcribed text to ChatGPT for a response
   - Converts the response to audio using a TTS API

## 🧪 Testing (Step-by-Step)

Follow these steps to thoroughly test the client-based approach and all three modes:

1. **Start Play Mode**

   - Click the Play button in the Unity Editor.

2. **Command Mode (Default)**

   - The system always starts in command mode.
   - Speak a command like "sit" or "come here" and check if the service animal performs the correct action.

3. **Switch to Math Game Mode**

   - Say "Let's play math game" or "Time to play" to enter math game mode.
   - The service animal should run up to the user.
   - Say "Are you ready?" and the animal should bark once to indicate readiness.
   - Now, ask a math question (e.g., "What is two plus two?"). The animal will respond by barking the number of times equal to the answer.
   - To exit math game mode, say "take a break" or a similar command.

4. **Switch to Chat Mode**

   - From command mode, say "Let's chat" or "Let's talk" to enter chat mode.
   - The service animal should greet you.
   - In chat mode, say anything and the service animal will respond conversationally.
   - To exit chat mode, say "stop chat" or "stop talking". The animal will say a farewell and return to command mode.

5. **Repeat as Needed**
   - You can switch between modes and test as many times as you like.

### What to Check

- Each mode transition works as described.
- The service animal's actions and responses match your commands and questions.
- TTS and barking responses are played correctly.
- The system returns to command mode after ending math game or chat mode.

### Troubleshooting

- Ensure all API keys are set and valid.
- Check microphone permissions and Unity Console for errors.
- Only one handler (client or server) should be enabled at a time.

## 📝 Key Features

- Direct integration with Wit.ai for speech-to-text
- Integration with ChatGPT for response generation
- Text-to-speech synthesis using a TTS API
- Multi-mode support: command, math game, chat

## 🐛 Troubleshooting

- Ensure your API keys are correctly set in the Unity Inspector.
- Check the Unity console for any errors during processing.
