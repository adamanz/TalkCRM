import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { useState, useEffect } from "react";
import { useSession, handleSignOut } from "@/lib/auth-client";
import LoginPage from "@/components/LoginPage";
import TermsPage from "@/components/TermsPage";
import PrivacyPage from "@/components/PrivacyPage";
import LandingPage from "./LandingPage";

// ============================================================================
// SIMPLE ROUTER HOOK
// ============================================================================

function useSimpleRouter() {
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => setPath(window.location.pathname);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigate = (newPath: string) => {
    window.history.pushState({}, "", newPath);
    setPath(newPath);
  };

  return { path, navigate };
}

// ============================================================================
// MAIN APP
// ============================================================================

export default function App() {
  const { data: session, isPending } = useSession();
  const [showAuth, setShowAuth] = useState(false);
  const { path, navigate } = useSimpleRouter();

  // Handle legal pages (accessible without auth)
  if (path === "/terms") {
    return <TermsPage onBack={() => navigate("/")} />;
  }
  if (path === "/privacy") {
    return <PrivacyPage onBack={() => navigate("/")} />;
  }

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
        onNavigate={navigate}
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
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  return (
    <div className="min-h-screen bg-[#fafafa] flex items-center justify-center p-4">
      {/* Subtle grid background */}
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#00000008_1px,transparent_1px),linear-gradient(to_bottom,#00000008_1px,transparent_1px)] bg-[size:14px_24px]" />

      <div className="w-full max-w-xl relative z-10">
        {isAdmin === null ? (
          <AdminCheckCard userName={userName} onSelect={setIsAdmin} />
        ) : isAdmin ? (
          <AdminSetupCard onComplete={onComplete} />
        ) : (
          <ScheduleCallCard onComplete={onComplete} />
        )}
      </div>
    </div>
  );
}

function AdminCheckCard({ userName, onSelect }: { userName: string; onSelect: (isAdmin: boolean) => void }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-8">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-slate-900 rounded-xl mb-4">
          <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight mb-2">
          Welcome, {userName.split(" ")[0]}!
        </h1>
        <p className="text-slate-500">
          Let's get TalkCRM connected to your Salesforce
        </p>
      </div>

      <div className="bg-slate-50 rounded-xl p-6 mb-6">
        <h2 className="text-base font-medium text-slate-900 mb-2 text-center">
          Are you a Salesforce admin for your org?
        </h2>
        <p className="text-sm text-slate-500 text-center mb-6">
          This helps us guide you through the right setup process
        </p>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => onSelect(true)}
            className="flex flex-col items-center gap-2 p-4 bg-white border border-slate-200 rounded-xl hover:border-slate-300 hover:shadow-sm transition-all group"
          >
            <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center group-hover:bg-green-100 transition-colors">
              <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="font-medium text-slate-900">Yes, I am</span>
            <span className="text-xs text-slate-500">I can install packages</span>
          </button>

          <button
            onClick={() => onSelect(false)}
            className="flex flex-col items-center gap-2 p-4 bg-white border border-slate-200 rounded-xl hover:border-slate-300 hover:shadow-sm transition-all group"
          >
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center group-hover:bg-blue-100 transition-colors">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
            </div>
            <span className="font-medium text-slate-900">No, I'm not</span>
            <span className="text-xs text-slate-500">Someone else manages it</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminSetupCard({ onComplete }: { onComplete: () => void }) {
  const [activeTab, setActiveTab] = useState<'install' | 'how-it-works'>('install');

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-8">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-xl mb-3">
          <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-slate-900 mb-1">Install TalkCRM Package</h2>
        <p className="text-sm text-slate-500">Connect your Salesforce org in minutes</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-lg mb-6">
        <button
          onClick={() => setActiveTab('install')}
          className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-all ${
            activeTab === 'install'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Installation
        </button>
        <button
          onClick={() => setActiveTab('how-it-works')}
          className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-all ${
            activeTab === 'how-it-works'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          How It Works
        </button>
      </div>

      {activeTab === 'install' ? (
        <div className="space-y-4">
          {/* Step 1 */}
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 bg-slate-900 text-white rounded-full flex items-center justify-center text-xs font-bold">1</div>
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-900 mb-2">Install the Salesforce Package</p>
              <div className="space-y-2">
                <a
                  href="https://login.salesforce.com/packaging/installPackage.apexp?p0=04tHn000000QBNdIAO"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                    </svg>
                    <span className="text-sm font-medium text-blue-700">Production / Developer Org</span>
                  </div>
                  <svg className="w-4 h-4 text-blue-600 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
                <a
                  href="https://test.salesforce.com/packaging/installPackage.apexp?p0=04tHn000000QBNdIAO"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                    <span className="text-sm font-medium text-amber-700">Sandbox Org</span>
                  </div>
                  <svg className="w-4 h-4 text-amber-600 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 bg-slate-900 text-white rounded-full flex items-center justify-center text-xs font-bold">2</div>
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-900 mb-1">Select "Install for All Users"</p>
              <p className="text-xs text-slate-500">This allows TalkCRM to access Salesforce on behalf of your team</p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 bg-slate-900 text-white rounded-full flex items-center justify-center text-xs font-bold">3</div>
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-900 mb-1">Approve Third-Party Access</p>
              <p className="text-xs text-slate-500">Check the box and click Install to grant API permissions</p>
            </div>
          </div>

          {/* Step 4 */}
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 bg-slate-900 text-white rounded-full flex items-center justify-center text-xs font-bold">4</div>
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-900 mb-1">Connect Your Account</p>
              <p className="text-xs text-slate-500">Return here and click the button below to authorize</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-slate-50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-slate-900 mb-2 flex items-center gap-2">
              <span className="text-lg">🔒</span> Secure Connected App
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              TalkCRM uses a Salesforce Connected App with OAuth 2.0 authentication. Your credentials are never stored - we use secure tokens that can be revoked anytime from Salesforce Setup.
            </p>
          </div>

          <div className="bg-slate-50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-slate-900 mb-2 flex items-center gap-2">
              <span className="text-lg">🎙️</span> Voice to API
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              When you speak, our AI transcribes and understands your intent, then makes secure API calls to Salesforce. We support SOQL queries, record creation, updates, and task management.
            </p>
          </div>

          <div className="bg-slate-50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-slate-900 mb-2 flex items-center gap-2">
              <span className="text-lg">📊</span> Permission Scopes
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              TalkCRM requests access to standard objects (Accounts, Contacts, Opportunities, Tasks, etc.) based on your Salesforce profile permissions. We never access more than your user has access to.
            </p>
          </div>
        </div>
      )}

      <div className="mt-6 pt-6 border-t border-slate-100">
        <button
          onClick={onComplete}
          className="w-full py-3 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition-colors"
        >
          Continue to Dashboard
        </button>
      </div>
    </div>
  );
}

function ScheduleCallCard({ onComplete }: { onComplete: () => void }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-8">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-xl mb-3">
          <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-slate-900 mb-1">Let's Get You Set Up</h2>
        <p className="text-sm text-slate-500">We'll walk you through everything on a quick call</p>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 mb-6">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-blue-900 mb-1">Invite your Salesforce Admin</p>
            <p className="text-xs text-blue-700 leading-relaxed">
              To install TalkCRM, you'll need someone with admin access to your Salesforce org.
              Please include them when scheduling your onboarding call.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3 mb-6">
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span>15-minute setup call</span>
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span>We'll install the package together</span>
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span>Get personalized tips for your workflow</span>
        </div>
      </div>

      <a
        href="https://cal.com/team/simple/talk-crm-onboarding"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 w-full py-3 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition-colors mb-3"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        Schedule Onboarding Call
      </a>

      <button
        onClick={onComplete}
        className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
      >
        I'll do this later
      </button>
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
