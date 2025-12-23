import { useState, useEffect, useCallback } from "react";

// Types
interface SlackStatus {
  connected: boolean;
  teamName?: string;
  installedAt?: number;
  channelCount?: number;
}

interface SlackChannel {
  id: string;
  name: string;
  is_private: boolean;
  is_member: boolean;
}

interface ChannelMapping {
  _id: string;
  channelId: string;
  channelName: string;
  purpose: string;
  isActive: boolean;
}

// Notification purposes with descriptions
const NOTIFICATION_PURPOSES = [
  {
    value: "deal_alerts",
    label: "Deal Alerts",
    description: "Get notified when deals change stage or are won/lost",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    value: "call_summaries",
    label: "Call Summaries",
    description: "Receive AI-generated summaries after each TalkCRM call",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
      </svg>
    ),
  },
  {
    value: "task_reminders",
    label: "Task Reminders",
    description: "Daily digest of your open and overdue Salesforce tasks",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    value: "all_activity",
    label: "All Activity",
    description: "All CRM updates including new records and changes",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
];

// Slack logo SVG
const SlackLogo = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 127 127" fill="none">
    <path d="M27.2 80c0 7.3-5.9 13.2-13.2 13.2C6.7 93.2.8 87.3.8 80c0-7.3 5.9-13.2 13.2-13.2h13.2V80z" fill="#E01E5A"/>
    <path d="M33.9 80c0-7.3 5.9-13.2 13.2-13.2 7.3 0 13.2 5.9 13.2 13.2v33c0 7.3-5.9 13.2-13.2 13.2-7.3 0-13.2-5.9-13.2-13.2V80z" fill="#E01E5A"/>
    <path d="M47.1 27c-7.3 0-13.2-5.9-13.2-13.2C33.9 6.5 39.8.6 47.1.6c7.3 0 13.2 5.9 13.2 13.2V27H47.1z" fill="#36C5F0"/>
    <path d="M47.1 33.7c7.3 0 13.2 5.9 13.2 13.2 0 7.3-5.9 13.2-13.2 13.2H14c-7.3 0-13.2-5.9-13.2-13.2 0-7.3 5.9-13.2 13.2-13.2h33.1z" fill="#36C5F0"/>
    <path d="M99.9 46.9c0-7.3 5.9-13.2 13.2-13.2 7.3 0 13.2 5.9 13.2 13.2 0 7.3-5.9 13.2-13.2 13.2H99.9V46.9z" fill="#2EB67D"/>
    <path d="M93.2 46.9c0 7.3-5.9 13.2-13.2 13.2-7.3 0-13.2-5.9-13.2-13.2V14c0-7.3 5.9-13.2 13.2-13.2 7.3 0 13.2 5.9 13.2 13.2v32.9z" fill="#2EB67D"/>
    <path d="M80 99.7c7.3 0 13.2 5.9 13.2 13.2 0 7.3-5.9 13.2-13.2 13.2-7.3 0-13.2-5.9-13.2-13.2V99.7H80z" fill="#ECB22E"/>
    <path d="M80 93c-7.3 0-13.2-5.9-13.2-13.2 0-7.3 5.9-13.2 13.2-13.2h33.1c7.3 0 13.2 5.9 13.2 13.2 0 7.3-5.9 13.2-13.2 13.2H80z" fill="#ECB22E"/>
  </svg>
);

// Get the Convex site URL from environment
const CONVEX_SITE_URL = import.meta.env.VITE_CONVEX_SITE_URL || "";

interface SlackSettingsProps {
  userEmail?: string;
}

export default function SlackSettings({ userEmail }: SlackSettingsProps) {
  const [status, setStatus] = useState<SlackStatus | null>(null);
  const [channels, setChannels] = useState<SlackChannel[]>([]);
  const [mappings, setMappings] = useState<ChannelMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [savingChannel, setSavingChannel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch Slack status
  const fetchStatus = useCallback(async () => {
    if (!userEmail) return null;
    try {
      const response = await fetch(
        `${CONVEX_SITE_URL}/api/slack/status?email=${encodeURIComponent(userEmail)}`,
        { credentials: "include" }
      );
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
        return data;
      }
    } catch (e) {
      console.error("Failed to fetch Slack status:", e);
    }
    return null;
  }, [userEmail]);

  // Fetch channels when connected
  const fetchChannels = useCallback(async () => {
    if (!userEmail) return;
    try {
      const response = await fetch(
        `${CONVEX_SITE_URL}/api/slack/channels?email=${encodeURIComponent(userEmail)}`,
        { credentials: "include" }
      );
      if (response.ok) {
        const data = await response.json();
        setChannels(data.channels || []);
        setMappings(data.mappings || []);
      }
    } catch (e) {
      console.error("Failed to fetch Slack channels:", e);
    }
  }, [userEmail]);

  // Initial load
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const statusData = await fetchStatus();
      if (statusData?.connected) {
        await fetchChannels();
      }
      setLoading(false);
    };
    load();
  }, [fetchStatus, fetchChannels]);

  // Handle Add to Slack
  const handleInstall = async () => {
    if (!userEmail) {
      setError("Please log in first");
      return;
    }
    setInstalling(true);
    setError(null);
    try {
      // Build install URL with email and return URL
      const returnUrl = encodeURIComponent(window.location.origin);
      const url = `${CONVEX_SITE_URL}/api/slack/install?email=${encodeURIComponent(userEmail)}&returnUrl=${returnUrl}`;
      // Redirect to Slack OAuth
      window.location.href = url;
    } catch (e) {
      console.error("Failed to install Slack:", e);
      setError("Failed to connect to server");
      setInstalling(false);
    }
  };

  // Handle disconnect
  const handleDisconnect = async () => {
    if (!userEmail) return;
    if (!confirm("Are you sure you want to disconnect Slack? You'll stop receiving notifications.")) {
      return;
    }
    setDisconnecting(true);
    setError(null);
    try {
      const response = await fetch(`${CONVEX_SITE_URL}/api/slack/disconnect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: userEmail }),
      });
      if (response.ok) {
        setStatus({ connected: false });
        setChannels([]);
        setMappings([]);
      } else {
        setError("Failed to disconnect Slack");
      }
    } catch (e) {
      console.error("Failed to disconnect Slack:", e);
      setError("Failed to disconnect");
    } finally {
      setDisconnecting(false);
    }
  };

  // Handle channel selection for a notification type
  const handleChannelSelect = async (purpose: string, channelId: string) => {
    if (!userEmail) return;
    setSavingChannel(purpose);
    setError(null);
    try {
      const channel = channels.find((c) => c.id === channelId);
      if (!channel && channelId !== "") {
        setSavingChannel(null);
        return;
      }

      const response = await fetch(`${CONVEX_SITE_URL}/api/slack/channels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: userEmail,
          action: channelId === "" ? "remove" : "set",
          purpose,
          channelId,
          channelName: channel?.name,
        }),
      });

      if (response.ok) {
        await fetchChannels();
      } else {
        setError("Failed to save channel preference");
      }
    } catch (e) {
      console.error("Failed to save channel:", e);
      setError("Failed to save channel");
    } finally {
      setSavingChannel(null);
    }
  };

  // Get current channel for a purpose
  const getChannelForPurpose = (purpose: string): string => {
    const mapping = mappings.find((m) => m.purpose === purpose && m.isActive);
    return mapping?.channelId || "";
  };

  if (loading) {
    return (
      <div className="bg-gray-50 rounded-xl p-6">
        <div className="flex items-center gap-3">
          <SlackLogo className="w-6 h-6" />
          <span className="text-gray-500 text-sm">Loading Slack settings...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 rounded-xl p-6">
      <div className="flex items-start gap-4">
        {/* Slack Icon */}
        <div className="flex-shrink-0 w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm border border-gray-100">
          <SlackLogo className="w-6 h-6" />
        </div>

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium text-gray-900">Slack Integration</h3>
            {status?.connected && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                Connected
              </span>
            )}
          </div>

          {/* Description */}
          <p className="text-sm text-gray-500 mb-4">
            {status?.connected
              ? `Connected to ${status.teamName}. Choose channels for different notification types.`
              : "Connect Slack to get call summaries, deal alerts, and use /crm commands."}
          </p>

          {/* Error message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          {!status?.connected ? (
            // Not connected - show install button
            <button
              onClick={handleInstall}
              disabled={installing}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#4A154B] hover:bg-[#3e1240] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              <SlackLogo className="w-4 h-4" />
              {installing ? "Connecting..." : "Add to Slack"}
            </button>
          ) : (
            // Connected - show channel configuration
            <div className="space-y-4">
              {/* Channel mappings */}
              <div className="grid gap-3">
                {NOTIFICATION_PURPOSES.map((purpose) => (
                  <div
                    key={purpose.value}
                    className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-100"
                  >
                    <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center text-gray-600">
                      {purpose.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900">{purpose.label}</div>
                      <div className="text-xs text-gray-500 truncate">{purpose.description}</div>
                    </div>
                    <div className="flex-shrink-0">
                      <select
                        value={getChannelForPurpose(purpose.value)}
                        onChange={(e) => handleChannelSelect(purpose.value, e.target.value)}
                        disabled={savingChannel === purpose.value}
                        className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent disabled:opacity-50"
                      >
                        <option value="">Select channel...</option>
                        {channels.map((channel) => (
                          <option key={channel.id} value={channel.id}>
                            {channel.is_private ? "🔒 " : "# "}
                            {channel.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>

              {/* Slash commands info */}
              <div className="p-3 bg-slate-900 rounded-lg">
                <h4 className="text-xs font-medium text-white mb-2 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Slash Commands Available
                </h4>
                <div className="grid grid-cols-2 gap-1.5 text-xs">
                  <code className="text-slate-300">/crm search [query]</code>
                  <code className="text-slate-300">/crm pipeline</code>
                  <code className="text-slate-300">/crm tasks</code>
                  <code className="text-slate-300">/crm log [note]</code>
                </div>
              </div>

              {/* Disconnect button */}
              <div className="pt-2 border-t border-gray-100">
                <button
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="text-sm text-red-600 hover:text-red-700 font-medium disabled:opacity-50"
                >
                  {disconnecting ? "Disconnecting..." : "Disconnect Slack"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
