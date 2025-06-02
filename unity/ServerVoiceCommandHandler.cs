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
    public string apiKey = "BellevueCollegeCapstoneVSA";     // API key for server authentication
    public float stoppingDistanceFromPlayer = 0.2f; // Dog stop distance from player

    private AudioClip recording;               // Microphone recording clip
    private const int SAMPLE_RATE = 16000;     // Audio sample rate
    private string micName;                    // Microphone device name
    private AudioSource ttsAudioSource;        // AudioSource for TTS playback

    void Start()
    {
        // Check microphone availability
        if (Microphone.devices.Length == 0)
        {
            Debug.LogError("No microphone detected.");
            return;
        }

        micName = Microphone.devices[0];
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

    IEnumerator CaptureAndSendToServer()
    {
        // Extract last 3 seconds of audio
        int sampleLength = SAMPLE_RATE * 3;
        int micPos = Microphone.GetPosition(micName);
        int startSample = micPos - sampleLength;
        if (startSample < 0) startSample += recording.samples;

        float[] samples = new float[sampleLength];
        recording.GetData(samples, startSample);

        // Create a trimmed AudioClip
        AudioClip trimmed = AudioClip.Create("trimmed", sampleLength, 1, SAMPLE_RATE, false);
        trimmed.SetData(samples, 0);

        // Convert to WAV byte array
        byte[] wavData = WavUtility.FromAudioClip(trimmed);

        // Create multipart form and send audio to server
        WWWForm form = new WWWForm();
        form.AddBinaryData("audio", wavData, "voice.wav", "audio/wav");

        UnityWebRequest request = UnityWebRequest.Post(serverUrl, form);
        request.SetRequestHeader("x-api-key", apiKey);

        yield return request.SendWebRequest();

        if (request.result != UnityWebRequest.Result.Success)
        {
            Debug.LogError("Server error: " + request.error);
            yield break;
        }

        string json = request.downloadHandler.text;
        Debug.Log("Server Response: " + json);

        HandleServerResponse(json);
    }

    void HandleServerResponse(string json)
    {
        // Parse JSON into response structure
        var res = JsonUtility.FromJson<ServerResponse>(json);
        Debug.Log("Command: " + res.command + ", Intent: " + res.intent);

        // Trigger dog actions based on recognized command
        switch (res.command)
        {
            case "sit_dog": dog.MakeDogSit(); break;
            case "walk_dog": dog.MakeDogWalk(); break;
            case "stop_dog": dog.MakeDogStop(); break;
            case "wag_tail": dog.MakeDogWagTail(); break;
            case "dog_eat": dog.MakeDogGoEat(curryPlate); break;
            case "dog_angry": dog.MakeDogAngry(); break;
            case "dog_comfort": dog.MakeDogComfortMe(player.position); break;
            case "fetch": dog.MakeDogFetchBall(tennisBall, player); break;
            case "move":
                if (res.action == "forward") dog.MakeDogWalk();
                else if (res.action == "backward") dog.MakeDogMoveBackward();
                else if (res.action == "left") dog.MakeDogMoveLeft();
                else if (res.action == "right") dog.MakeDogMoveRight();
                break;
            case "math_game":
            case "math_game_setup":
                dog.MathGameSetup(player.position, res.responseText);
                break;
            case "correct_math_answer": dog.DogCorrectMathRespond(); break;
            case "incorrect_math_answer": dog.DogIncorrectMathRespond(); break;
            case "try_previous_math_problem": dog.DogTryPreviousMathProblemAgain(); break;
            case "end_math_section": dog.DogEndMathSection(); break;
            default:
                Debug.Log("Unrecognized or no command.");
                break;
        }

        // If TTS audio URL is provided, play the audio
        if (!string.IsNullOrEmpty(res.audioUrl))
        {
            StartCoroutine(PlayTTS(res.audioUrl));
        }
    }

    IEnumerator PlayTTS(string url)
    {
        Debug.Log("Fetching TTS audio from: " + url);
        using (UnityWebRequest www = UnityWebRequestMultimedia.GetAudioClip(url, AudioType.MPEG))
        {
            yield return www.SendWebRequest();

            if (www.result != UnityWebRequest.Result.Success)
            {
                Debug.LogError("Failed to download TTS audio: " + www.error);
                yield break;
            }

            // Get the AudioClip and play it
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
        public string originalText;
        public string intent;
        public string command;
        public string category;
        public string action;
        public string description;
        public string responseText;
        public string audioUrl;
    }
}
