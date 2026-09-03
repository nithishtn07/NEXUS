import { useRef, useState, useCallback, useEffect } from 'react';
import { api } from '../lib/api';
import { socketManager } from '../lib/store';

// WebRTC configuration
const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

interface UseWebRTCHook {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMuted: boolean;
  isSpeakerOn: boolean;
  isCameraOn: boolean;
  isFrontCamera: boolean;

  initializeCall: (conversationId: string, callId: string, callType: 'voice' | 'video') => Promise<void>;
  acceptCall: (conversationId: string, callId: string, callType: 'voice' | 'video') => Promise<void>;
  endCall: (conversationId: string, callId: string) => void;
  toggleMute: () => void;
  toggleSpeaker: () => void;
  toggleCamera: () => void;
  switchCamera: () => void;
  cleanup: () => void;
}

export function useWebRTC(): UseWebRTCHook {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const iceServersRef = useRef<RTCIceServer[]>(DEFAULT_ICE_SERVERS);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isFrontCamera, setIsFrontCamera] = useState(true);

  // Load ICE servers from backend
  useEffect(() => {
    loadIceServers();
  }, []);

  const loadIceServers = async () => {
    try {
      const response = await api.getIceServers();
      if (response.success && response.data?.iceServers?.length > 0) {
        iceServersRef.current = response.data.iceServers;
      }
    } catch {
      // Use defaults
    }
  };

  const createPeerConnection = useCallback((conversationId: string, callId: string) => {
    const pc = new RTCPeerConnection({
      iceServers: iceServersRef.current,
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketManager.emitCallIceCandidate(conversationId, callId, event.candidate);
      }
    };

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        remoteStreamRef.current = event.streams[0];
        setRemoteStream(event.streams[0]);
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        endCallInternal(conversationId, callId);
      }
    };

    pcRef.current = pc;
    return pc;
  }, []);

  const getLocalStream = async (callType: 'voice' | 'video'): Promise<MediaStream> => {
    // For React Native, we use the expo-av approach
    // In a real RN WebRTC implementation, you'd use react-native-webrtc
    // For now, we simulate the stream acquisition pattern
    const constraints: MediaStreamConstraints = {
      audio: true,
      video: callType === 'video',
    };

    try {
      // This works in Expo's web target and can be adapted for native
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      setLocalStream(stream);
      return stream;
    } catch (error) {
      console.error('Failed to get local stream:', error);
      throw error;
    }
  };

  const initializeCall = useCallback(async (
    conversationId: string,
    callId: string,
    callType: 'voice' | 'video',
  ) => {
    try {
      const stream = await getLocalStream(callType);
      const pc = createPeerConnection(conversationId, callId);

      // Add local tracks
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Send offer via signaling
      socketManager.emitCallOffer(conversationId, callId, offer);
    } catch (error) {
      console.error('Failed to initialize call:', error);
      cleanup();
      throw error;
    }
  }, [createPeerConnection]);

  const acceptCall = useCallback(async (
    conversationId: string,
    callId: string,
    callType: 'voice' | 'video',
  ) => {
    try {
      const stream = await getLocalStream(callType);
      const pc = createPeerConnection(conversationId, callId);

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });
    } catch (error) {
      console.error('Failed to accept call:', error);
      cleanup();
      throw error;
    }
  }, [createPeerConnection]);

  const handleOffer = useCallback(async (
    conversationId: string,
    callId: string,
    offer: RTCSessionDescriptionInit,
  ) => {
    const pc = pcRef.current;
    if (!pc) return;

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socketManager.emitCallAnswer(conversationId, callId, answer);
    } catch (error) {
      console.error('Failed to handle offer:', error);
    }
  }, []);

  const handleAnswer = useCallback(async (
    _conversationId: string,
    _callId: string,
    answer: RTCSessionDescriptionInit,
  ) => {
    const pc = pcRef.current;
    if (!pc) return;

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (error) {
      console.error('Failed to handle answer:', error);
    }
  }, []);

  const handleIceCandidate = useCallback(async (
    _conversationId: string,
    _callId: string,
    candidate: RTCIceCandidateInit,
  ) => {
    const pc = pcRef.current;
    if (!pc) return;

    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error('Failed to add ICE candidate:', error);
    }
  }, []);

  const endCallInternal = useCallback((conversationId: string, callId: string) => {
    cleanup();
    socketManager.emitCallEnd(conversationId, callId);
  }, []);

  const endCall = useCallback((conversationId: string, callId: string) => {
    endCallInternal(conversationId, callId);
  }, [endCallInternal]);

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMuted((prev) => !prev);
    }
  }, []);

  const toggleSpeaker = useCallback(() => {
    setIsSpeakerOn((prev) => !prev);
    // In React Native, speaker control would use expo-av Audio output mode
  }, []);

  const toggleCamera = useCallback(() => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      videoTracks.forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsCameraOn((prev) => !prev);
    }
  }, []);

  const switchCamera = useCallback(async () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        // React Native WebRTC provides switchCamera on the track
        const track = videoTrack as any;
        if (typeof track.switchCamera === 'function') {
          await track.switchCamera();
          setIsFrontCamera((prev) => !prev);
        } else if (typeof track._switchCamera === 'function') {
          await track._switchCamera();
          setIsFrontCamera((prev) => !prev);
        }
      }
    }
  }, []);

  const cleanup = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    remoteStreamRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setIsMuted(false);
    setIsSpeakerOn(false);
    setIsCameraOn(true);
    setIsFrontCamera(true);
  }, []);

  // Expose handlers for Socket.IO integration
  useEffect(() => {
    const unsubOffer = socketManager.onCallOffer(handleOffer);
    const unsubAnswer = socketManager.onCallAnswer(handleAnswer);
    const unsubIce = socketManager.onCallIceCandidate(handleIceCandidate);

    return () => {
      unsubOffer();
      unsubAnswer();
      unsubIce();
    };
  }, [handleOffer, handleAnswer, handleIceCandidate]);

  return {
    localStream,
    remoteStream,
    isMuted,
    isSpeakerOn,
    isCameraOn,
    isFrontCamera,
    initializeCall,
    acceptCall,
    endCall,
    toggleMute,
    toggleSpeaker,
    toggleCamera,
    switchCamera,
    cleanup,
  };
}
