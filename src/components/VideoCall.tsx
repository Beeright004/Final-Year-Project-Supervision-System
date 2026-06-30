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
  LayoutGrid,
  Expand,
  Shrink,
  X,
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

type LayoutMode = "grid" | "spotlight" | "presentation";

export default function VideoCall({ channelName, userName, userRole = "student", onLeave }: VideoCallProps) {
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const screenClientRef = useRef<IAgoraRTCClient | null>(null);
  const localVideoRef = useRef<HTMLDivElement>(null);
  const screenVideoRef = useRef<HTMLDivElement>(null);

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

  // Name mapping
  const [userMap, setUserMap] = useState<Record<number, string>>({});

  // Layout & view controls
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("grid");
  // pinnedUid: "local" = local camera, number = remote uid
  const [pinnedUid, setPinnedUid] = useState<"local" | number | null>(null);
  // maximizedUid: uid of the tile currently expanded to fill the main area
  const [maximizedUid, setMaximizedUid] = useState<"local" | number | null>(null);

  // PiP (presenter cam while screen sharing)
  const [pipPosition, setPipPosition] = useState<"bottom-right" | "bottom-left" | "top-right" | "top-left">("bottom-right");
  const [pipDocked, setPipDocked] = useState(false);

  // Sidebar visibility
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load UID→name map
  useEffect(() => {
    api.agora.getNameMap()
      .then(setUserMap)
      .catch((err) => console.error("Failed to load user name mapping:", err));
  }, []);

  // Duration timer
  useEffect(() => {
    if (joined) {
      timerRef.current = setInterval(() => setCallDuration((d) => d + 1), 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [joined]);

  // Listen for native fullscreen changes
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // Auto-switch layout modes
  useEffect(() => {
    if (isScreenSharing || remoteUsers.some(u => typeof u.uid === "number" && u.uid > 100000)) {
      setLayoutMode("presentation");
    } else if (pinnedUid !== null) {
      setLayoutMode("spotlight");
    } else {
      setLayoutMode("grid");
    }
  }, [isScreenSharing, remoteUsers, pinnedUid]);

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const getUserDisplayName = (uid: "local" | number | string) => {
    if (uid === "local") return `${userName} (You)`;
    const numUid = typeof uid === "string" ? parseInt(uid) : uid as number;
    return userMap[numUid] || `Participant ${uid}`;
  };

  // ─── Agora: Join ────────────────────────────────────────────────────────────
  const joinChannel = useCallback(async () => {
    if (joining || joined) return;
    setJoining(true);
    setError(null);

    try {
      if (clientRef.current) {
        try {
          localVideoTrackRef.current?.close();
          localAudioTrackRef.current?.close();
          localVideoTrackRef.current = null;
          localAudioTrackRef.current = null;
          await clientRef.current.leave();
        } catch (_) {}
        clientRef.current = null;
      }

      const { token, uid, appId } = await api.agora.getToken(channelName);
      const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
      clientRef.current = client;

      client.on("connection-state-change", (curState) => setConnectionState(curState));

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
        if (mediaType === "audio" && user.audioTrack) user.audioTrack.play();
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
        setPinnedUid((p) => (p === user.uid ? null : p));
        setMaximizedUid((p) => (p === user.uid ? null : p));
      });

      await client.join(appId, channelName, token, uid);

      const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks(
        {},
        { encoderConfig: "720p_2" }
      );

      await client.publish([audioTrack, videoTrack]);
      localAudioTrackRef.current = audioTrack;
      localVideoTrackRef.current = videoTrack;
      setLocalAudioTrack(audioTrack);
      setLocalVideoTrack(videoTrack);
      setJoined(true);

      if (localVideoRef.current) {
        videoTrack.play(localVideoRef.current, { fit: "contain" });
      }
    } catch (err: any) {
      console.error("Failed to join Agora channel:", err);
      setError(err?.message || "Failed to join video call. Please check your camera/microphone permissions.");
    } finally {
      setJoining(false);
    }
  }, [channelName, joined, joining]);

  // ─── Agora: Leave ───────────────────────────────────────────────────────────
  const leaveChannel = useCallback(async () => {
    try {
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

  // ─── Controls ───────────────────────────────────────────────────────────────
  const toggleCamera = useCallback(async () => {
    if (localVideoTrack) {
      await localVideoTrack.setEnabled(!isCameraOn);
      setIsCameraOn(!isCameraOn);
    }
  }, [localVideoTrack, isCameraOn]);

  const toggleMic = useCallback(async () => {
    if (localAudioTrack) {
      await localAudioTrack.setEnabled(!isMicOn);
      setIsMicOn(!isMicOn);
    }
  }, [localAudioTrack, isMicOn]);

  // Screen share — available to ALL participants
  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing && screenClientRef.current && screenTrack) {
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
        const { token, uid, appId } = await api.agora.getToken(channelName, true);
        const sClient = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
        screenClientRef.current = sClient;
        await sClient.join(appId, channelName, token, uid);

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

  // Browser native fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  // Pin a participant tile
  const togglePin = useCallback((uid: "local" | number) => {
    setPinnedUid((prev) => {
      if (prev === uid) { return null; }
      return uid;
    });
    setMaximizedUid(null);
  }, []);

  // Maximize a single tile to fill main area (local layout only)
  const toggleMaximize = useCallback((uid: "local" | number) => {
    setMaximizedUid((prev) => (prev === uid ? null : uid));
  }, []);

  // Render remote video tracks into DOM elements
  useEffect(() => {
    remoteUsers.forEach((user) => {
      if (user.videoTrack) {
        const el = document.getElementById(`remote-video-${user.uid}`);
        if (el) user.videoTrack.play(el, { fit: "contain" });
      }
    });
  }, [remoteUsers, layoutMode, pipPosition, pipDocked, isScreenSharing, pinnedUid, maximizedUid, sidebarOpen]);

  // Play local video when ref becomes available
  useEffect(() => {
    if (localVideoTrack && localVideoRef.current) {
      localVideoTrack.play(localVideoRef.current, { fit: "contain" });
    }
  }, [localVideoTrack]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      localVideoTrackRef.current?.close();
      localAudioTrackRef.current?.close();
      screenTrackRef.current?.close();
      screenAudioTrackRef.current?.close();
      localVideoTrackRef.current = null;
      localAudioTrackRef.current = null;
      screenTrackRef.current = null;
      screenAudioTrackRef.current = null;
      screenClientRef.current?.leave().catch(() => {});
      screenClientRef.current = null;
      clientRef.current?.leave().catch(() => {});
      clientRef.current = null;
    };
  }, []);

  // ─── Derived data ────────────────────────────────────────────────────────────
  const remoteScreenUser = remoteUsers.find(
    (u) => typeof u.uid === "number" && (u.uid as number) > 100000
  );
  const standardRemoteUsers = remoteUsers.filter(
    (u) => typeof u.uid !== "number" || (u.uid as number) <= 100000
  );

  const isPresenting = isScreenSharing || !!remoteScreenUser;
  const presenterUid = remoteScreenUser
    ? (typeof remoteScreenUser.uid === "number" ? remoteScreenUser.uid - 100000 : null)
    : isScreenSharing ? "local" : null;

  // ─── Pre-join screen ─────────────────────────────────────────────────────────
  if (!joined && !joining) {
    return (
      <div className="fixed inset-0 z-[200] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg p-6 text-center space-y-5">
          <div className="space-y-2">
            <div className="mx-auto w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/25">
              <Video className="h-7 w-7 text-white" />
            </div>
            <h2 className="text-lg font-extrabold text-slate-900">Video Call Session</h2>
            <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
              Join a live video supervision call. Camera, microphone, and screen sharing are available to all participants.
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-left space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Meeting Room</span>
              <span className="text-[10px] font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{channelName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Your Name</span>
              <span className="text-xs font-bold text-slate-800">{userName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Your Role</span>
              <span className="text-xs font-bold text-slate-800 capitalize">{userRole}</span>
            </div>
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-left">
              <p className="text-xs text-rose-700 font-semibold">{error}</p>
            </div>
          )}

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

  // ─── Joining spinner ──────────────────────────────────────────────────────────
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

  // ─── Tile renderer ────────────────────────────────────────────────────────────
  const renderTile = (
    uid: "local" | number,
    opts: {
      videoEl?: React.ReactNode;
      hasVideo: boolean;
      hasAudio: boolean;
      isScreen?: boolean;
      className?: string;
      label?: string;
    }
  ) => {
    const isPinned = pinnedUid === uid;
    const isMaximized = maximizedUid === uid;
    const displayName = uid === "local" ? `${userName} (You)` : getUserDisplayName(uid);

    return (
      <div
        key={uid}
        className={`relative bg-slate-900 rounded-xl overflow-hidden border transition-all duration-300 group
          ${isPinned ? "border-blue-500 ring-2 ring-blue-500/40" : "border-slate-700 hover:border-slate-500"}
          ${opts.className || ""}
        `}
      >
        {/* Video element */}
        {opts.hasVideo ? (
          opts.videoEl
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
            <div className="text-center space-y-2">
              <div className="mx-auto w-14 h-14 bg-slate-800 rounded-full flex items-center justify-center">
                <span className="text-xl font-extrabold text-slate-400">
                  {displayName.charAt(0).toUpperCase()}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 font-bold">Camera Off</p>
            </div>
          </div>
        )}

        {/* Overlay controls — shown on hover */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-between pointer-events-none group-hover:pointer-events-auto z-10">
          {/* Top-right action buttons */}
          <div className="flex justify-end p-2 gap-1.5">
            {/* Pin button */}
            <button
              onClick={() => togglePin(uid)}
              title={isPinned ? "Unpin" : "Pin to spotlight"}
              className="p-1.5 bg-slate-900/80 hover:bg-blue-600 text-white rounded-lg transition cursor-pointer shadow"
            >
              {isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
            </button>
            {/* Maximize button */}
            <button
              onClick={() => toggleMaximize(uid)}
              title={isMaximized ? "Restore" : "Maximize tile"}
              className="p-1.5 bg-slate-900/80 hover:bg-indigo-600 text-white rounded-lg transition cursor-pointer shadow"
            >
              {isMaximized ? <Shrink className="h-3.5 w-3.5" /> : <Expand className="h-3.5 w-3.5" />}
            </button>
          </div>

          {/* Bottom name label */}
          <div className="flex items-center justify-between p-2">
            <div className="flex items-center gap-1.5 bg-slate-950/70 backdrop-blur-sm rounded-lg px-2 py-1">
              <Wifi className="h-2.5 w-2.5 text-emerald-400 shrink-0" />
              <span className="text-[10px] font-bold text-white truncate max-w-[120px]">{displayName}</span>
            </div>
            {!opts.hasAudio && (
              <div className="bg-rose-500/90 rounded-full p-1">
                <MicOff className="h-2.5 w-2.5 text-white" />
              </div>
            )}
          </div>
        </div>

        {/* Always-visible bottom label (non-hover state) */}
        <div className="absolute bottom-2 left-2 group-hover:opacity-0 transition-opacity duration-200 z-[5]">
          <div className="flex items-center gap-1 bg-slate-950/70 backdrop-blur-sm rounded px-2 py-0.5">
            <span className="text-[9px] font-bold text-white truncate max-w-[100px]">{displayName}</span>
          </div>
        </div>

        {/* Pin badge */}
        {isPinned && (
          <div className="absolute top-2 left-2 z-[5]">
            <div className="flex items-center gap-1 bg-blue-600/90 rounded-full px-2 py-0.5">
              <Pin className="h-2.5 w-2.5 text-white" />
              <span className="text-[9px] font-bold text-white">Pinned</span>
            </div>
          </div>
        )}

        {/* Mic-off badge always visible */}
        {!opts.hasAudio && (
          <div className="absolute top-2 right-2 z-[5] group-hover:opacity-0 transition-opacity">
            <div className="bg-rose-500/80 rounded-full p-0.5">
              <MicOff className="h-2.5 w-2.5 text-white" />
            </div>
          </div>
        )}
      </div>
    );
  };

  // ─── Maximized overlay ────────────────────────────────────────────────────────
  const renderMaximizedOverlay = () => {
    if (!maximizedUid) return null;
    const isLocal = maximizedUid === "local";
    const remoteUser = !isLocal ? standardRemoteUsers.find((u) => u.uid === maximizedUid) : null;
    const displayName = isLocal ? `${userName} (You)` : getUserDisplayName(maximizedUid);

    return (
      <div className="absolute inset-0 z-[50] bg-slate-950 rounded-xl overflow-hidden flex flex-col">
        {/* Close maximize */}
        <div className="absolute top-3 right-3 z-[60] flex gap-2">
          <button
            onClick={() => setMaximizedUid(null)}
            className="p-2 bg-slate-800/90 hover:bg-slate-700 text-white rounded-lg transition cursor-pointer shadow flex items-center gap-1.5"
          >
            <Shrink className="h-4 w-4" />
            <span className="text-xs font-bold">Restore</span>
          </button>
        </div>

        {isLocal ? (
          <div ref={localVideoRef} className="w-full h-full" />
        ) : remoteUser?.hasVideo ? (
          <div id={`remote-video-${maximizedUid}`} className="w-full h-full" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center space-y-3">
              <div className="mx-auto w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center">
                <span className="text-3xl font-extrabold text-slate-400">{displayName.charAt(0).toUpperCase()}</span>
              </div>
              <p className="text-sm text-slate-400 font-bold">Camera Off</p>
            </div>
          </div>
        )}

        <div className="absolute bottom-4 left-4 z-[60]">
          <div className="flex items-center gap-2 bg-slate-950/80 backdrop-blur-sm rounded-xl px-3 py-2">
            <Wifi className="h-3 w-3 text-emerald-400" />
            <span className="text-xs font-bold text-white">{displayName}</span>
          </div>
        </div>
      </div>
    );
  };

  // ─── Grid layout ──────────────────────────────────────────────────────────────
  const renderGridLayout = () => {
    const allParticipants: Array<{ uid: "local" | number; user?: RemoteUser }> = [
      { uid: "local" },
      ...standardRemoteUsers.map((u) => ({ uid: u.uid as number, user: u })),
    ];

    // If a tile is pinned → spotlight mode with sidebar
    if (pinnedUid !== null) {
      const pinnedIsLocal = pinnedUid === "local";
      const pinnedRemote = !pinnedIsLocal ? standardRemoteUsers.find((u) => u.uid === pinnedUid) : null;
      const otherParticipants = allParticipants.filter((p) => p.uid !== pinnedUid);

      return (
        <div className="h-full flex gap-3">
          {/* Main pinned tile */}
          <div className="flex-1 min-w-0 relative">
            {maximizedUid && renderMaximizedOverlay()}
            {renderTile(pinnedUid, {
              videoEl: pinnedIsLocal
                ? <div ref={localVideoRef} className="w-full h-full min-h-[300px]" />
                : <div id={`remote-video-${pinnedUid}`} className="w-full h-full min-h-[300px]" />,
              hasVideo: pinnedIsLocal ? isCameraOn : (pinnedRemote?.hasVideo ?? false),
              hasAudio: pinnedIsLocal ? isMicOn : (pinnedRemote?.hasAudio ?? false),
              className: "w-full h-full min-h-[300px]",
            })}
          </div>

          {/* Sidebar strip */}
          {sidebarOpen && otherParticipants.length > 0 && (
            <div className="w-44 xl:w-52 flex flex-col gap-2 overflow-y-auto shrink-0 pr-0.5">
              {otherParticipants.map(({ uid, user }) => {
                const isLoc = uid === "local";
                return renderTile(uid, {
                  videoEl: isLoc
                    ? <div ref={localVideoRef} className="w-full h-full min-h-[90px]" />
                    : <div id={`remote-video-${uid}`} className="w-full h-full min-h-[90px]" />,
                  hasVideo: isLoc ? isCameraOn : (user?.hasVideo ?? false),
                  hasAudio: isLoc ? isMicOn : (user?.hasAudio ?? false),
                  className: "w-full shrink-0 h-28",
                });
              })}
            </div>
          )}
        </div>
      );
    }

    // Pure grid — no pin
    const count = allParticipants.length;
    const gridCols =
      count === 1 ? "grid-cols-1" :
      count === 2 ? "grid-cols-1 lg:grid-cols-2" :
      count <= 4 ? "grid-cols-2" :
      "grid-cols-2 lg:grid-cols-3";

    return (
      <div className={`h-full grid gap-3 content-start overflow-y-auto pr-1 ${gridCols}`}
        style={{ gridAutoRows: count === 1 ? "100%" : count === 2 ? "minmax(250px, 1fr)" : "minmax(200px, 1fr)" }}>
        {maximizedUid && (
          <div className="col-span-full relative" style={{ gridRow: "1 / -1" }}>
            {renderMaximizedOverlay()}
          </div>
        )}
        {allParticipants.map(({ uid, user }) => {
          const isLoc = uid === "local";
          return renderTile(uid, {
            videoEl: isLoc
              ? <div ref={localVideoRef} className="w-full h-full min-h-[200px]" />
              : <div id={`remote-video-${uid}`} className="w-full h-full min-h-[200px]" />,
            hasVideo: isLoc ? isCameraOn : (user?.hasVideo ?? false),
            hasAudio: isLoc ? isMicOn : (user?.hasAudio ?? false),
            className: "min-h-[200px]",
          });
        })}
      </div>
    );
  };

  // ─── Presentation layout ──────────────────────────────────────────────────────
  const renderPresentationLayout = () => {
    const pipCornerClass = {
      "bottom-right": "bottom-4 right-4",
      "bottom-left": "bottom-4 left-4",
      "top-right": "top-14 right-4",
      "top-left": "top-14 left-4",
    }[pipPosition];

    const allCamParticipants: Array<{ uid: "local" | number; user?: RemoteUser }> = [
      { uid: "local" },
      ...standardRemoteUsers.map((u) => ({ uid: u.uid as number, user: u })),
    ];

    return (
      <div className="h-full flex gap-3">
        {/* Main presentation area */}
        <div className="flex-1 min-w-0 relative bg-slate-900 rounded-xl overflow-hidden">
          {maximizedUid && renderMaximizedOverlay()}

          {/* Local screen share */}
          {isScreenSharing && !remoteScreenUser && (
            <div className="w-full h-full relative">
              <div ref={screenVideoRef} className="w-full h-full" />
              <div className="absolute top-4 left-4 bg-gradient-to-r from-blue-600 to-indigo-600 shadow-xl rounded-full px-4 py-1.5 flex items-center gap-2 z-10">
                <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                <Monitor className="h-3.5 w-3.5 text-white" />
                <span className="text-[10px] font-bold text-white uppercase tracking-wider">You are presenting</span>
              </div>
            </div>
          )}

          {/* Remote screen share */}
          {remoteScreenUser && (
            <div className="w-full h-full relative border-2 border-indigo-500/60 rounded-xl overflow-hidden">
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
                <span className="text-[10px] font-bold text-white uppercase tracking-wider">
                  {presenterUid ? getUserDisplayName(presenterUid) : "Someone"} is presenting
                </span>
              </div>
            </div>
          )}

          {/* Floating PiP — local camera while screen sharing */}
          {isScreenSharing && !pipDocked && (
            <div className={`absolute ${pipCornerClass} z-20 w-40 h-28 rounded-xl overflow-hidden border-2 border-blue-500/80 shadow-2xl bg-slate-900 group`}>
              <div ref={localVideoRef} className="w-full h-full" />
              {!isCameraOn && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
                  <span className="text-lg font-extrabold text-slate-400">{userName.charAt(0).toUpperCase()}</span>
                </div>
              )}
              {/* PiP controls */}
              <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-1.5 z-10">
                <div className="flex justify-end">
                  <button
                    onClick={() => setPipDocked(true)}
                    className="p-1 bg-slate-800 hover:bg-slate-700 text-white rounded transition cursor-pointer"
                    title="Dock to sidebar"
                  >
                    <Pin className="h-3 w-3" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-0.5">
                  {(["top-left", "top-right", "bottom-left", "bottom-right"] as const).map((pos) => (
                    <button
                      key={pos}
                      onClick={() => setPipPosition(pos)}
                      className={`text-[8px] py-0.5 rounded font-bold transition cursor-pointer ${pipPosition === pos ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}
                    >
                      {pos.split("-").map(w => w[0].toUpperCase()).join("")}
                    </button>
                  ))}
                </div>
              </div>
              <div className="absolute bottom-1.5 left-1.5 bg-blue-600/90 rounded px-1.5 py-0.5">
                <span className="text-[8px] font-bold text-white">You</span>
              </div>
            </div>
          )}
        </div>

        {/* Participants sidebar */}
        {sidebarOpen && (
          <div className="w-44 xl:w-52 flex flex-col gap-2 overflow-y-auto shrink-0 pr-0.5">
            {/* Docked PiP cam */}
            {isScreenSharing && pipDocked && (
              <div className="relative bg-slate-900 rounded-xl overflow-hidden border-2 border-blue-500/80 shrink-0 h-28 group">
                <div ref={localVideoRef} className="w-full h-full" />
                <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-start justify-end p-1.5 z-10">
                  <button
                    onClick={() => setPipDocked(false)}
                    className="p-1 bg-slate-800 hover:bg-slate-700 text-white rounded transition cursor-pointer"
                    title="Float PiP"
                  >
                    <PinOff className="h-3 w-3" />
                  </button>
                </div>
                <div className="absolute bottom-1.5 left-1.5 bg-blue-600/90 rounded px-1.5 py-0.5">
                  <span className="text-[8px] font-bold text-white">{userName} (You • Presenting)</span>
                </div>
              </div>
            )}

            {/* All camera participants */}
            {allCamParticipants
              .filter(({ uid }) => !(uid === "local" && isScreenSharing && !pipDocked)) // skip local if PiP floating
              .map(({ uid, user }) => {
                const isLoc = uid === "local";
                return renderTile(uid, {
                  videoEl: isLoc
                    ? <div ref={localVideoRef} className="w-full h-full min-h-[80px]" />
                    : <div id={`remote-video-${uid}`} className="w-full h-full min-h-[80px]" />,
                  hasVideo: isLoc ? isCameraOn : (user?.hasVideo ?? false),
                  hasAudio: isLoc ? isMicOn : (user?.hasAudio ?? false),
                  className: "w-full shrink-0 h-28",
                });
              })}

            {allCamParticipants.length === 0 && (
              <div className="flex items-center justify-center bg-slate-900/50 rounded-xl border border-dashed border-slate-700 h-24">
                <div className="text-center p-2">
                  <Users className="mx-auto h-5 w-5 text-slate-600 mb-1" />
                  <p className="text-[9px] text-slate-500 font-bold">Waiting for participants...</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // ─── Main UI ──────────────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[200] bg-slate-950 flex flex-col select-none"
    >
      {/* ── Top Bar ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900/80 backdrop-blur-sm border-b border-slate-800 shrink-0">
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
          <div className="h-4 w-px bg-slate-700" />
          <div className="flex items-center gap-1.5 bg-slate-800 rounded-lg px-2.5 py-1">
            <Users className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-xs font-bold text-slate-300">{standardRemoteUsers.length + 1}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Layout indicator */}
          <div className="flex items-center gap-1 bg-slate-800 rounded-lg px-2 py-1">
            <LayoutGrid className="h-3 w-3 text-slate-400" />
            <span className="text-[10px] font-bold text-slate-400 capitalize">{layoutMode}</span>
          </div>

          {/* Channel name */}
          <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-800 px-2 py-1 rounded-lg truncate max-w-[140px]">
            {channelName}
          </span>

          {/* Toggle sidebar */}
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition cursor-pointer"
          >
            {sidebarOpen ? <X className="h-3.5 w-3.5" /> : <Users className="h-3.5 w-3.5" />}
          </button>

          {/* Browser native fullscreen */}
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition cursor-pointer"
          >
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* ── Video Area ──────────────────────────────────────────────────────── */}
      <div className="flex-1 p-3 overflow-hidden min-h-0">
        {isPresenting ? renderPresentationLayout() : renderGridLayout()}
      </div>

      {/* ── Bottom Control Bar ───────────────────────────────────────────────── */}
      <div className="shrink-0 px-4 py-3 bg-slate-900/80 backdrop-blur-sm border-t border-slate-800">
        <div className="flex items-center justify-center gap-3 flex-wrap">
          {/* Mic */}
          <button
            onClick={toggleMic}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer ${isMicOn ? "bg-slate-700 hover:bg-slate-600 text-white" : "bg-rose-500 hover:bg-rose-600 text-white"}`}
            title={isMicOn ? "Mute Microphone" : "Unmute Microphone"}
          >
            {isMicOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </button>

          {/* Camera */}
          <button
            onClick={toggleCamera}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer ${isCameraOn ? "bg-slate-700 hover:bg-slate-600 text-white" : "bg-rose-500 hover:bg-rose-600 text-white"}`}
            title={isCameraOn ? "Turn Off Camera" : "Turn On Camera"}
          >
            {isCameraOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </button>

          {/* Screen Share — available to ALL participants */}
          <button
            onClick={toggleScreenShare}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer ${isScreenSharing ? "bg-blue-500 hover:bg-blue-600 text-white ring-2 ring-blue-400/50" : "bg-slate-700 hover:bg-slate-600 text-white"}`}
            title={isScreenSharing ? "Stop Screen Share" : "Share Screen / Present Slides"}
          >
            {isScreenSharing ? <MonitorOff className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}
          </button>

          {/* Pin-clear shortcut */}
          {pinnedUid !== null && (
            <button
              onClick={() => setPinnedUid(null)}
              className="w-12 h-12 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition-all cursor-pointer ring-2 ring-blue-400/40"
              title="Clear pin — return to grid"
            >
              <PinOff className="h-5 w-5" />
            </button>
          )}

          {/* Layout cycle */}
          <button
            onClick={() => {
              setPinnedUid(null);
              setMaximizedUid(null);
            }}
            className="w-12 h-12 rounded-2xl bg-slate-700 hover:bg-slate-600 text-white flex items-center justify-center transition-all cursor-pointer"
            title="Reset layout to grid"
          >
            <LayoutGrid className="h-5 w-5" />
          </button>

          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            className="w-12 h-12 rounded-2xl bg-slate-700 hover:bg-slate-600 text-white flex items-center justify-center transition-all cursor-pointer"
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
          </button>

          <div className="h-8 w-px bg-slate-700 mx-1" />

          {/* Leave */}
          <button
            onClick={leaveChannel}
            className="w-14 h-12 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center transition-all cursor-pointer shadow-lg shadow-rose-600/30"
            title="Leave Call"
          >
            <PhoneOff className="h-5 w-5" />
          </button>
        </div>

        {/* Hints */}
        <div className="flex items-center justify-center gap-4 mt-2">
          {!isScreenSharing && (
            <p className="text-[10px] text-slate-500 font-medium">
              💡 <Monitor className="h-3 w-3 inline-block mx-0.5" /> Share slides — hover a tile to <Pin className="h-3 w-3 inline-block mx-0.5" /> pin or <Expand className="h-3 w-3 inline-block mx-0.5" /> maximize
            </p>
          )}
          {isScreenSharing && (
            <p className="text-[10px] text-blue-400 font-bold animate-pulse">
              🔴 You are presenting your screen to everyone in this room
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
