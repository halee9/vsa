using UnityEngine;
using UnityEngine.Networking;
using System.Collections;
using TMPro;
using System;
using System.Text.RegularExpressions;
using System.Collections.Generic;
using System.Linq;

[RequireComponent(typeof(ChatHandler))]
public class WitVoiceCommandHandler : MonoBehaviour
{
    public string witAccessToken = "QREEJDRRAQ4PZSUEOBDDDCVU6GGT4XX5";
    public DogMovement dog;
    public Transform player;
    public Transform tennisBall;
    public Transform curryPlate;
    public float stoppingDistanceFromPlayer = 0.2f;
    private string witApiUrl = "https://api.wit.ai/speech?v=20230202";
    private const float TRESHOLD_FOR_VOICE_DETECTION = 0.01f;
    private AudioClip recording;
    private const int SAMPLE_RATE = 16000;
    private string micName;
    private ChatHandler chatHandler;
    [SerializeField] private float commandCooldown = 1.0f;
    [SerializeField] private float mathExpressionTimeout = 5.0f;
    [SerializeField] private float chatTimeout = 30.0f;
    
    private bool isProcessingCommand = false;
    private float lastCommandTime;
    private float lastChatTime;
    private string currentMathExpression = "";
    private Coroutine mathExpressionCoroutine;
    private Coroutine chatTimeoutCoroutine;
    private TTSManager ttsManager;

    void Start()
    {
        if (dog == null)
        {
            dog = GetComponent<DogMovement>();
        }
        if (chatHandler == null)
        {
            chatHandler = GetComponent<ChatHandler>();
        }
        if (ttsManager == null)
        {
            ttsManager = GetComponent<TTSManager>();
        }

        if (Microphone.devices.Length == 0)
        {
            Debug.LogError("Nam11: No microphone detected.");
            return;
        }

        micName = Microphone.devices[0];
        Debug.Log("Nam11: Using mic: " + micName);
        recording = Microphone.Start(micName, true, 10, SAMPLE_RATE);

        StartCoroutine(LoopListening());
        
        if (chatHandler == null)
        {
            Debug.LogError("ChatHandler component not found!");
        }
    }

    IEnumerator LoopListening()
    {
        while (true)
        {
            yield return StartCoroutine(WaitForSpeech());
            yield return StartCoroutine(WaitForSilence());
            yield return StartCoroutine(CaptureAndSend());
            yield return new WaitForSeconds(0.2f);
        }
    }

    float GetMicVolume()
    {
        int micPos = Microphone.GetPosition(null) - 256;
        if (micPos < 0) return 0;

        float[] samples = new float[256];
        recording.GetData(samples, micPos);

        float sum = 0; 
        foreach (var sample in samples)
            sum += sample * sample;

        return Mathf.Sqrt(sum / samples.Length);
    }

    IEnumerator WaitForSpeech()
    {
        Debug.Log("Waiting for user to start speaking...");
        while (GetMicVolume() < 0.05f)
        {
            yield return null;
        }
        Debug.Log("Voice detected");
    }

    IEnumerator WaitForSilence()
    {
        Debug.Log("Waiting for user to stop speaking...");
        float silenceTimer = 0f;

        while (silenceTimer < 1f)
        {
            if (GetMicVolume() < 0.005f)
                silenceTimer += Time.deltaTime;
            else
                silenceTimer = 0f;

            yield return null;
        }

        Debug.Log("Silence detected");
    }

    IEnumerator CaptureAndSend()
    {
        if (Microphone.devices.Length == 0)
        {
            Debug.LogError("Nam11 No microphone devices found!");
            yield break;
        }  

        int sampleLength = SAMPLE_RATE * 3;
        int micPos = Microphone.GetPosition(micName);
        int startSample = micPos - sampleLength;

        if (startSample < 0)
            startSample += recording.samples;

        float[] samples = new float[sampleLength];
        recording.GetData(samples, startSample);

        AudioClip trimmed = AudioClip.Create("trimmed", sampleLength, 1, SAMPLE_RATE, false);
        trimmed.SetData(samples, 0);

        byte[] audio = WavUtility.FromAudioClip(trimmed);

        UnityWebRequest request = UnityWebRequest.PostWwwForm(witApiUrl, "POST");
        request.uploadHandler = new UploadHandlerRaw(audio);
        request.SetRequestHeader("Authorization", "Bearer " + witAccessToken);
        request.SetRequestHeader("Content-Type", "audio/wav");
        request.downloadHandler = new DownloadHandlerBuffer();

        yield return request.SendWebRequest();

        Debug.Log("Nam11 Sending audio to Wit...");
        Debug.Log("Nam11 Recording done, audio length: " + recording.length);

        if (request.result != UnityWebRequest.Result.Success)
        {
            Debug.LogError("Nam11 Wit.ai Error: " + request.error);
            yield break;
        }

        string json = request.downloadHandler.text;
        Debug.Log("Nam11 Raw JSON Response:\n" + json);

        string processedText = "";
        try
        {
            // Split the response into individual JSON objects
            string[] jsonObjects = json.Split(new[] { '{', '}' }, StringSplitOptions.RemoveEmptyEntries);
            Debug.Log($"Nam11: Found {jsonObjects.Length} JSON objects");
            
            // Find the last JSON object that contains "text"
            for (int i = jsonObjects.Length - 1; i >= 0; i--)
            {
                string obj = jsonObjects[i];
                Debug.Log($"Nam11: Checking JSON object {i}: {obj}");
                
                if (obj.Contains("\"text\":"))
                {
                    // Extract text using regex
                    var match = Regex.Match(obj, "\"text\"\\s*:\\s*\"([^\"]+)\"");
                    if (match.Success)
                    {
                        processedText = match.Groups[1].Value.Trim();
                        Debug.Log($"Nam11: Found text in response: {processedText}");
                        break;
                    }
                }
            }

            if (string.IsNullOrEmpty(processedText))
            {
                Debug.LogWarning("Nam11: No text found in Wit.ai response");
                yield break;
            }

            processedText = processedText.ToLower().Trim();
            Debug.Log($"Nam11: Final processed text: {processedText}");
        }
        catch (Exception e)
        {
            Debug.LogError($"Nam11: Error processing Wit.ai response: {e.Message}");
            yield break;
        }

        // If in chat mode, send the message to ChatGPT
        if (chatHandler != null && chatHandler.IsChatMode())
        {
            // Check for chat mode deactivation first
            if (processedText.Contains("stop talking") || processedText.Contains("end chat") || 
                processedText.Contains("stop chat") || processedText.Contains("bye"))
            {
                chatHandler.EndChat();
                if (ttsManager != null)
                {
                    yield return StartCoroutine(ttsManager.ConvertTextToSpeech("Goodbye! Let me know if you want to chat again."));
                }
                yield break;
            }

            // Check if the text contains any commands before sending to ChatGPT
            if (ProcessCommand(processedText))
            {
                // If a command was processed, still send the message to ChatGPT
                yield return StartCoroutine(chatHandler.SendMessageToChatGPT(processedText));
            }
            else
            {
                // If no command was processed, just send to ChatGPT
                yield return StartCoroutine(chatHandler.SendMessageToChatGPT(processedText));
            }
            yield break;
        }

        // Check for chat mode activation
        if (processedText.Contains("let's talk") || processedText.Contains("lets talk") || 
            processedText.Contains("let's chat") || processedText.Contains("lets chat"))
        {
            if (chatHandler != null)
            {
                chatHandler.StartChat();
                if (ttsManager != null)
                {
                    yield return StartCoroutine(ttsManager.ConvertTextToSpeech("Hello! I'm ready to chat with you."));
                }
            }
            yield break;
        }

        // Process math game related commands
        if (processedText.Contains("let play math game") || processedText.Contains("let play game") ||
            processedText.Contains("let's play math game") || processedText.Contains("let's play game") ||
            processedText.Contains("time to play") || processedText.Contains("let's play math") ||
            processedText.Contains("lets play math") || processedText.Contains("play math")) 
        {
            Vector3 playerPosition = player.position;
            playerPosition.y = 0;
            dog.MathGameSetup(playerPosition, "let play math game");
        }
        else if (processedText.Contains("are you ready"))
        {
            Vector3 playerPosition = player.position;
            playerPosition.y = 0;
            dog.MathGameSetup(playerPosition, "are you ready");
        }
        else if (processedText.Contains("let go") || processedText.Contains("let's go"))
        {
            Vector3 playerPosition = player.position;
            playerPosition.y = 0;
            dog.MathGameSetup(playerPosition, "let go");
        }
        else if (processedText.Contains("incorrect") || processedText.Contains("wrong") 
            || processedText.Contains("very close") || processedText.Contains("still wrong")
            || processedText.Contains("it's close") || processedText.Contains("its close")
            || processedText.Contains("it close") || processedText.Contains("oh boy"))
        {
            dog.DogIncorrectMathRespond();
        }
        else if (processedText.Contains("correct") || processedText.Contains("good boy")
                || processedText.Contains("good job") || processedText.Contains("smart"))
        {
            dog.DogCorrectMathRespond();
        }
        else if (processedText.Contains("try again") || processedText.Contains("try it again") ||
                processedText.Contains("one more time") || processedText.Contains("another shot"))
        {
            dog.DogTryPreviousMathProblemAgain();
        }
        else if (processedText.Contains("let take a break") || processedText.Contains("take a break")
                || processedText.Contains("break time"))
        {
            dog.DogEndMathSection();
        }
        else 
        {
            // Check if we're in math game mode
            if (dog != null && dog.isPlayingMath)
            {
                Debug.Log($"Nam11: In math game mode, processing: {processedText}");
                // Existing math expression handling
                string expression = ExtractMathExpression(processedText);
                if (!string.IsNullOrEmpty(expression))
                {
                    Debug.Log($"Nam11: Processing math expression: {expression}");
                    if (dog.predefinedMathExpressions.ContainsKey(expression))
                    {
                        int result = Mathf.Clamp(dog.predefinedMathExpressions[expression], 0, 10);
                        Debug.Log($"Nam11: Found predefined math expression '{expression}' = {result}");
                        dog.MakeDogDoMath(expression);
                    }
                    else
                    {
                        Debug.Log($"Nam11: No predefined answer for expression: {expression}");
                        // Try to calculate the expression
                        try
                        {
                            System.Data.DataTable dt = new System.Data.DataTable();
                            var result = dt.Compute(expression, "");
                            if (result != null)
                            {
                                int answer = Convert.ToInt32(result);
                                Debug.Log($"Nam11: Calculated result: {answer}");
                                dog.MakeDogDoMath(expression);
                            }
                            else
                            {
                                ProcessCommand(processedText);
                            }
                        }
                        catch (Exception e)
                        {
                            Debug.LogError($"Nam11: Error calculating expression: {e.Message}");
                            ProcessCommand(processedText);
                        }
                    }
                }
                else 
                {
                    ProcessCommand(processedText);
                }
            }
            else
            {
                ProcessCommand(processedText);
            }
        }
    }

    private string ExtractMathExpression(string text)
    {
        Debug.Log($"Nam11: Extracting math expression from: {text}");
        
        // Remove common words and keep only the mathematical expression
        string cleanedText = text.ToLower()
                               .Replace("calculate", "")
                               .Replace("what is", "")
                               .Replace("what's", "")
                               .Replace("plus", "+")
                               .Replace("minus", "-")
                               .Replace("times", "*")
                               .Replace("multiply", "*")
                               .Replace("divided by", "/")
                               .Replace("divide", "/")
                               .Trim();

        Debug.Log($"Nam11: After replacing words: {cleanedText}");

        // Remove any non-mathematical characters
        cleanedText = Regex.Replace(cleanedText, @"[^0-9+\-*/().\s]", "");

        Debug.Log($"Nam11: After removing non-math chars: {cleanedText}");

        // If the text contains numbers and operators, it's a math expression
        if (Regex.IsMatch(cleanedText, @"[0-9]") && Regex.IsMatch(cleanedText, @"[+\-*/]"))
        {
            Debug.Log($"Nam11: Found math expression: {cleanedText}");
            return cleanedText;
        }

        // If no math expression found, return the original text
        Debug.Log($"Nam11: No math expression found in: {text}");
        return text;
    }

    private bool ProcessMathExpression(string expression)
    {
        try
        {
            // Create a DataTable to evaluate the expression
            System.Data.DataTable dt = new System.Data.DataTable();
            var result = dt.Compute(expression, "");
            
            if (result != null)
            {
                int answer = Convert.ToInt32(result);
                Debug.Log($"Nam11: Calculated math expression '{expression}' = {answer}");
                dog.MakeDogDoMath(expression);
                if (ttsManager != null)
                {
                    StartCoroutine(ttsManager.ConvertTextToSpeech($"The answer is {answer}!"));
                }
                return true;
            }
        }
        catch (Exception e)
        {
            Debug.LogError($"Nam11: Error calculating math expression: {e.Message}");
        }
        return false;
    }

    private bool ProcessCommand(string text)
    {
        if (text.Contains("sit") || text.Contains("set down") || text.Contains("down"))
        {
            if (dog != null)
            {
                dog.MakeDogSit();
            }
            return true;
        }
        else if (text.Contains("wag")) 
        {
            if (dog != null)
            {
                dog.MakeDogWagTail();
            }
            return true;
        }   
        else if (text.Contains("walk") || text.Contains("go forward")) 
        {
            if (dog != null)
            {
                dog.MakeDogWalk();
            }
            return true;
        }
        else if (text.Contains("go back") || text.Contains("go backward"))
        {
            if (dog != null)
            {
                dog.MakeDogMoveBackward();
            }
            return true;
        }     
        else if (text.Contains("go left"))
        {
            if (dog != null)
            {
                dog.MakeDogMoveLeft();
            }
            return true;
        }
        else if (text.Contains("go right"))
        {
            if (dog != null)
            {
                dog.MakeDogMoveRight();
            }
            return true;
        }
        else if (text.Contains("come here") || text.Contains("back here")) 
        {
            if (dog != null)
            {
                Vector3 playerPosition = player.position;
                Vector3 direction = (playerPosition - transform.position).normalized;
                playerPosition.y = 0f;
                dog.navMeshAgent.stoppingDistance = stoppingDistanceFromPlayer;
                dog.MakeDogComeHere(playerPosition);
            }
            return true;
        }       
        else if (text.Contains("go there") || text.Contains("move there") 
                || text.Contains("there") || text.Contains("over there"))
        {
            if (dog != null)
            {
                dog.MakeDogGoThere(tennisBall);
            }
            return true;
        }
        else if (text.Contains("stop"))
        {
            if (dog != null)
            {
                dog.MakeDogStop();
            }
            return true;
        }
        else if (text.Contains("eat") || text.Contains("go eat") 
                || text.Contains("eating") || text.Contains("time to eat"))
        {
            if (dog != null)
            {
                dog.MakeDogGoEat(curryPlate);
            }
            return true;
        }
        else if (text.Contains("bad boy") || text.ToLower().Contains("stupid dog")
                || text.ToLower().Contains("bad dog")) 
        {
            if (dog != null)
            {
                Vector3 playerPosition = player.position;
                playerPosition.y = 0f;
                dog.MakeDogAngry();
            }
            return true;
        }
        else if (text.Contains("fetch") || text.Contains("get ball")
                || text.Contains("go get ball") || text.Contains("get the ball"))
        {
            if (dog != null)
            {
                dog.MakeDogFetchBall(tennisBall, player);
            }
            return true;
        }
        else if (text.Contains("move ball") || text.Contains("get it again")
                || text.Contains("get ball again") || text.Contains("get the ball again"))
        {
            if (dog != null)
            {
                dog.ThrowBallAndFetch(tennisBall, player);
            }
            return true;
        }
        else if (text.Contains("follow me") || text.Contains("go with me"))
        {
            if (dog != null)
            {
                dog.MakeDogFollowPlayer();
            }
            return true;
        }
        else if (text.Contains("i feel sad") || text.Contains("i'm sad")
                || text.Contains("i feel bad") || text.Contains("i have a bad day"))
        {
            if (dog != null)
            {
                Vector3 playerPosition = player.position;
                playerPosition.y = 0;
                dog.MakeDogComfortMe(playerPosition);
            }
            return true;
        }
        else if (text.Contains("go play") || text.Contains("go playing"))
        {
            if (dog != null)
            {
                dog.MakeDogWander();
            }
            return true;
        }

        return false;
    }

    private IEnumerator ChatTimeoutCoroutine()
    {
        while (Time.time - lastChatTime < chatTimeout)
        {
            yield return null;
        }
        
        if (chatHandler != null && chatHandler.IsChatMode())
        {
            Debug.Log("Chat timeout - ending chat mode");
            chatHandler.EndChat();
            if (ttsManager != null)
            {
                yield return StartCoroutine(ttsManager.ConvertTextToSpeech("I'm ending the chat since there's been no activity for a while."));
            }
        }
    }
}

