import { create } from 'zustand';

export type CallState = 'idle' | 'outgoing' | 'incoming' | 'connecting' | 'active' | 'ended';

export interface CallInfo {
  id: string;
  conversationId: string;
  callType: 'voice' | 'video';
  callerId: string;
  callerName: string;
  receiverId?: string;
  state: CallState;
  startedAt?: Date;
  connectedAt?: Date;
  duration: number;
  isMuted: boolean;
  isSpeakerOn: boolean;
  isCameraOn: boolean;
  isFrontCamera: boolean;
}

interface CallStoreState {
  call: CallInfo | null;
  callHistory: any[];

  startCall: (data: {
    callId: string;
    conversationId: string;
    callType: 'voice' | 'video';
    callerId: string;
    callerName: string;
  }) => void;

  receiveCall: (data: {
    callId: string;
    conversationId: string;
    callType: 'voice' | 'video';
    callerId: string;
    callerName: string;
  }) => void;

  acceptCall: () => void;
  declineCall: () => void;
  cancelCall: () => void;
  endCall: () => void;

  setCallState: (state: CallState) => void;
  setMuted: (muted: boolean) => void;
  setSpeaker: (on: boolean) => void;
  setCamera: (on: boolean) => void;
  setFrontCamera: (front: boolean) => void;
  incrementDuration: () => void;
  setCallHistory: (history: any[]) => void;
}

export const useCallStore = create<CallStoreState>((set, get) => ({
  call: null,
  callHistory: [],

  startCall: (data) => {
    set({
      call: {
        id: data.callId,
        ...data,
        state: 'outgoing',
        duration: 0,
        isMuted: false,
        isSpeakerOn: data.callType === 'voice',
        isCameraOn: data.callType === 'video',
        isFrontCamera: true,
        startedAt: new Date(),
      },
    });
  },

  receiveCall: (data) => {
    set({
      call: {
        id: data.callId,
        ...data,
        state: 'incoming',
        duration: 0,
        isMuted: false,
        isSpeakerOn: data.callType === 'voice',
        isCameraOn: data.callType === 'video',
        isFrontCamera: true,
        startedAt: new Date(),
      },
    });
  },

  acceptCall: () => {
    const { call } = get();
    if (call) {
      set({
        call: {
          ...call,
          state: 'connecting',
          connectedAt: new Date(),
        },
      });
    }
  },

  declineCall: () => {
    set({ call: null });
  },

  cancelCall: () => {
    set({ call: null });
  },

  endCall: () => {
    set({ call: null });
  },

  setCallState: (callState) => {
    const { call } = get();
    if (call) {
      set({ call: { ...call, state: callState } });
    }
  },

  setMuted: (muted) => {
    const { call } = get();
    if (call) {
      set({ call: { ...call, isMuted: muted } });
    }
  },

  setSpeaker: (on) => {
    const { call } = get();
    if (call) {
      set({ call: { ...call, isSpeakerOn: on } });
    }
  },

  setCamera: (on) => {
    const { call } = get();
    if (call) {
      set({ call: { ...call, isCameraOn: on } });
    }
  },

  setFrontCamera: (front) => {
    const { call } = get();
    if (call) {
      set({ call: { ...call, isFrontCamera: front } });
    }
  },

  incrementDuration: () => {
    const { call } = get();
    if (call && (call.state === 'active' || call.state === 'connecting')) {
      set({ call: { ...call, duration: call.duration + 1 } });
    }
  },

  setCallHistory: (history) => set({ callHistory: history }),
}));
