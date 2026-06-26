import React, { useState, useEffect, useRef, useCallback } from "react";
import AgoraRTC, {
  IAgoraRTCClient,
  ICameraVideoTrack,
  IMicrophoneAudioTrack,
  IRemoteVideoTrack,
  IRemoteAudioTrack,
  ILocalVideoTrack,
} from "agora-rtc-sdk-ng";
import { api } from "../lib/api.js";
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Monitor,
  MonitorOff,
  PhoneOff,
  Maximize2,
  Minimize2,
  Users,
  Clock,
  Wifi,
  Pin,
  PinOff,
} from "lucide-react";

// Suppress Agora console noise in dev
AgoraRTC.setLogLevel(3);

interface VideoCallProps {
  channelName: string;
  userName: string;
  userRole?: string;
  onLeave: () => void;
}

interface RemoteUser {
  uid: number | string;
  videoTrack?: IRemoteVideoTrack;
  audioTrack?: IRemoteAudioTrack;
  hasVideo: boolean;
  hasAudio: boolean;
}

export default function VideoCall({ channelName, userName, userRole = "student", onLeave }: VideoCallProps) {
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const screenClientRef = useRef<IAgoraRTCClient | null>(null);
  const localVideoRef = useRef<HTMLDivElement>(null);
  const screenVideoRef = useRef<HTMLDivElement>(null);

  // Keep refs that always point to the *current* tracks so the unmount
  // cleanup can release hardware even when React state has gone stale.
  const localVideoTrackRef = useRef<ICameraVideoTrack | null>(null);
  const localAudioTrackRef = useRef<IMicrophoneAudioTrack | null>(null);
  const screenTrackRef = useRef<ILocalVideoTrack | null>(null);
  const screenAudioTrackRef = useRef<ILocalVideoTrack | null>(null);

  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const [localVideoTrack, setLocalVideoTrack] = useState<ICameraVideoTrack | null>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<IMicrophoneAudioTrack | null>(null);
  const [screenTrack, setScreenTrack] = useState<ILocalVideoTrack | null>(null);
  const [screenAudioTrack, setScreenAudioTrack] = useState<ILocalVideoTrack | null>(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [remoteUsers, setRemoteUsers] = useState<RemoteUser[]>([]);
  const [callDuration, setCallDuration] = useState(0);
  const [connectionState, setConnectionState] = useState<string>("DISCONNECTED");
  const [error, setError] = useState<string | null>(null);

  // Name mapping dictionary state
  const [userMap, setUserMap] = useState<Record<number, string>>({});
  // Presentation modes: "float" (PiP over presentation) or "dock" (top of sidebar)
  const [presenterVideoMode, setPresenterVideoMode] = useState<"float" | "dock">("float");
  // Floating PiP position corners
  const [pipPosition, setPipPosition] = useState<"bottom-right" | "bottom-left" | "top-right" | "top-left">("bottom-right");

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load numeric UID-to-name mapping
  useEffect(() => {
    api.agora.getNameMap()
      .then((mapping) => {
        setUserMap(mapping);
      })
      .catch((err) => {
        console.error("Failed to load user name mapping:", err);
      });
  }, []);

  // Duration timer
  useEffect(() => {
    if (joined) {
      timerRef.current = setInterval(() => setCallDuration((d) => d + 1), 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [joined]);

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // Join the Agora channel
  const joinChannel = useCallback(async () => {
    if (joining || joined) return;
    setJoining(true);
    setError(null);

    try {
      // If a stale client is somehow still alive (e.g. HMR / double-mount),
      // tear it down completely before creating a new one so the camera/mic
      // are released first.
      if (clientRef.current) {
        try {
          localVideoTrackRef.current?.close();
          localAudioTrackRef.current?.close();
          localVideoTrackRef.current = null;
          localAudioTrackRef.current = null;
          await clientRef.current.leave();
        } catch (_) { /* ignore cleanup errors */ }
        clientRef.current = null;
      }

      // Fetch token from backend
      const { token, uid, appId } = await api.agora.getToken(channelName);

      const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
      clientRef.current = client;

      // Connection state listener
      client.on("connection-state-change", (curState) => {
        setConnectionState(curState);
      });

      // Remote user events
      client.on("user-published", async (user, mediaType) => {
        await client.subscribe(user, mediaType);

        setRemoteUsers((prev) => {
          const existing = prev.find((u) => u.uid === user.uid);
          if (existing) {
            return prev.map((u) =>
              u.uid === user.uid
                ? {
                    ...u,
                    videoTrack: mediaType === "video" ? user.videoTrack : u.videoTrack,
                    audioTrack: mediaType === "audio" ? user.audioTrack : u.audioTrack,
                    hasVideo: mediaType === "video" ? true : u.hasVideo,
                    hasAudio: mediaType === "audio" ? true : u.hasAudio,
                  }
                : u
            );
          }
          return [
            ...prev,
            {
              uid: user.uid,
              videoTrack: mediaType === "video" ? user.videoTrack : undefined,
              audioTrack: mediaType === "audio" ? user.audioTrack : undefined,
              hasVideo: mediaType === "video",
              hasAudio: mediaType === "audio",
            },
          ];
        });

        if (mediaType === "audio" && user.audioTrack) {
          user.audioTrack.play();
        }
      });

      client.on("user-unpublished", (user, mediaType) => {
        setRemoteUsers((prev) =>
          prev.map((u) =>
            u.uid === user.uid
              ? {
                  ...u,
                  videoTrack: mediaType === "video" ? undefined : u.videoTrack,
                  audioTrack: mediaType === "audio" ? undefined : u.audioTrack,
                  hasVideo: mediaType === "video" ? false : u.hasVideo,
                  hasAudio: mediaType === "audio" ? false : u.hasAudio,
                }
              : u
          )
        );
      });

      client.on("user-left", (user) => {
        setRemoteUsers((prev) => prev.filter((u) => u.uid !== user.uid));
      });

      // Join the channel
      await client.join(appId, channelName, token, uid);

      // Create and publish local tracks
      const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks(
        {},
        { encoderConfig: "720p_2" }
      );

      await client.publish([audioTrack, videoTrack]);

      // Keep refs in sync so unmount cleanup can always find the tracks
      localAudioTrackRef.current = audioTrack;
      localVideoTrackRef.current = videoTrack;

      setLocalAudioTrack(audioTrack);
      setLocalVideoTrack(videoTrack);
      setJoined(true);

      // Play local video
      if (localVideoRef.current) {
        videoTrack.play(localVideoRef.current, { fit: "contain" });
      }
    } catch (err: any) {
      console.error("Failed to join Agora channel:", err);
      setError(
        err?.message || "Failed to join video call. Please check your camera/microphone permissions."
      );
    } finally {
      setJoining(false);
    }
  }, [channelName, joined, joining]);

  // Leave the channel
  const leaveChannel = useCallback(async () => {
    try {
      // Stop screen share if active
      if (screenTrack) {
        if (screenClientRef.current) {
          const sClient = screenClientRef.current;
          await sClient.unpublish(screenTrack);
          if (screenAudioTrack) await sClient.unpublish(screenAudioTrack);
          await sClient.leave();
          screenClientRef.current = null;
        }
        screenTrack.close();
        if (screenAudioTrack) screenAudioTrack.close();
        setScreenTrack(null);
        setScreenAudioTrack(null);
        setIsScreenSharing(false);
      }

      // Close local tracks — use refs so we always get the live instances
      if (localVideoTrackRef.current) {
        localVideoTrackRef.current.close();
        localVideoTrackRef.current = null;
        setLocalVideoTrack(null);
      }
      if (localAudioTrackRef.current) {
        localAudioTrackRef.current.close();
        localAudioTrackRef.current = null;
        setLocalAudioTrack(null);
      }

      // Leave the channel
      if (clientRef.current) {
        await clientRef.current.leave();
        clientRef.current = null;
      }

      setJoined(false);
      setRemoteUsers([]);
      setCallDuration(0);
      onLeave();
    } catch (err) {
      console.error("Error leaving channel:", err);
      onLeave();
    }
  }, [screenTrack, screenAudioTrack, onLeave]);

  // Toggle camera
  const toggleCamera = useCallback(async () => {
    if (localVideoTrack) {
      await localVideoTrack.setEnabled(!isCameraOn);
      setIsCameraOn(!isCameraOn);
    }
  }, [localVideoTrack, isCameraOn]);

  // Toggle microphone
  const toggleMic = useCallback(async () => {
    if (localAudioTrack) {
      await localAudioTrack.setEnabled(!isMicOn);
      setIsMicOn(!isMicOn);
    }
  }, [localAudioTrack, isMicOn]);

  // Start/Stop screen sharing (for PowerPoint presentations)
  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing && screenClientRef.current && screenTrack) {
      // Stop sharing
      const sClient = screenClientRef.current;
      await sClient.unpublish(screenTrack);
      if (screenAudioTrack) await sClient.unpublish(screenAudioTrack);
      screenTrack.close();
      if (screenAudioTrack) screenAudioTrack.close();
      await sClient.leave();
      screenClientRef.current = null;
      setScreenTrack(null);
      setScreenAudioTrack(null);
      setIsScreenSharing(false);
    } else {
      try {
        // Fetch new token specifically for the screen share UID
        const { token, uid, appId } = await api.agora.getToken(channelName, true);
        
        // Initialize Secondary Client
        const sClient = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
        screenClientRef.current = sClient;
        await sClient.join(appId, channelName, token, uid);

        // Create screen video track
        const screenTracks = await AgoraRTC.createScreenVideoTrack(
          { encoderConfig: "1080p_2" },
          "auto"
        );

        let videoTrack: ILocalVideoTrack;
        let audioTrack: any = null;
        if (Array.isArray(screenTracks)) {
          [videoTrack, audioTrack] = screenTracks;
        } else {
          videoTrack = screenTracks;
        }

        // Listen for browser native "Stop sharing" button
        videoTrack.on("track-ended", async () => {
          if (screenClientRef.current) {
            await screenClientRef.current.unpublish(videoTrack);
            if (audioTrack) await screenClientRef.current.unpublish(audioTrack);
            await screenClientRef.current.leave();
            screenClientRef.current = null;
          }
          videoTrack.close();
          if (audioTrack) audioTrack.close();
          setScreenTrack(null);
          setScreenAudioTrack(null);
          setIsScreenSharing(false);
        });

        const tracksToPublish: ILocalVideoTrack[] = [videoTrack];
        if (audioTrack) tracksToPublish.push(audioTrack);
        await sClient.publish(tracksToPublish);

        screenTrackRef.current = videoTrack;
        screenAudioTrackRef.current = audioTrack;
        setScreenTrack(videoTrack);
        setScreenAudioTrack(audioTrack);
        setIsScreenSharing(true);

        // Play screen share in the preview element
        if (screenVideoRef.current) {
          videoTrack.play(screenVideoRef.current, { fit: "contain" });
        }
      } catch (err: any) {
        if (err?.code !== "PERMISSION_DENIED") {
          console.error("Screen sharing failed:", err);
          if (screenClientRef.current) {
            screenClientRef.current.leave();
            screenClientRef.current = null;
          }
        }
      }
    }
  }, [isScreenSharing, screenTrack, screenAudioTrack, channelName]);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true));
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false));
    }
  }, []);

  // Render remote video
  useEffect(() => {
    remoteUsers.forEach((user) => {
      if (user.videoTrack) {
        const el = document.getElementById(`remote-video-${user.uid}`);
        if (el) {
          user.videoTrack.play(el, { fit: "contain" });
        }
      }
    });
  }, [remoteUsers, presenterVideoMode, pipPosition, isScreenSharing]);

  // Play local video when the ref becomes available
  useEffect(() => {
    if (localVideoTrack && localVideoRef.current) {
      localVideoTrack.play(localVideoRef.current, { fit: "contain" });
    }
  }, [localVideoTrack]);

  // Cleanup on unmount — uses refs (not state) so we always close the
  // actual live hardware tracks regardless of render order.
  useEffect(() => {
    return () => {
      // Release media devices immediately
      localVideoTrackRef.current?.close();
      localAudioTrackRef.current?.close();
      screenTrackRef.current?.close();
      screenAudioTrackRef.current?.close();
      localVideoTrackRef.current = null;
      localAudioTrackRef.current = null;
      screenTrackRef.current = null;
      screenAudioTrackRef.current = null;

      // Leave Agora channels
      if (screenClientRef.current) {
        screenClientRef.current.leave().catch(() => {});
        screenClientRef.current = null;
      }
      if (clientRef.current) {
        clientRef.current.leave().catch(() => {});
        clientRef.current = null;
      }
    };
  }, []);

  // Pre-join screen
  if (!joined && !joining) {
    return (
      <div className="fixed inset-0 z-[200] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg p-6 text-center space-y-5 animate-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="space-y-2">
            <div className="mx-auto w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/25">
              <Video className="h-7 w-7 text-white" />
            </div>
            <h2 className="text-lg font-extrabold text-slate-900">Video Call Session</h2>
            <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
              You are about to join a live video supervision call. Ensure your camera and microphone are ready.
            </p>
          </div>

          {/* Channel info */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-left space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Meeting Room</span>
              <span className="text-[10px] font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{channelName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Your Name</span>
              <span className="text-xs font-bold text-slate-800">{userName}</span>
            </div>
          </div>

          {/* Error display */}
          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-left">
              <p className="text-xs text-rose-700 font-semibold">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={onLeave}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={joinChannel}
              className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs rounded-lg transition cursor-pointer shadow-lg shadow-blue-500/25 flex items-center gap-2"
            >
              <Video className="h-4 w-4" />
              <span>Join Call</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Joining screen
  if (joining) {
    return (
      <div className="fixed inset-0 z-[200] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full border-4 border-blue-500/30 border-t-blue-500 animate-spin" />
          <p className="text-white font-bold text-sm">Connecting to video session...</p>
          <p className="text-slate-400 text-xs">Requesting camera & microphone access</p>
        </div>
      </div>
    );
  }

  const remoteScreenUser = remoteUsers.find(u => typeof u.uid === "number" && u.uid > 100000);
  const standardRemoteUsers = remoteUsers.filter(u => typeof u.uid !== "number" || u.uid <= 100000);

  // Presenter identification helpers
  const presenterUid = remoteScreenUser
    ? (typeof remoteScreenUser.uid === "number" ? remoteScreenUser.uid - 100000 : null)
    : (isScreenSharing ? "local" : null);

  const isLocalPresenter = presenterUid === "local";

  // Name map mapping helper
  const getUserDisplayName = (uid: number | string) => {
    if (uid === "local" || uid === undefined) {
      return `${userName} (You)`;
    }
    const numUid = typeof uid === "string" ? parseInt(uid) : uid;
    if (userMap[numUid]) {
      return userMap[numUid];
    }
    return `Participant ${uid}`;
  };

  // Remote presenter's camera user object (if a remote user is presenting)
  const remotePresenterUser = presenterUid && typeof presenterUid === "number"
    ? standardRemoteUsers.find((u) => u.uid === presenterUid)
    : null;

  // Other participants list (non-presenters)
  const otherRemoteParticipants = presenterUid && typeof presenterUid === "number"
    ? standardRemoteUsers.filter((u) => u.uid !== presenterUid)
    : standardRemoteUsers;

  const renderPipControls = () => {
    return (
      <div className="absolute inset-0 bg-slate-950/70 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-between p-2.5 z-20">
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-bold text-slate-300 uppercase tracking-wide bg-slate-900/80 px-2 py-0.5 rounded">
            Presenter View
          </span>
          <button
            onClick={() => setPresenterVideoMode("dock")}
            className="p-1 bg-slate-800 hover:bg-slate-700 text-white rounded transition cursor-pointer shadow"
            title="Dock to Sidebar"
          >
            <Pin className="h-3.5 w-3.5" />
          </button>
        </div>
        
        {/* Corner navigation controls */}
        <div className="space-y-1">
          <p className="text-[9px] text-slate-400 font-bold text-center">Move Window</p>
          <div className="grid grid-cols-2 gap-1 max-w-[110px] mx-auto">
            <button
              onClick={() => setPipPosition("top-left")}
              className={`py-0.5 px-1.5 text-[9px] rounded border transition cursor-pointer font-bold ${
                pipPosition === "top-left"
                  ? "bg-blue-600 border-blue-500 text-white font-extrabold"
                  : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
              }`}
            >
              TL
            </button>
            <button
              onClick={() => setPipPosition("top-right")}
              className={`py-0.5 px-1.5 text-[9px] rounded border transition cursor-pointer font-bold ${
                pipPosition === "top-right"
                  ? "bg-blue-600 border-blue-500 text-white font-extrabold"
                  : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
              }`}
            >
              TR
            </button>
            <button
              onClick={() => setPipPosition("bottom-left")}
              className={`py-0.5 px-1.5 text-[9px] rounded border transition cursor-pointer font-bold ${
                pipPosition === "bottom-left"
                  ? "bg-blue-600 border-blue-500 text-white font-extrabold"
                  : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
              }`}
            >
              BL
            </button>
            <button
              onClick={() => setPipPosition("bottom-right")}
              className={`py-0.5 px-1.5 text-[9px] rounded border transition cursor-pointer font-bold ${
                pipPosition === "bottom-right"
                  ? "bg-blue-600 border-blue-500 text-white font-extrabold"
                  : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
              }`}
            >
              BR
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderPresenterCard = (isFloating: boolean = false) => {
    const cardClass = isFloating
      ? `pip-overlay ${
          pipPosition === "bottom-right"
            ? "pip-bottom-right"
            : pipPosition === "bottom-left"
            ? "pip-bottom-left"
            : pipPosition === "top-right"
            ? "pip-top-right"
            : "pip-top-left"
        } border-2 border-blue-500/80 bg-slate-950/95 backdrop-blur-md transition-all duration-300 shadow-2xl group`
      : "relative bg-slate-900 rounded-xl overflow-hidden border-2 border-blue-500/80 shrink-0 w-full h-40 lg:h-44 transition-all duration-300 shadow-lg shadow-blue-500/10 presenter-glow flex flex-col justify-between";

    if (isLocalPresenter) {
      return (
        <div className={cardClass}>
          <div ref={localVideoRef} className="w-full h-full object-cover" />
          {!isCameraOn && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
              <div className="text-center space-y-1">
                <div className="mx-auto w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center">
                  <span className="text-sm font-extrabold text-slate-400">
                    {userName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <p className="text-[9px] text-slate-500 font-bold">Camera Off</p>
              </div>
            </div>
          )}
          <div className="absolute bottom-1.5 left-1.5 bg-blue-600/90 backdrop-blur-sm rounded px-2 py-0.5 shadow-sm">
            <span className="text-[9px] font-bold text-white flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              Presenter: {userName} (You)
            </span>
          </div>
          <div className="absolute top-1.5 right-1.5 flex gap-1 items-center">
            {!isFloating && (
              <button
                onClick={() => setPresenterVideoMode("float")}
                className="p-1 bg-slate-800/80 hover:bg-slate-700 text-white rounded transition cursor-pointer shadow-sm"
                title="Float over Presentation"
              >
                <PinOff className="h-3 w-3" />
              </button>
            )}
            {!isMicOn && (
              <div className="bg-rose-500/90 rounded-full p-1 shadow-sm">
                <MicOff className="h-2.5 w-2.5 text-white" />
              </div>
            )}
          </div>
          {isFloating && renderPipControls()}
        </div>
      );
    }

    // Remote presenter rendering
    return (
      <div className={cardClass}>
        {remotePresenterUser && remotePresenterUser.hasVideo ? (
          <div id={`remote-video-${remotePresenterUser.uid}`} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-slate-950">
            <div className="text-center space-y-2">
              <div className="mx-auto w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center">
                <Users className="h-5 w-5 text-slate-400" />
              </div>
              <p className="text-[9px] text-slate-500 font-bold">Camera Off (Presenter)</p>
            </div>
          </div>
        )}
        <div className="absolute bottom-1.5 left-1.5 bg-blue-600/90 backdrop-blur-sm rounded px-2 py-0.5 shadow-sm">
          <span className="text-[9px] font-bold text-white flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Presenter: {presenterUid ? getUserDisplayName(presenterUid) : "Loading..."}
          </span>
        </div>
        <div className="absolute top-1.5 right-1.5 flex gap-1 items-center">
          {!isFloating && (
            <button
              onClick={() => setPresenterVideoMode("float")}
              className="p-1 bg-slate-800/80 hover:bg-slate-700 text-white rounded transition cursor-pointer shadow-sm"
              title="Float over Presentation"
            >
              <PinOff className="h-3 w-3" />
            </button>
          )}
          {(!remotePresenterUser || !remotePresenterUser.hasAudio) && (
            <div className="bg-rose-500/90 rounded-full p-1 shadow-sm">
              <MicOff className="h-2.5 w-2.5 text-white" />
            </div>
          )}
        </div>
        {isFloating && renderPipControls()}
      </div>
    );
  };

  const renderOtherParticipants = () => {
    const list: React.ReactNode[] = [];

    // 1. Render local video if local user is NOT the presenter
    if (!isLocalPresenter) {
      list.push(
        <div
          key="local-participant"
          className="relative bg-slate-900 rounded-xl overflow-hidden border border-slate-700 shrink-0 w-36 h-24 lg:w-full lg:h-24 transition-all duration-300 hover:border-blue-500/50 video-transition-card"
        >
          <div ref={localVideoRef} className="w-full h-full object-cover" />
          {!isCameraOn && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
              <div className="text-center space-y-1">
                <div className="mx-auto w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center">
                  <span className="text-sm font-extrabold text-slate-400">
                    {userName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <p className="text-[9px] text-slate-500 font-bold">Camera Off</p>
              </div>
            </div>
          )}
          <div className="absolute bottom-1.5 left-1.5 bg-slate-950/80 backdrop-blur-sm rounded px-2 py-0.5">
            <span className="text-[9px] font-bold text-white">{userName} (You)</span>
          </div>
          <div className="absolute top-1.5 right-1.5">
            {!isMicOn && (
              <div className="bg-rose-500/80 rounded-full p-0.5">
                <MicOff className="h-2.5 w-2.5 text-white" />
              </div>
            )}
          </div>
        </div>
      );
    }

    // 2. Render all other remote participants
    otherRemoteParticipants.forEach((user) => {
      list.push(
        <div
          key={user.uid}
          className="relative bg-slate-900 rounded-xl overflow-hidden border border-slate-700 shrink-0 w-36 h-24 lg:w-full lg:h-24 transition-all duration-300 hover:border-blue-500/50 video-transition-card"
        >
          {user.hasVideo ? (
            <div id={`remote-video-${user.uid}`} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center space-y-1">
                <div className="mx-auto w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center">
                  <Users className="h-5 w-5 text-slate-500" />
                </div>
                <p className="text-[9px] text-slate-500 font-bold">Camera Off</p>
              </div>
            </div>
          )}
          <div className="absolute bottom-1.5 left-1.5 bg-slate-950/80 backdrop-blur-sm rounded px-2 py-0.5 flex items-center gap-1">
            <Wifi className="h-2.5 w-2.5 text-emerald-400" />
            <span className="text-[9px] font-bold text-white">{getUserDisplayName(user.uid)}</span>
          </div>
          <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5">
            {!user.hasAudio && (
              <div className="bg-rose-500/80 rounded-full p-0.5">
                <MicOff className="h-2.5 w-2.5 text-white" />
              </div>
            )}
          </div>
        </div>
      );
    });

    return list;
  };

  // Main call UI
  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[200] bg-slate-950 flex flex-col"
    >
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/80 backdrop-blur-sm border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${connectionState === "CONNECTED" ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {connectionState === "CONNECTED" ? "Live" : connectionState}
            </span>
          </div>
          <div className="h-4 w-px bg-slate-700" />
          <div className="flex items-center gap-1.5 text-slate-400">
            <Clock className="h-3.5 w-3.5" />
            <span className="text-xs font-mono font-bold">{formatDuration(callDuration)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-800 rounded-lg px-2.5 py-1">
            <Users className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-xs font-bold text-slate-300">{remoteUsers.length + 1}</span>
          </div>
          <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-800 px-2 py-1 rounded-lg truncate max-w-[160px]">
            {channelName}
          </span>
        </div>
      </div>

      {/* Video Grid — Presentation-aware responsive layout */}
      <div className="flex-1 p-3 overflow-hidden">
        {(isScreenSharing || remoteScreenUser) ? (
          /* ========== PRESENTATION MODE LAYOUT ========== */
          <div className="h-full flex flex-col lg:flex-row gap-3 relative">
            {/* Primary presentation area — takes most of the space */}
            <div className="flex-1 min-h-0 relative bg-slate-900 rounded-xl overflow-hidden">
              {/* Local Screen Share */}
              {isScreenSharing && !remoteScreenUser && (
                <div className="w-full h-full relative bg-slate-900 rounded-xl overflow-hidden border border-blue-500/30 shadow-2xl shadow-blue-500/10 transition-all duration-500">
                  <div ref={screenVideoRef} className="w-full h-full" />
                  <div className="absolute top-4 left-4 bg-gradient-to-r from-blue-600 to-indigo-600 shadow-xl rounded-full px-4 py-1.5 flex items-center gap-2 z-10">
                    <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                    <Monitor className="h-3.5 w-3.5 text-white" />
                    <span className="text-[10px] font-bold text-white uppercase tracking-wider">You are presenting</span>
                  </div>
                </div>
              )}

              {/* Remote Screen Share */}
              {remoteScreenUser && (
                <div className="w-full h-full relative bg-slate-900 rounded-xl overflow-hidden border-2 border-indigo-500 shadow-2xl shadow-indigo-500/20 transition-all duration-500">
                  {remoteScreenUser.hasVideo ? (
                    <div id={`remote-video-${remoteScreenUser.uid}`} className="w-full h-full" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="text-center space-y-3 animate-pulse">
                        <Monitor className="mx-auto h-14 w-14 text-slate-500" />
                        <p className="text-xs text-slate-500 font-bold">Presentation Loading...</p>
                      </div>
                    </div>
                  )}
                  <div className="absolute top-4 left-4 bg-gradient-to-r from-indigo-600 to-violet-600 shadow-xl rounded-full px-4 py-1.5 flex items-center gap-2 z-10">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <Monitor className="h-3.5 w-3.5 text-white" />
                    <span className="text-[10px] font-bold text-white uppercase tracking-wider">Now Presenting</span>
                  </div>
                </div>
              )}

              {/* Render floating presenter's video */}
              {presenterVideoMode === "float" && presenterUid && renderPresenterCard(true)}
            </div>

            {/* Participants sidebar strip — scrollable thumbnails */}
            <div className="lg:w-52 xl:w-60 flex lg:flex-col gap-2 overflow-x-auto lg:overflow-y-auto lg:overflow-x-hidden shrink-0 pb-1 lg:pb-0 lg:pr-1">
              {/* Render docked presenter's video (if docked) */}
              {presenterVideoMode === "dock" && presenterUid && (
                <div className="shrink-0 w-36 lg:w-full">
                  {renderPresenterCard(false)}
                </div>
              )}

              {/* Standard participant thumbnails */}
              {renderOtherParticipants()}

              {/* Waiting state in sidebar */}
              {otherRemoteParticipants.length === 0 && !isLocalPresenter && (
                <div className="flex items-center justify-center bg-slate-900/50 rounded-xl border border-dashed border-slate-700 shrink-0 w-36 h-24 lg:w-full lg:h-24">
                  <div className="text-center p-2">
                    <Users className="mx-auto h-5 w-5 text-slate-600 mb-1" />
                    <p className="text-[9px] text-slate-500 font-bold leading-tight">
                      {userRole === "supervisor" ? "Waiting for\nstudents..." : "Waiting for\nparticipants..."}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ========== NORMAL GRID LAYOUT (no presentation) ========== */
          <div className={`h-full grid gap-3 overflow-y-auto pr-1 ${
            standardRemoteUsers.length === 0
              ? "grid-cols-1"
              : standardRemoteUsers.length <= 1
                ? "grid-cols-1 lg:grid-cols-2"
                : "grid-cols-2 lg:grid-cols-3 auto-rows-[220px] lg:auto-rows-[280px]"
          }`}>
            {/* Local video (Camera) — full grid tile */}
            <div className="relative bg-slate-900 rounded-xl overflow-hidden border border-slate-800 transition-all duration-300 min-h-[200px]">
              <div
                ref={localVideoRef}
                className="w-full h-full min-h-[200px]"
              />
              {!isCameraOn && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
                  <div className="text-center space-y-2">
                    <div className="mx-auto w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center">
                      <span className="text-2xl font-extrabold text-slate-400">{userName.charAt(0).toUpperCase()}</span>
                    </div>
                    <p className="text-xs text-slate-500 font-bold">Camera Off</p>
                  </div>
                </div>
              )}
              <div className="absolute bottom-3 left-3 bg-slate-950/80 backdrop-blur-sm rounded-lg px-3 py-1.5">
                <span className="text-[10px] font-bold text-white">{userName} (You)</span>
              </div>
            </div>

            {/* Remote users (Cameras) — full grid tiles */}
            {standardRemoteUsers.map((user) => (
              <div key={user.uid} className="relative bg-slate-900 rounded-xl overflow-hidden border border-slate-800 transition-all duration-300 min-h-[200px]">
                {user.hasVideo ? (
                  <div id={`remote-video-${user.uid}`} className="w-full h-full min-h-[200px]" />
                ) : (
                  <div className="w-full h-full min-h-[200px] flex items-center justify-center">
                    <div className="text-center space-y-2">
                      <div className="mx-auto w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center">
                        <Users className="h-7 w-7 text-slate-500" />
                      </div>
                      <p className="text-xs text-slate-500 font-bold">Camera Off</p>
                    </div>
                  </div>
                )}
                <div className="absolute bottom-3 left-3 bg-slate-950/80 backdrop-blur-sm rounded-lg px-3 py-1.5 flex items-center gap-2">
                  <Wifi className="h-3 w-3 text-emerald-400" />
                  <span className="text-[10px] font-bold text-white">{getUserDisplayName(user.uid)}</span>
                </div>
                <div className="absolute top-3 right-3 flex items-center gap-1">
                  {!user.hasAudio && (
                    <div className="bg-rose-500/80 rounded-full p-1">
                      <MicOff className="h-3 w-3 text-white" />
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Empty state when waiting for others */}
            {standardRemoteUsers.length === 0 && (
              <div className="flex items-center justify-center bg-slate-900/50 rounded-xl border border-dashed border-slate-700 min-h-[200px]">
                <div className="text-center space-y-3 p-6">
                  <div className="mx-auto w-14 h-14 bg-slate-800 rounded-2xl flex items-center justify-center">
                    <Users className="h-7 w-7 text-slate-500" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-400">
                      {userRole === "supervisor" ? "Awaiting project students..." : "Awaiting meeting participants..."}
                    </p>
                    <p className="text-[11px] text-slate-600 mt-1">
                      {userRole === "supervisor"
                        ? "Share this consultation room code with your assigned project students to connect"
                        : "Share this meeting room code with your supervisor or team members to join"}
                    </p>
                  </div>
                  <div className="bg-slate-800 rounded-lg px-4 py-2 inline-block">
                    <code className="text-xs font-mono font-bold text-blue-400">{channelName}</code>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Control Bar */}
      <div className="shrink-0 px-4 py-3 bg-slate-900/80 backdrop-blur-sm border-t border-slate-800">
        <div className="flex items-center justify-center gap-3">
          {/* Mic toggle */}
          <button
            onClick={toggleMic}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer ${
              isMicOn
                ? "bg-slate-700 hover:bg-slate-600 text-white"
                : "bg-rose-500 hover:bg-rose-600 text-white"
            }`}
            title={isMicOn ? "Mute Microphone" : "Unmute Microphone"}
          >
            {isMicOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </button>

          {/* Camera toggle */}
          <button
            onClick={toggleCamera}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer ${
              isCameraOn
                ? "bg-slate-700 hover:bg-slate-600 text-white"
                : "bg-rose-500 hover:bg-rose-600 text-white"
            }`}
            title={isCameraOn ? "Turn Off Camera" : "Turn On Camera"}
          >
            {isCameraOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </button>

          {/* Screen share */}
          <button
            onClick={toggleScreenShare}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer ${
              isScreenSharing
                ? "bg-blue-500 hover:bg-blue-600 text-white ring-2 ring-blue-400/50"
                : "bg-slate-700 hover:bg-slate-600 text-white"
            }`}
            title={isScreenSharing ? "Stop Screen Share" : "Share Screen (PowerPoint)"}
          >
            {isScreenSharing ? <MonitorOff className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}
          </button>

          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            className="w-12 h-12 rounded-2xl bg-slate-700 hover:bg-slate-600 text-white flex items-center justify-center transition-all cursor-pointer"
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
          </button>

          {/* Divider */}
          <div className="h-8 w-px bg-slate-700 mx-1" />

          {/* Leave call */}
          <button
            onClick={leaveChannel}
            className="w-14 h-12 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center transition-all cursor-pointer shadow-lg shadow-rose-600/30"
            title="Leave Call"
          >
            <PhoneOff className="h-5 w-5" />
          </button>
        </div>

        {/* Screen share hint */}
        {!isScreenSharing && joined && (
          <p className="text-center text-[10px] text-slate-500 mt-2 font-medium">
            💡 Click the <Monitor className="h-3 w-3 inline-block mx-0.5" /> button to share your PowerPoint slides
          </p>
        )}
      </div>
    </div>
  );
}
