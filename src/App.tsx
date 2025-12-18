import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { useState, useEffect } from "react";
import { useSession, handleSignOut } from "@/lib/auth-client";
import LoginPage from "@/components/LoginPage";
import LandingPage from "./LandingPage";

// ============================================================================
// MAIN APP
// ============================================================================

export default function App() {
  const { data: session, isPending } = useSession();
  const [showAuth, setShowAuth] = useState(false);

  if (isPending) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <span className="text-white text-3xl">📞</span>
          </div>
          <p className="text-slate-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session?.user) {
    if (showAuth) {
      return <LoginPage onBack={() => setShowAuth(false)} />;
    }
    return (
      <LandingPage
        onLogin={() => setShowAuth(true)}
        onSignup={() => setShowAuth(true)}
      />
    );
  }

  return <AuthenticatedApp user={session.user} />;
}

// ============================================================================
// AUTHENTICATED APP - Main app for logged-in users
// ============================================================================

interface AuthUser {
  id: string;
  email: string;
  name: string;
  image?: string | null;
}

function AuthenticatedApp({ user }: { user: AuthUser }) {
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return localStorage.getItem("talkcrm_onboarding_complete") !== "true";
  });

  // Show onboarding for new users
  if (showOnboarding) {
    return (
      <OnboardingFlow
        userName={user.name}
        onComplete={() => {
          localStorage.setItem("talkcrm_onboarding_complete", "true");
          setShowOnboarding(false);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Header user={user} />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <Dashboard userEmail={user.email} />
      </main>
    </div>
  );
}

// ============================================================================
// ONBOARDING FLOW - Guide new users through setup
// ============================================================================

function OnboardingFlow({ userName, onComplete }: { userName: string; onComplete: () => void }) {
  const [step, setStep] = useState(1);
  const totalSteps = 3;

  const nextStep = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      onComplete();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-purple-900 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Progress indicator */}
        <div className="flex justify-center mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  s <= step
                    ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white"
                    : "bg-white/20 text-white/50"
                }`}
              >
                {s}
              </div>
              {s < 3 && (
                <div
                  className={`w-12 h-1 mx-1 rounded ${
                    s < step ? "bg-gradient-to-r from-blue-500 to-purple-600" : "bg-white/20"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Content card */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 shadow-2xl">
          {step === 1 && <OnboardingStep1 userName={userName} onNext={nextStep} />}
          {step === 2 && <OnboardingStep2 onNext={nextStep} />}
          {step === 3 && <OnboardingStep3 onComplete={onComplete} />}
        </div>

        {/* Skip button */}
        <button
          onClick={onComplete}
          className="block mx-auto mt-6 text-sm text-white/50 hover:text-white/80 transition-colors"
        >
          Skip onboarding
        </button>
      </div>
    </div>
  );
}

function OnboardingStep1({ userName, onNext }: { userName: string; onNext: () => void }) {
  return (
    <div className="text-center">
      <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg">
        <span className="text-white text-5xl">📞</span>
      </div>
      <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-3">
        Welcome, {userName.split(" ")[0]}!
      </h1>
      <p className="text-lg text-slate-600 dark:text-slate-300 mb-8">
        TalkCRM lets you manage Salesforce entirely by voice.
        <br />
        Let's get you set up in under 2 minutes.
      </p>

      <div className="grid grid-cols-3 gap-4 mb-8 text-left">
        <FeatureCard icon="🎙️" title="Voice Commands" description="Speak naturally to your CRM" />
        <FeatureCard icon="🔄" title="Auto Updates" description="Salesforce syncs instantly" />
        <FeatureCard icon="🤖" title="AI Powered" description="Smart, context-aware responses" />
      </div>

      <button
        onClick={onNext}
        className="px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium rounded-xl hover:opacity-90 transition-opacity text-lg"
      >
        Let's Get Started
      </button>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 text-center">
      <span className="text-3xl block mb-2">{icon}</span>
      <h3 className="font-semibold text-slate-900 dark:text-white text-sm">{title}</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{description}</p>
    </div>
  );
}

function OnboardingStep2({ onNext }: { onNext: () => void }) {
  return (
    <div className="text-center">
      <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
        <span className="text-4xl">💬</span>
      </div>
      <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
        Example Commands
      </h2>
      <p className="text-slate-600 dark:text-slate-300 mb-6">
        Here's what you can say when you use TalkCRM:
      </p>

      <div className="grid grid-cols-2 gap-3 mb-8 text-left">
        <ExampleCommand category="Search" command="Find the Acme account" />
        <ExampleCommand category="Pipeline" command="What's in my pipeline?" />
        <ExampleCommand category="Tasks" command="What tasks do I have today?" />
        <ExampleCommand category="Create" command="Create a task to call John tomorrow" />
        <ExampleCommand category="Update" command="Update the Acme deal to Closed Won" />
        <ExampleCommand category="Log" command="Log a call on the Johnson contact" />
      </div>

      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
        Don't worry about exact wording - just speak naturally!
      </p>

      <button
        onClick={onNext}
        className="px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium rounded-xl hover:opacity-90 transition-opacity"
      >
        Continue
      </button>
    </div>
  );
}

function ExampleCommand({ category, command }: { category: string; command: string }) {
  return (
    <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
      <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
        {category}
      </span>
      <p className="text-sm text-slate-900 dark:text-white mt-1 font-mono">"{command}"</p>
    </div>
  );
}

function OnboardingStep3({ onComplete }: { onComplete: () => void }) {
  const [hasCopied, setHasCopied] = useState(false);
  const phoneNumber = "+1 (646) 600-5041";

  const copyPhone = () => {
    navigator.clipboard.writeText("+16466005041");
    setHasCopied(true);
    setTimeout(() => setHasCopied(false), 2000);
  };

  return (
    <div className="text-center">
      <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-green-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
        <span className="text-4xl">🎉</span>
      </div>
      <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
        You're All Set!
      </h2>
      <p className="text-slate-600 dark:text-slate-300 mb-6">
        Call this number or use the web interface to start using TalkCRM:
      </p>

      <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-6 mb-6 text-white">
        <p className="text-sm opacity-80 mb-2">TalkCRM Phone Number</p>
        <p className="text-3xl font-bold font-mono mb-2">{phoneNumber}</p>
        <button
          onClick={copyPhone}
          className="text-sm bg-white/20 hover:bg-white/30 px-4 py-1.5 rounded-full transition-colors"
        >
          {hasCopied ? "Copied!" : "Copy Number"}
        </button>
      </div>

      <button
        onClick={onComplete}
        className="px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-medium rounded-xl hover:opacity-90 transition-opacity text-lg"
      >
        Go to Dashboard
      </button>

      <p className="text-sm text-slate-400 mt-4">
        Save the number in your contacts as "TalkCRM"
      </p>
    </div>
  );
}

// ============================================================================
// HEADER
// ============================================================================

function Header({ user }: { user: AuthUser }) {
  return (
    <header className="sticky top-0 z-10 bg-white dark:bg-slate-800 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
            <span className="text-white text-xl">📞</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">TalkCRM</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Voice-Powered Salesforce</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <AgentStatus />
          <div className="flex items-center gap-3 pl-4 border-l border-slate-200 dark:border-slate-700">
            {user.image && (
              <img
                src={user.image}
                alt={user.name}
                className="w-8 h-8 rounded-full"
              />
            )}
            <div className="text-right">
              <p className="text-sm font-medium text-slate-900 dark:text-white">{user.name}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
            </div>
            <button
              onClick={handleSignOut}
              className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:text-red-500 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

// ============================================================================
// REAL-TIME AGENT STATUS (Shows in header when agent is working)
// ============================================================================

function AgentStatus() {
  const latestActivity = useQuery(api.activities.getLatestActivity);
  const [isRecent, setIsRecent] = useState(false);

  useEffect(() => {
    if (latestActivity) {
      const age = Date.now() - latestActivity.timestamp;
      setIsRecent(age < 30000); // Activity in last 30 seconds
    }
  }, [latestActivity]);

  if (!latestActivity || !isRecent) return null;

  const getStatusColor = (type: string) => {
    switch (type) {
      case "thinking": return "bg-yellow-500";
      case "searching": return "bg-blue-500";
      case "found": return "bg-green-500";
      case "creating": return "bg-purple-500";
      case "updating": return "bg-orange-500";
      case "success": return "bg-green-500";
      case "error": return "bg-red-500";
      default: return "bg-slate-500";
    }
  };

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-700 rounded-full">
      <div className={`w-2 h-2 rounded-full ${getStatusColor(latestActivity.type)} animate-pulse`} />
      <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">
        {latestActivity.message}
      </span>
    </div>
  );
}

// ============================================================================
// DASHBOARD
// ============================================================================

function Dashboard({ userEmail }: { userEmail: string }) {
  const stats = useQuery(api.conversations.getGlobalStats);
  const conversations = useQuery(api.conversations.listAllConversations, { limit: 10 });
  const activities = useQuery(api.activities.getRecentActivities, { limit: 10 });
  const [highlightedRecordId, setHighlightedRecordId] = useState<string | null>(null);

  // Get Salesforce status - we'll need to link user by email
  // For now, show a prompt to connect Salesforce

  const convexUrl = import.meta.env.VITE_CONVEX_URL || "";
  const httpUrl = convexUrl.replace(".cloud", ".site");

  // Auto-clear highlight after 5 seconds
  useEffect(() => {
    if (highlightedRecordId) {
      const timer = setTimeout(() => setHighlightedRecordId(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [highlightedRecordId]);

  const connectSalesforce = () => {
    const returnUrl = encodeURIComponent(window.location.href);
    window.location.href = `${httpUrl}/auth/salesforce/connect?email=${encodeURIComponent(userEmail)}&return_url=${returnUrl}`;
  };

  return (
    <div className="space-y-8">
      {/* Salesforce Connection Prompt */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center text-2xl">
              ☁️
            </div>
            <div>
              <h3 className="font-semibold text-amber-900 dark:text-amber-100">Connect Salesforce</h3>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                Link your Salesforce account to start using voice commands
              </p>
            </div>
          </div>
          <button
            onClick={connectSalesforce}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            Connect Salesforce
          </button>
        </div>
      </div>

      {/* Real-time Activity Feed */}
      <ActivityFeed
        activities={activities || []}
        onRecordClick={(recordId) => setHighlightedRecordId(recordId)}
        highlightedRecordId={highlightedRecordId}
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Calls" value={stats?.total ?? 0} icon="📞" color="blue" />
        <StatCard title="Today" value={stats?.today ?? 0} icon="📅" color="green" />
        <StatCard title="Records Accessed" value={stats?.recordsAccessed ?? 0} icon="📊" color="purple" />
        <StatCard title="Records Modified" value={stats?.recordsModified ?? 0} icon="✏️" color="orange" />
      </div>

      {/* How to Use */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          How to Use TalkCRM
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          <Step number={1} title="Call the Number" description="Call +1 (646) 600-5041 to connect" />
          <Step number={2} title="Ask Anything" description="'Show me my pipeline', 'Find the Acme account'" />
          <Step number={3} title="Get Things Done" description="Your assistant will handle Salesforce for you" />
        </div>
      </div>

      {/* Phone Number Display */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm opacity-80">Your TalkCRM Number</p>
            <p className="text-3xl font-bold font-mono">+1 (646) 600-5041</p>
            <p className="text-sm mt-2 opacity-80">Call to start using voice commands</p>
          </div>
          <div className="text-6xl">📱</div>
        </div>
      </div>

      {/* Example Commands */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Example Voice Commands
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          <CommandExample command="Show me my pipeline" description="Get a summary of your open opportunities" />
          <CommandExample command="Find the Acme account" description="Search for an account by name" />
          <CommandExample command="What tasks do I have today?" description="List your open tasks due today" />
          <CommandExample command="Create a task to follow up with John" description="Create a new task in Salesforce" />
        </div>
      </div>

      {/* Recent Conversations */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Recent Conversations
        </h2>
        {!conversations || conversations.length === 0 ? (
          <p className="text-slate-500 dark:text-slate-400 text-center py-8">
            No conversations yet. Make your first call!
          </p>
        ) : (
          <div className="space-y-3">
            {conversations.map((conv) => (
              <ConversationRow key={conv._id} conversation={conv} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: number;
  icon: string;
  color: "blue" | "green" | "purple" | "orange";
}) {
  const colorClasses = {
    blue: "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400",
    green: "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400",
    purple: "bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400",
    orange: "bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400",
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">{title}</p>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">{value}</p>
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${colorClasses[color]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// ACTIVITY FEED
// ============================================================================

type ActivityType = "thinking" | "searching" | "found" | "creating" | "updating" | "success" | "error";

interface Activity {
  _id: string;
  type: ActivityType;
  message: string;
  toolName?: string;
  recordId?: string;
  recordName?: string;
  recordType?: string;
  timestamp: number;
}

function ActivityFeed({
  activities,
  onRecordClick,
  highlightedRecordId,
}: {
  activities: Activity[];
  onRecordClick: (recordId: string) => void;
  highlightedRecordId: string | null;
}) {
  if (activities.length === 0) {
    return (
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-xl p-6 text-white">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-3 h-3 bg-slate-500 rounded-full" />
          <h2 className="text-lg font-semibold">Agent Activity</h2>
        </div>
        <p className="text-slate-400 text-sm">Waiting for voice commands...</p>
        <p className="text-slate-500 text-xs mt-2">Call +1 (646) 600-5041 to start</p>
      </div>
    );
  }

  const getActivityIcon = (type: ActivityType) => {
    switch (type) {
      case "thinking": return "🤔";
      case "searching": return "🔍";
      case "found": return "📋";
      case "creating": return "➕";
      case "updating": return "✏️";
      case "success": return "✅";
      case "error": return "❌";
      default: return "📌";
    }
  };

  const getActivityColor = (type: ActivityType) => {
    switch (type) {
      case "thinking": return "border-yellow-500 bg-yellow-500/10";
      case "searching": return "border-blue-500 bg-blue-500/10";
      case "found": return "border-green-500 bg-green-500/10";
      case "creating": return "border-purple-500 bg-purple-500/10";
      case "updating": return "border-orange-500 bg-orange-500/10";
      case "success": return "border-green-500 bg-green-500/10";
      case "error": return "border-red-500 bg-red-500/10";
      default: return "border-slate-500 bg-slate-500/10";
    }
  };

  const formatTimestamp = (ts: number) => {
    const diff = Date.now() - ts;
    if (diff < 1000) return "just now";
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return new Date(ts).toLocaleTimeString();
  };

  const hasRecentActivity = activities.some((a) => Date.now() - a.timestamp < 30000);

  return (
    <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-xl p-6 text-white overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${hasRecentActivity ? "bg-green-500 animate-pulse" : "bg-slate-500"}`} />
          <h2 className="text-lg font-semibold">Agent Activity</h2>
        </div>
        {hasRecentActivity && <span className="text-xs text-green-400 font-medium">LIVE</span>}
      </div>

      <div className="space-y-3 max-h-64 overflow-y-auto">
        {activities.map((activity) => {
          const isHighlighted = activity.recordId === highlightedRecordId;
          const isRecent = Date.now() - activity.timestamp < 5000;

          return (
            <div
              key={activity._id}
              className={`
                flex items-start gap-3 p-3 rounded-lg border-l-4 transition-all duration-300
                ${getActivityColor(activity.type)}
                ${isRecent ? "animate-pulse" : ""}
                ${isHighlighted ? "ring-2 ring-white/50" : ""}
              `}
            >
              <span className="text-xl flex-shrink-0">{getActivityIcon(activity.type)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white font-medium">{activity.message}</p>
                <div className="flex items-center gap-2 mt-1">
                  {activity.recordName && (
                    <button
                      onClick={() => activity.recordId && onRecordClick(activity.recordId)}
                      className="text-xs text-blue-400 hover:text-blue-300 hover:underline cursor-pointer"
                    >
                      {activity.recordType}: {activity.recordName}
                    </button>
                  )}
                  <span className="text-xs text-slate-500">{formatTimestamp(activity.timestamp)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Step({ number, title, description }: { number: number; title: string; description: string }) {
  return (
    <div className="flex gap-4">
      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-sm flex-shrink-0">
        {number}
      </div>
      <div>
        <h3 className="font-medium text-slate-900 dark:text-white">{title}</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
      </div>
    </div>
  );
}

function CommandExample({ command, description }: { command: string; description: string }) {
  return (
    <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
      <p className="font-mono text-sm text-blue-600 dark:text-blue-400">"{command}"</p>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{description}</p>
    </div>
  );
}

function ConversationRow({
  conversation,
}: {
  conversation: {
    _id: string;
    conversationId: string;
    callerPhone?: string;
    startTime: number;
    endTime?: number;
    status: "active" | "completed" | "failed";
    summary?: string;
    salesforceRecordsAccessed: string[];
    salesforceRecordsModified: string[];
  };
}) {
  const duration = conversation.endTime
    ? Math.round((conversation.endTime - conversation.startTime) / 1000)
    : null;

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  return (
    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
      <div className="flex items-center gap-4">
        <div
          className={`w-3 h-3 rounded-full ${
            conversation.status === "active"
              ? "bg-green-500 animate-pulse"
              : conversation.status === "completed"
                ? "bg-slate-400"
                : "bg-red-500"
          }`}
        />
        <div>
          <p className="font-medium text-slate-900 dark:text-white">
            {conversation.callerPhone || conversation.conversationId.slice(0, 8)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {new Date(conversation.startTime).toLocaleString()}
            {duration && ` · ${formatDuration(duration)}`}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
        <span title="Records accessed">📊 {conversation.salesforceRecordsAccessed.length}</span>
        <span title="Records modified">✏️ {conversation.salesforceRecordsModified.length}</span>
      </div>
    </div>
  );
}
