using UnityEngine;
using UnityEngine.Networking;
using System.Collections;
using System.IO;

public interface ITTSManager
{
    IEnumerator ConvertTextToSpeech(string text);
}

public class TTSManager : MonoBehaviour, ITTSManager
{
    [SerializeField] private string openAIKey = "Your OpenAI Key";
    [SerializeField] private string ttsEndpoint = "https://api.openai.com/v1/audio/speech";
    [SerializeField] private AudioSource audioSource;
    
    private void Start()
    {
        if (audioSource == null)
        {
            audioSource = gameObject.AddComponent<AudioSource>();
        }
    }

    public IEnumerator ConvertTextToSpeech(string text)
    {
        string jsonBody = $@"{{
            ""model"": ""tts-1"",
            ""input"": ""{text}"",
            ""voice"": ""alloy""
        }}";

        using (UnityWebRequest request = new UnityWebRequest(ttsEndpoint, "POST"))
        {
            byte[] bodyRaw = System.Text.Encoding.UTF8.GetBytes(jsonBody);
            request.uploadHandler = new UploadHandlerRaw(bodyRaw);
            request.downloadHandler = new DownloadHandlerBuffer();
            request.SetRequestHeader("Content-Type", "application/json");
            request.SetRequestHeader("Authorization", $"Bearer {openAIKey}");

            yield return request.SendWebRequest();

            if (request.result == UnityWebRequest.Result.Success)
            {
                // Save the audio data to a temporary file
                string tempPath = Path.Combine(Application.temporaryCachePath, "tts_response.mp3");
                File.WriteAllBytes(tempPath, request.downloadHandler.data);

                // Load and play the audio
                using (UnityWebRequest audioRequest = UnityWebRequestMultimedia.GetAudioClip("file://" + tempPath, AudioType.MPEG))
                {
                    yield return audioRequest.SendWebRequest();

                    if (audioRequest.result == UnityWebRequest.Result.Success)
                    {
                        AudioClip clip = DownloadHandlerAudioClip.GetContent(audioRequest);
                        if (audioSource.isPlaying)
                            audioSource.Stop();
                        audioSource.clip = clip;
                        audioSource.Play();
                    }
                    else
                    {
                        Debug.LogError($"Error loading audio: {audioRequest.error}");
                    }
                }

                // Clean up the temporary file
                if (File.Exists(tempPath))
                {
                    File.Delete(tempPath);
                }
            }
            else
            {
                Debug.LogError($"Error: {request.error}");
            }
        }
    }
} 