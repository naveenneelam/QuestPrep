import React, { useState, useEffect, useRef, useCallback } from 'react';

const WEBSOCKET_URL = "ws://localhost:8000/audiotranscribe"; // Replace with your WebSocket URL
const TARGET_SAMPLE_RATE = 16000;
const AUDIO_WORKLET_PROCESSOR_NAME = 'audio-stream-processor';
const AUDIO_WORKLET_PATH = '/audioprocessor.js'; // Path relative to the public folder

const AudioRecorder = () => {
  const [socket, setSocket] = useState(null);
  const [transcript, setTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false); // For UI feedback during setup
  const [connectionStatus, setConnectionStatus] = useState('disconnected'); // 'disconnected', 'connecting', 'connected', 'error'
  const [error, setError] = useState('');

  const audioContextRef = useRef(null);
  const mediaStreamSourceRef = useRef(null);
  const audioWorkletNodeRef = useRef(null);
  const webSocketRef = useRef(null); // Use ref for socket to avoid stale closures in worklet message handler

  // Debounce function
  const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        func.apply(this, args);
      }, delay);
    };
  };

  const debouncedSetError = useCallback(debounce((message) => setError(message), 500), []);


  // WebSocket setup and teardown
  useEffect(() => {
    if (!isRecording) { // Only establish WebSocket when intending to record or if already connected
        if (webSocketRef.current && webSocketRef.current.readyState !== WebSocket.CLOSED) {
            // If not recording and socket exists, consider closing it or keeping it based on app logic
            // For now, we let it be, to be closed on component unmount or explicit stop.
        }
        return;
    }

    if (webSocketRef.current && webSocketRef.current.readyState === WebSocket.OPEN) {
        // Already connected and recording
        return;
    }

    setConnectionStatus('connecting');
    setError('');
    const ws = new WebSocket(WEBSOCKET_URL);
    ws.binaryType = "arraybuffer"; // Important for sending raw audio

    ws.onopen = () => {
      console.log('WebSocket connection established.');
      setConnectionStatus('connected');
      webSocketRef.current = ws; // Store in ref
      setSocket(ws); // Also in state for potential direct use, though ref is safer for callbacks
    };

    ws.onmessage = (event) => {
      if (typeof event.data === 'string') {
        setTranscript(prev => `${prev} ${event.data}`.trim());
      }
    };

    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
      setConnectionStatus('error');
      setError('WebSocket connection error. Please try again.');
      webSocketRef.current = null;
    };

    ws.onclose = (event) => {
      console.log('WebSocket connection closed:', event.reason, event.code);
      setConnectionStatus('disconnected');
      // Only set error if it was an unexpected close
      if (!event.wasClean && isRecording) { // Check if still in recording state
        setError('WebSocket disconnected unexpectedly.');
      }
      webSocketRef.current = null;
      // If it closes while recording, stop the recording state
      // setIsRecording(false); // This might conflict with user pressing stop. Handled in stopRecording.
    };

    return () => {
      console.log("Cleaning up WebSocket connection.");
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close(1000, "Component unmounting or recording stopped");
      }
      webSocketRef.current = null;
      setSocket(null);
    };
  }, [isRecording]); // Re-run effect if isRecording changes to establish/close connection

  const cleanupAudioResources = useCallback(() => {
    if (mediaStreamSourceRef.current) {
      mediaStreamSourceRef.current.disconnect();
      mediaStreamSourceRef.current = null;
    }
    if (audioWorkletNodeRef.current) {
      audioWorkletNodeRef.current.port.postMessage({ command: 'close' }); // Tell processor to clean up
      audioWorkletNodeRef.current.disconnect();
      audioWorkletNodeRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(e => console.warn("Error closing AudioContext:", e));
      audioContextRef.current = null;
    }
    console.log("Audio resources cleaned up.");
  }, []);


  const startRecording = async () => {
    if (isRecording) return;

    setError('');
    setTranscript(''); // Clear previous transcript
    setIsLoading(true);

    try {
      // 1. Get User Media (Microphone)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { sampleRate: TARGET_SAMPLE_RATE } });

      // 2. Create AudioContext
      const context = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: TARGET_SAMPLE_RATE,
      });
      audioContextRef.current = context;

      // Ensure AudioContext is running
      if (context.state === 'suspended') {
        await context.resume();
      }

      // 3. Add AudioWorklet Module
      try {
        await context.audioWorklet.addModule(AUDIO_WORKLET_PATH);
      } catch (e) {
        console.error('Failed to add AudioWorklet module:', e);
        setError(`Failed to load audio processor. Please check console. Path: ${AUDIO_WORKLET_PATH}`);
        cleanupAudioResources();
        setIsLoading(false);
        return;
      }

      // 4. Create MediaStreamSource
      mediaStreamSourceRef.current = context.createMediaStreamSource(stream);

      // 5. Create AudioWorkletNode
      const workletNode = new AudioWorkletNode(context, AUDIO_WORKLET_PROCESSOR_NAME, {
        processorOptions: {
          sampleRate: context.sampleRate,
          bufferSize: 4096, // Standard buffer size, can be tuned
        }
      });
      audioWorkletNodeRef.current = workletNode;


      // 6. Handle messages (audio data) from AudioWorkletProcessor
      workletNode.port.onmessage = (event) => {
        if (event.data.audioData) {
          if (webSocketRef.current && webSocketRef.current.readyState === WebSocket.OPEN) {
            webSocketRef.current.send(event.data.audioData);
          }
        } else if (event.data.status === 'processor_closed') {
          console.log("AudioWorkletProcessor reported closed.");
        }
      };
      workletNode.port.onmessageerror = (err) => {
        console.error("Error message from AudioWorklet:", err);
        debouncedSetError("Internal audio processing error.");
      };


      // 7. Connect the audio graph: Source -> WorkletNode
      // We don't connect to context.destination unless we want to hear the mic input.
      mediaStreamSourceRef.current.connect(workletNode);
      // If you want to hear the microphone through speakers (usually not for transcription):
      // workletNode.connect(context.destination);

      // 8. Update State
      setIsRecording(true); // This will trigger the useEffect for WebSocket connection
      setConnectionStatus('connecting'); // Explicitly set, though useEffect also does.

    } catch (err) {
      console.error('Error starting recording:', err);
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setError('Microphone access denied. Please allow microphone access in your browser settings.');
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        setError('No microphone found. Please ensure a microphone is connected and enabled.');
      } else {
        setError('Failed to start recording. Please ensure your microphone is working.');
      }
      cleanupAudioResources();
    } finally {
      setIsLoading(false);
    }
  };

  const stopRecording = useCallback(() => {
    setIsRecording(false); // This will also trigger the WebSocket cleanup effect
    cleanupAudioResources();

    // The useEffect for WebSocket will handle closing, but if it was never opened:
    if (webSocketRef.current && webSocketRef.current.readyState !== WebSocket.CLOSED) {
        console.log("Stop recording: explicitly closing WebSocket.");
        webSocketRef.current.close(1000, "User stopped recording");
        webSocketRef.current = null;
    }
    setSocket(null); // Clear state socket
    setConnectionStatus('disconnected'); // Explicitly set status
    console.log("Recording stopped.");
  }, [cleanupAudioResources]);


  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      console.log("AudioRecorder component unmounting.");
      stopRecording(); // Ensure all resources are released
    };
  }, [stopRecording]);


  if (connectionStatus === 'connecting' && !isRecording && !isLoading) {
    // This case might occur if ws fails to connect initially outside of a recording attempt
    // For now, main connection status is driven by the recording attempt.
  }


  return (
    <div style={{ maxWidth: '800px', margin: '20px auto', padding: '20px', fontFamily: 'Arial, sans-serif', color: '#333' }}>
      <h1 style={{ textAlign: 'center', color: '#4A90E2', marginBottom: '30px' }}>Live Audio Transcriber</h1>

      <div style={{ textAlign: 'center', marginBottom: '20px', padding: '15px', background: '#f0f0f0', borderRadius: '8px' }}>
        <h2 style={{ margin: '0 0 10px 0', fontSize: '1.2em' }}>Connection Status</h2>
        <p style={{
          margin: 0,
          fontWeight: 'bold',
          color: connectionStatus === 'connected' ? 'green' : (connectionStatus === 'error' || connectionStatus === 'disconnected' ? 'red' : 'orange')
        }}>
          {connectionStatus.toUpperCase()}
        </p>
      </div>


      {error && (
        <div style={{
          backgroundColor: '#ffdddd', borderLeft: '6px solid #f44336',
          color: '#721c24', padding: '15px', marginBottom: '20px', borderRadius: '4px'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <button
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isLoading}
          style={{
            padding: '15px 30px',
            fontSize: '18px',
            backgroundColor: isRecording ? '#ff4444' : (isLoading ? '#ccc' : '#4CAF50'),
            color: 'white',
            border: 'none',
            borderRadius: '50px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            transition: 'background-color 0.3s ease',
          }}
        >
          {isLoading ? (isRecording ? 'Stopping...' : 'Starting...') : (isRecording ? '⏹ Stop Recording' : '⏺ Start Recording')}
       </button>

      <div style={{
        marginTop: '30px',
        backgroundColor: '#f8f9fa',
        borderRadius: '10px',
        padding: '25px',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.07)'
      }}>
        <h3 style={{ color: '#333', marginBottom: '15px', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
          Live Transcript:
        </h3>
        <div style={{
          minHeight: '200px',
          padding: '20px',
          backgroundColor: 'white',
          borderRadius: '8px',
          border: '1px solid #ddd',
          whiteSpace: 'pre-wrap',
          wordWrap: 'break-word',
          lineHeight: '1.6',
          color: '#555',
          overflowY: 'auto',
          maxHeight: '400px' // Added max height for scrollability
        }}>
          {transcript || <span style={{ color: '#999' }}>Speech will appear here... Press "Start Recording".</span>}
        </div>
      </div>
                    </div>

    </div>
  );
};

export default AudioRecorder;