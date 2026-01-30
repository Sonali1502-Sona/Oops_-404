import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, Dimensions, Linking, TouchableOpacity } from 'react-native';
import { WebView } from 'react-native-webview';
import { Camera } from 'expo-camera';
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';

const { width, height } = Dimensions.get('window');

export default function EyeTrackingScreen() {
  // 1. State Management
  const [mode, setMode] = useState<'SELECT' | 'PC' | 'MOBILE'>('SELECT');
  const [activeView, setActiveView] = useState<'MAIN' | 'MESSAGING' | 'CALLS' | 'CAMERA' | 'AI_MODE'>('MAIN');
  const [cursorPos, setCursorPos] = useState({ x: width / 2, y: height / 2 });
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [layoutMap, setLayoutMap] = useState<{ [key: string]: { x: number, y: number, w: number, h: number } }>({});
  const [aiResponse, setAiResponse] = useState("Ask me anything!");
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);

  // Replace with your actual key (Recommend using .env for production)
  const GEMINI_API_KEY = "AIzaSyBzhCiG_GdDGYdm8blX9DUDimQXWJfB9Wo";

  // 2. Lifecycle & Permissions
  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  // 3. Eye Tracking & Interaction Logic
  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.x !== undefined && data.y !== undefined) {
        setCursorPos({ x: data.x * width, y: data.y * height });
      }
    } catch (e) { console.log("Engine Error:", e); }
  };

  const saveLayout = (id: string, event: any) => {
    const { x, y, width, height } = event.nativeEvent.layout;
    setLayoutMap(prev => ({ ...prev, [id]: { x, y, w: width, h: height } }));
  };

  const isHovered = (id: string) => {
    const layout = layoutMap[id];
    if (!layout) return false;
    const gridYOffset = (height * 0.12) + 30; 
    return (
      cursorPos.x >= layout.x &&
      cursorPos.x <= layout.x + layout.w &&
      cursorPos.y >= layout.y + gridYOffset &&
      cursorPos.y <= layout.y + gridYOffset + layout.h
    );
  };

  // 4. Gemini AI Integration
  const callGeminiWithAudio = async (base64Audio: string) => {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: "Voice message from a paralyzed user. Provide a concise response." },
              { inline_data: { mime_type: "audio/m4a", data: base64Audio } }
            ]
          }]
        })
      });
      const data = await response.json();
      if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
        const resultText = data.candidates[0].content.parts[0].text;
        setAiResponse(resultText);
        Speech.speak(resultText);
      }
    } catch (error) {
      setAiResponse("Network Error.");
    }
  };

  // 5. Tracking Engine HTML (MediaPipe)
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <script src="https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh"></script>
        <script src="https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils"></script>
        <style>body { margin: 0; background: black; overflow: hidden; } video { transform: scaleX(-1); width: 100vw; height: 100vh; object-fit: cover; opacity: 0.3; }</style>
    </head>
    <body>
        <video id="webcam" autoplay playsinline></video>
        <script>
            const video = document.getElementById('webcam');
            const faceMesh = new FaceMesh({locateFile: (file) => \`https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/\${file}\`});
            faceMesh.setOptions({ maxNumFaces: 1, refineLandmarks: true, minDetectionConfidence: 0.5 });
            faceMesh.onResults((results) => {
                if (results.multiFaceLandmarks && results.multiFaceLandmarks[0]) {
                    const nose = results.multiFaceLandmarks[0][1];
                    window.ReactNativeWebView.postMessage(JSON.stringify({ x: 1 - nose.x, y: nose.y }));
                }
            });
            navigator.mediaDevices.getUserMedia({ video: true }).then(stream => {
                video.srcObject = stream;
                const camera = new Camera(video, { onFrame: async () => { await faceMesh.send({image: video}); }, width: 640, height: 480 });
                camera.start();
            });
        </script>
    </body>
    </html>
  `;

  // 6. UI Components
  const renderGridItems = () => {
    const items = [
      { label: 'HOME', color: '#6366f1', id: 'home' },
      { label: 'HELP', color: '#22c55e', id: 'help' },
      { label: 'AI ASSIST', color: '#ef4444', id: 'ai_assist' },
      { label: 'SETTINGS', color: '#f97316', id: 'settings' },
      { label: 'ENTERTAINMENT', color: '#0ea5e9', id: 'ent' },
      { label: 'CAMERA', color: '#8b5cf6', id: 'camera' },
      { label: 'MESSAGING', color: '#ec4899', id: 'msg' },
      { label: 'CALLS', color: '#06b6d4', id: 'calls' },
    ];

    return items.map((item) => (
      <TouchableOpacity
        key={item.id}
        onLayout={(e) => saveLayout(item.id, e)}
        style={[styles.gridBlock, { backgroundColor: item.color }, isHovered(item.id) && styles.hoveredBlock]}
      >
        <Text style={[styles.gridLabel, isHovered(item.id) && styles.hoveredLabel]}>{item.label}</Text>
      </TouchableOpacity>
    ));
  };

  if (mode === 'SELECT') {
    return (
      <View style={styles.selectionContainer}>
        <Text style={styles.title}>QuasarAI - Mode Select</Text>
        <TouchableOpacity style={[styles.modeBtn, {backgroundColor: '#4f46e5'}]} onPress={() => setMode('PC')}>
          <Text style={styles.btnText}>PC Control Mode</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.modeBtn, {backgroundColor: '#059669'}]} onPress={() => setMode('MOBILE')}>
          <Text style={styles.btnText}>Mobile Dashboard</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {mode === 'MOBILE' && (
        <View style={styles.dashboardContainer}>
          <View style={styles.dynamicHeader}><Text style={styles.headerTitle}>ThirdEye AI</Text></View>
          <View style={styles.gridContainer}>{renderGridItems()}</View>
        </View>
      )}
      <WebView 
        originWhitelist={['*']} 
        source={{ html: htmlContent }} 
        style={styles.webViewLayer} 
        onMessage={handleMessage} 
        javaScriptEnabled={true} 
        transparent={true} 
      />
      <View style={[styles.nativeCursor, { left: cursorPos.x, top: cursorPos.y }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  selectionContainer: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#000' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#fff', textAlign: 'center', marginBottom: 30 },
  modeBtn: { padding: 20, borderRadius: 15, marginBottom: 20, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  dashboardContainer: { ...StyleSheet.absoluteFillObject, zIndex: 1 },
  dynamicHeader: { height: height * 0.12, justifyContent: 'center', alignItems: 'center', marginTop: 30 },
  headerTitle: { color: '#6366f1', fontSize: 28, fontWeight: '900' },
  gridContainer: { flex: 1, flexDirection: 'row', flexWrap: 'wrap' },
  gridBlock: { width: '50%', height: '25%', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#444' },
  gridLabel: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  hoveredBlock: { borderColor: '#ffff00', borderWidth: 4, zIndex: 10 },
  hoveredLabel: { color: '#ffff00', fontSize: 18 },
  webViewLayer: { flex: 1, backgroundColor: 'transparent', position: 'absolute', width, height, zIndex: 5 },
  nativeCursor: { position: 'absolute', width: 30, height: 30, borderRadius: 15, backgroundColor: 'red', borderWidth: 2, borderColor: '#fff', zIndex: 999, pointerEvents: 'none', transform: [{ translateX: -15 }, { translateY: -15 }] },
});