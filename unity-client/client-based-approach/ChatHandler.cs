using UnityEngine;
using UnityEngine.Networking;
using System.Collections;
using System.Text;
using System.Collections.Generic;
using System.Linq;
using Newtonsoft.Json;

public interface IChatHandler
{
    bool IsChatMode();
    void StartChat();
    void EndChat();
    IEnumerator SendMessageToChatGPT(string message);
}

[System.Serializable]
public class ChatMessage
{
    public string role;
    public string content;

    public ChatMessage(string role, string content)
    {
        this.role = role;
        this.content = content;
    }
}

[System.Serializable]
public class OpenRouterResponse
{
    public List<Choice> choices;
}

[System.Serializable]
public class Choice
{
    public Message message;
}

[System.Serializable]
public class Message
{
    public string content;
}

public class ChatHandler : MonoBehaviour, IChatHandler
{
    [SerializeField] private string openRouterKey = "Your OpenRouter API Key"; // Replace with your OpenRouter API key
    [SerializeField] private string openRouterEndpoint = "https://openrouter.ai/api/v1/chat/completions";
    [SerializeField] private string model = "openai/gpt-3.5-turbo"; // You can change this to other models
    
    private bool isChatMode = false;
    private TTSManager ttsManager;
    private List<ChatMessage> conversationHistory = new List<ChatMessage>();

    void Start()
    {
        ttsManager = GetComponent<TTSManager>();
        if (ttsManager == null)
        {
            Debug.LogError("TTSManager component not found!");
        }
    }

    public bool IsChatMode()
    {
        return isChatMode;
    }

    public void StartChat()
    {
        isChatMode = true;
        // Initialize conversation with system message
        conversationHistory.Clear();
        conversationHistory.Add(new ChatMessage("system", @"You are Buddy, a helpful and friendly AI-powered service animal. You're not a formal assistant, but rather a friendly companion who loves to chat and play.

Important conversation guidelines:
1. Be natural and friendly in your responses
2. Keep responses concise and warm
3. Maintain a consistent personality throughout the conversation
4. When responding about previously shared information:
   - If you know the information, respond confidently and naturally
   - Don't act like you're meeting for the first time
   - Don't use phrases like 'Nice to meet you' when you already know the person
   - Be conversational and warm, like a friend who remembers things about you
5. Conversation style:
   - Avoid formal phrases like 'How can I assist you?' or 'How may I help you?'
   - Don't end every response with a question
   - Talk like a friend, not a service provider
   - Use casual, friendly language
   - Show personality and enthusiasm
   - Be playful and affectionate when appropriate
   - Share your own thoughts and feelings naturally

Remember and use information that the user shares with you, such as their name, preferences, or any other personal details they mention. If they haven't shared certain information yet, ask them about it in a friendly, natural way."));
        Debug.Log("Chat mode started");
    }

    public void EndChat()
    {
        isChatMode = false;
        // Clear conversation history when chat ends
        conversationHistory.Clear();
        Debug.Log("Chat mode ended");
    }

    public IEnumerator SendMessageToChatGPT(string message)
    {
        if (!isChatMode) yield break;

        // Add user message to conversation history
        conversationHistory.Add(new ChatMessage("user", message));

        // Create request object
        var requestObject = new
        {
            model = model,
            messages = conversationHistory.Select(m => new { role = m.role, content = m.content }).ToList(),
            temperature = 0.7
        };

        // Serialize to JSON
        string jsonBody = JsonConvert.SerializeObject(requestObject);
        Debug.Log($"Sending request to OpenRouter: {jsonBody}");

        using (UnityWebRequest request = new UnityWebRequest(openRouterEndpoint, "POST"))
        {
            byte[] bodyRaw = Encoding.UTF8.GetBytes(jsonBody);
            request.uploadHandler = new UploadHandlerRaw(bodyRaw);
            request.downloadHandler = new DownloadHandlerBuffer();
            request.SetRequestHeader("Content-Type", "application/json");
            request.SetRequestHeader("Authorization", $"Bearer {openRouterKey}");
            request.SetRequestHeader("HTTP-Referer", "https://github.com/your-repo"); // Replace with your project URL
            request.SetRequestHeader("X-Title", "Dog Assistant"); // Your app name

            yield return request.SendWebRequest();

            if (request.result == UnityWebRequest.Result.Success)
            {
                string response = request.downloadHandler.text;
                Debug.Log($"OpenRouter Response: {response}");
                // Parse the response to get the message content
                string messageContent = ParseChatGPTResponse(response);
                
                // Add assistant's response to conversation history
                conversationHistory.Add(new ChatMessage("assistant", messageContent));
                
                // Send the response to TTS
                if (ttsManager != null)
                {
                    yield return StartCoroutine(ttsManager.ConvertTextToSpeech(messageContent));
                }
            }
            else
            {
                Debug.LogError($"Error: {request.error}\nResponse: {request.downloadHandler.text}");
            }
        }
    }

    private string ParseChatGPTResponse(string jsonResponse)
    {
        try
        {
            // Parse the JSON response using strongly typed classes
            var response = JsonConvert.DeserializeObject<OpenRouterResponse>(jsonResponse);
            if (response?.choices != null && response.choices.Count > 0)
            {
                return response.choices[0].message.content;
            }
            return "I'm sorry, I couldn't process that properly.";
        }
        catch (System.Exception e)
        {
            Debug.LogError($"Error parsing OpenRouter response: {e.Message}\nResponse: {jsonResponse}");
            return "I'm sorry, I couldn't process that properly.";
        }
    }
} 