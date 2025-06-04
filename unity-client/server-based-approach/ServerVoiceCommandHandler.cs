using UnityEngine;
using UnityEngine.Networking;
using System.Collections;
using System.IO;

public class ServerVoiceCommandHandler : MonoBehaviour
{
    public DogMovement dog;                    // Reference to DogMovement script
    public Transform player;                   // Reference to the player (e.g., XR Rig)
    public Transform tennisBall;               // Reference to the tennis ball object
    public Transform curryPlate;               // Reference to the curry plate object
    public string serverUrl = "https://vsa.fly.dev/speech?userId=testuser"; // Server endpoint
    public string apiKey = "Your API Key";     // API key for server authentication
    public float stoppingDistanceFromPlayer = 0.2f; // Dog stop distance from player

    private AudioClip recording;               // Microphone recording clip
    private const int SAMPLE_RATE = 16000;     // Audio sample rate
    private string micName;                    // Microphone device name
    private AudioSource ttsAudioSource;        // AudioSource for TTS playback
    private string currentMode = "pet";        // Current mode, initialized to "pet"

    void Start()
    {
        // Check microphone availability
        if (Microphone.devices.Length == 0)
        {
            Debug.LogError("Server: No microphone detected.");
            return;
        }

        micName = Microphone.devices[0];
        Debug.Log("Server: Using mic: " + micName);
        recording = Microphone.Start(micName, true, 10, SAMPLE_RATE);

        // Add AudioSource for TTS playback
        ttsAudioSource = gameObject.AddComponent<AudioSource>();
        ttsAudioSource.playOnAwake = false;

        // Begin listening loop
        StartCoroutine(LoopListening());
    }

    IEnumerator LoopListening()
    {
        while (true)
        {
            yield return StartCoroutine(WaitForSpeech());
            yield return StartCoroutine(WaitForSilence());
            yield return StartCoroutine(CaptureAndSendToServer());
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
        while (GetMicVolume() < 0.01f)
        {
            yield return null;
        }
        Debug.Log("Voice detected");
    }

    IEnumerator WaitForSilence()
    {
        float silenceTimer = 0f;

        while (silenceTimer < 1f)
        {
            if (GetMicVolume() < 0.005f)
                silenceTimer += Time.deltaTime;
            else
                silenceTimer = 0f;

            yield return null;
        }
    }

    IEnumerator CaptureAndSendToServer()
    {
        int sampleLength = SAMPLE_RATE * 3;
        int micPos = Microphone.GetPosition(micName);
        int startSample = micPos - sampleLength;
        if (startSample < 0) startSample += recording.samples;

        float[] samples = new float[sampleLength];
        recording.GetData(samples, startSample);

        AudioClip trimmed = AudioClip.Create("trimmed", sampleLength, 1, SAMPLE_RATE, false);
        trimmed.SetData(samples, 0);

        byte[] wavData = WavUtility.FromAudioClip(trimmed);
        Debug.Log("WAV bytes length: " + wavData.Length);

        WWWForm form = new WWWForm();
        form.AddBinaryData("audio", wavData, "voice.wav", "audio/wav");
        form.AddField("mode", currentMode);  // Add current mode to the request

        Debug.Log("Server Url:" + serverUrl);
        UnityWebRequest request = UnityWebRequest.Post(serverUrl, form);
        request.SetRequestHeader("x-api-key", apiKey);

        yield return request.SendWebRequest();

        if (request.result != UnityWebRequest.Result.Success)
        {
            Debug.LogError("Server error: " + request.error);
            yield break;
        }

        string json = request.downloadHandler.text;
        Debug.Log("Raw JSON Response:\n" + json);

        HandleServerResponse(json);
    }

    void HandleServerResponse(string json)
    {
        var res = JsonUtility.FromJson<ServerResponse>(json);
        Debug.Log("Voice command action: " + res.action + ", Intent: " + res.intent);

        // If intent is "ignore", do nothing and return
        if (res.intent == "ignore")
        {
            Debug.Log("Ignoring command due to 'ignore' intent");
            return;
        }

        // Update mode if nextMode is provided in the response
        if (!string.IsNullOrEmpty(res.nextMode))
        {
            currentMode = res.nextMode;
            Debug.Log("Mode updated to: " + currentMode);
        }

        // Handle math expressions if they are in the response
        if (!string.IsNullOrEmpty(res.inputText))
        {
            string expression = ExtractMathExpression(res.inputText.ToLower().Trim());
            if (!string.IsNullOrEmpty(expression))
            {
                Debug.Log($"Found math expression: {expression}");
                dog.MakeDogDoMath(expression);
                return;
            }
        }

        switch (res.action)
        {
            case "sit": dog.MakeDogSit(); break;
            case "stop": dog.MakeDogStop(); break;
            case "wag_tail": dog.MakeDogWagTail(); break;
            case "eat": dog.MakeDogGoEat(curryPlate); break;
            case "angry": dog.MakeDogAngry(); break;
            case "come_to_owner":
                Vector3 playerPosition = player.position;
                Vector3 direction = (playerPosition - transform.position).normalized;
                playerPosition.y = 0f;
                dog.navMeshAgent.stoppingDistance = stoppingDistanceFromPlayer;
                dog.MakeDogComeHere(playerPosition);
                break;
            case "comfort_owner": dog.MakeDogComfortMe(player.position); break;
            case "fetch": dog.MakeDogFetchBall(tennisBall, player); break;
            case "walk_forward": dog.MakeDogWalk(); break;
            case "walk_backward": dog.MakeDogMoveBackward(); break;
            case "walk_left": dog.MakeDogMoveLeft(); break;
            case "walk_right": dog.MakeDogMoveRight(); break;
            case "start_math_game":
                dog.MathGameSetup(player.position, res.responseText); break;
            case "correct_answer": dog.DogCorrectMathRespond(); break;
            case "incorrect_answer": dog.DogIncorrectMathRespond(); break;
            case "try_again": dog.DogTryPreviousMathProblemAgain(); break;
            case "end_math_game": dog.DogEndMathSection(); break;
            default: Debug.Log("Server: No recognized action found."); break;
        }

        if (!string.IsNullOrEmpty(res.audioUrl))
        {
            StartCoroutine(PlayTTS(res.audioUrl));
        }
    }

    private string ExtractMathExpression(string text)
    {
        string result = "";
        foreach (string key in dog.predefinedMathExpressions.Keys)
        {
            if (text.Contains(key))
            {
                Debug.Log($"ExtractMathExpression() found: {key}");
                return key;
            }
        }
        return result;
    }

    IEnumerator PlayTTS(string url)
    {
        using (UnityWebRequest www = UnityWebRequestMultimedia.GetAudioClip(url, AudioType.MPEG))
        {
            yield return www.SendWebRequest();

            if (www.result != UnityWebRequest.Result.Success)
            {
                Debug.LogError("Failed to download TTS audio: " + www.error);
                yield break;
            }

            AudioClip clip = DownloadHandlerAudioClip.GetContent(www);
            if (ttsAudioSource.isPlaying)
                ttsAudioSource.Stop();
            ttsAudioSource.clip = clip;
            ttsAudioSource.Play();
        }
    }

    [System.Serializable]
    public class ServerResponse
    {
        public string inputText;      // Changed from originalText
        public string intent;
        public string action;
        public string responseText;
        public string audioUrl;
        public string nextMode;
    }
}
