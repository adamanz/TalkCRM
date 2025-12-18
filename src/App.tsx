import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { Id } from "../convex/_generated/dataModel";

// ============================================================================
// AUTH CONTEXT - Manage user authentication state
// ============================================================================

interface User {
  _id: Id<"users">;
  email: string;
  name: string;
  verifiedPhones: string[];
  primaryPhone?: string;
  status: "active" | "suspended" | "pending";
  tier?: "free" | "starter" | "pro" | "enterprise";
}

interface AuthContextType {
  user: User | null;
  userId: Id<"users"> | null;
  isLoading: boolean;
  login: (userId: Id<"users">) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}

function AuthProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<Id<"users"> | null>(() => {
    const stored = localStorage.getItem("talkcrm_userId");
    return stored as Id<"users"> | null;
  });
  const [isLoading, setIsLoading] = useState(true);

  const user = useQuery(api.users.getCurrentUser, { userId: userId ?? undefined });

  useEffect(() => {
    if (user !== undefined) {
      setIsLoading(false);
      // If user not found, clear stored userId
      if (userId && user === null) {
        localStorage.removeItem("talkcrm_userId");
        setUserId(null);
      }
    }
  }, [user, userId]);

  const login = (newUserId: Id<"users">) => {
    localStorage.setItem("talkcrm_userId", newUserId);
    setUserId(newUserId);
  };

  const logout = () => {
    localStorage.removeItem("talkcrm_userId");
    setUserId(null);
  };

  return (
    <AuthContext.Provider value={{ user: user ?? null, userId, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// ============================================================================
// MAIN APP
// ============================================================================

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

import LandingPage from "./LandingPage";

// ... existing imports ...

function AppContent() {
  const { user, isLoading } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return localStorage.getItem("talkcrm_onboarding_complete") !== "true";
  });

  if (isLoading) {
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

  if (!user) {
    if (showAuth) {
      return <AuthPage initialMode={authMode} onBack={() => setShowAuth(false)} />;
    }
    return (
      <LandingPage 
        onLogin={() => {
          setAuthMode("login");
          setShowAuth(true);
        }} 
        onSignup={() => {
          setAuthMode("signup");
          setShowAuth(true);
        }} 
      />
    );
  }

  // Show onboarding for new users
  if (showOnboarding) {
    return (
      <OnboardingFlow
        user={user}
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
        <Dashboard userId={user._id} />
      </main>
    </div>
  );
}

// ============================================================================
// ONBOARDING FLOW - Guide new users through setup
// ============================================================================

function OnboardingFlow({ user, onComplete }: { user: User; onComplete: () => void }) {
  const [step, setStep] = useState(1);
  const totalSteps = 4;

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
          {[1, 2, 3, 4].map((s) => (
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
              {s < 4 && (
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
          {step === 1 && (
            <OnboardingStep1 userName={user.name} onNext={nextStep} />
          )}
          {step === 2 && <OnboardingStep2 onNext={nextStep} />}
          {step === 3 && <OnboardingStep3 onNext={nextStep} />}
          {step === 4 && (
            <OnboardingStep4 userPhone={user.primaryPhone || user.verifiedPhones[0]} onComplete={onComplete} />
          )}
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
        <FeatureCard icon="📱" title="Any Phone" description="Works with your existing phone" />
      </div>

      <button
        onClick={onNext}
        className="px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium rounded-xl hover:opacity-90 transition-opacity text-lg"
      >
        Let's Get Started →
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
        <span className="text-4xl">🔗</span>
      </div>
      <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
        How It Works
      </h2>
      <p className="text-slate-600 dark:text-slate-300 mb-8">
        TalkCRM connects to your Salesforce account to read and update your data.
      </p>

      <div className="text-left space-y-4 mb-8 max-w-md mx-auto">
        <HowItWorksItem
          number={1}
          title="Call from your registered phone"
          description="We identify you by your phone number - no passwords needed"
        />
        <HowItWorksItem
          number={2}
          title="Speak your request"
          description="'What's in my pipeline?' or 'Update the Acme deal'"
        />
        <HowItWorksItem
          number={3}
          title="We handle the rest"
          description="Your assistant searches, creates, and updates Salesforce for you"
        />
      </div>

      <button
        onClick={onNext}
        className="px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium rounded-xl hover:opacity-90 transition-opacity"
      >
        Continue →
      </button>
    </div>
  );
}

function HowItWorksItem({ number, title, description }: { number: number; title: string; description: string }) {
  return (
    <div className="flex gap-4">
      <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
        {number}
      </div>
      <div>
        <h3 className="font-medium text-slate-900 dark:text-white">{title}</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
      </div>
    </div>
  );
}

function OnboardingStep3({ onNext }: { onNext: () => void }) {
  return (
    <div className="text-center">
      <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
        <span className="text-4xl">💬</span>
      </div>
      <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
        Example Commands
      </h2>
      <p className="text-slate-600 dark:text-slate-300 mb-6">
        Here's what you can say when you call:
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
        Almost Done →
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

function OnboardingStep4({ userPhone, onComplete }: { userPhone: string; onComplete: () => void }) {
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
        Call this number from your registered phone to start using TalkCRM:
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

      <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 mb-6 text-left">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          <strong className="text-slate-900 dark:text-white">Your registered phone:</strong>{" "}
          <span className="font-mono">{userPhone}</span>
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Make sure to call from this number to authenticate automatically.
        </p>
      </div>

      <button
        onClick={onComplete}
        className="px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-medium rounded-xl hover:opacity-90 transition-opacity text-lg"
      >
        Go to Dashboard →
      </button>

      <p className="text-sm text-slate-400 mt-4">
        Save the number in your contacts as "TalkCRM"
      </p>
    </div>
  );
}

// ============================================================================
// AUTH PAGE - Login / Signup
// ============================================================================

function AuthPage({ initialMode = "login", onBack }: { initialMode?: "login" | "signup", onBack?: () => void }) {
  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [step, setStep] = useState<"form" | "verify">("form");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const { login } = useAuth();

  const convexUrl = import.meta.env.VITE_CONVEX_URL || "";
  const httpUrl = convexUrl.replace(".cloud", ".site");

  useEffect(() => {
    // #region agent log
    fetch("http://127.0.0.1:7244/ingest/1e251e9c-b8aa-4e39-b968-d4efd22e542b", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ location: "src/App.tsx:AuthPage", message: "AuthPage: derived Convex URLs", data: (() => { let parsed: { ok: boolean; protocol?: string; host?: string } = { ok: false }; try { const u = new URL(String(convexUrl)); parsed = { ok: true, protocol: u.protocol, host: u.host }; } catch { /* ignore */ } return { hasConvexUrl: Boolean(convexUrl), convexHost: parsed.host, convexProtocol: parsed.protocol, convexPreview: convexUrl.slice(0, 48), httpUrlPreview: httpUrl.slice(0, 48) }; })(), timestamp: Date.now(), sessionId: "debug-session", runId: "pre-fix", hypothesisId: "A" }) }).catch(() => {});
    // #endregion
  }, []);

  const handleStartVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const endpoint = mode === "signup"
        ? `${httpUrl}/api/auth/signup/start`
        : `${httpUrl}/api/auth/login/start`;

      const body = mode === "signup"
        ? { email, name, phone }
        : { phone };

      // #region agent log
      fetch("http://127.0.0.1:7244/ingest/1e251e9c-b8aa-4e39-b968-d4efd22e542b", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ location: "src/App.tsx:AuthPage:startVerification", message: "Starting verification request", data: { mode, endpointPreview: endpoint.slice(0, 120) }, timestamp: Date.now(), sessionId: "debug-session", runId: "pre-fix", hypothesisId: "D" }) }).catch(() => {});
      // #endregion

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      // #region agent log
      fetch("http://127.0.0.1:7244/ingest/1e251e9c-b8aa-4e39-b968-d4efd22e542b", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ location: "src/App.tsx:AuthPage:startVerification:resp", message: "Verification request response", data: { ok: response.ok, status: response.status }, timestamp: Date.now(), sessionId: "debug-session", runId: "pre-fix", hypothesisId: "D" }) }).catch(() => {});
      // #endregion

      if (!response.ok) {
        throw new Error(data.error || "Failed to send verification code");
      }

      // In dev mode, show the code
      if (data.code) {
        setDevCode(data.code);
      }

      setStep("verify");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      // #region agent log
      fetch("http://127.0.0.1:7244/ingest/1e251e9c-b8aa-4e39-b968-d4efd22e542b", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ location: "src/App.tsx:AuthPage:verifyCode", message: "Verifying code request", data: { endpointPreview: `${httpUrl}/api/auth/verify`.slice(0, 120), codeLen: code.length }, timestamp: Date.now(), sessionId: "debug-session", runId: "pre-fix", hypothesisId: "D" }) }).catch(() => {});
      // #endregion

      const response = await fetch(`${httpUrl}/api/auth/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Verification failed");
      }

      // Login successful!
      login(data.userId);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "");
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-10 relative">
          {onBack && (
            <button 
              onClick={onBack}
              className="absolute left-0 top-0 text-slate-600 hover:text-slate-900 transition-colors flex items-center gap-1.5 text-sm font-medium"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
          )}
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center mx-auto mb-4 shadow-sm">
            <span className="text-white text-2xl">📞</span>
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">TalkCRM</h1>
          <p className="text-slate-600 mt-1.5 text-sm">Voice-Powered Salesforce Assistant</p>
        </div>

        {/* Auth Card */}
        <div className="bg-white border border-slate-200/60 rounded-lg p-8 shadow-sm">
          {step === "form" ? (
            <>
              {/* Mode Toggle */}
              <div className="flex mb-6 bg-slate-50 rounded-lg p-1 border border-slate-200/60">
                <button
                  onClick={() => setMode("login")}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                    mode === "login"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Log In
                </button>
                <button
                  onClick={() => setMode("signup")}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                    mode === "signup"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Sign Up
                </button>
              </div>

              <form onSubmit={handleStartVerification} className="space-y-4">
                {mode === "signup" && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Name
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="John Smith"
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Email
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="john@company.com"
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
                        required
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(formatPhone(e.target.value))}
                    placeholder="(415) 555-1234"
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm font-mono"
                    required
                  />
                  <p className="text-xs text-slate-500 mt-2">
                    This phone will be used to authenticate your calls
                  </p>
                </div>

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow"
                >
                  {isLoading ? "Sending Code..." : "Send Verification Code"}
                </button>
              </form>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  setStep("form");
                  setCode("");
                  setDevCode(null);
                }}
                className="text-slate-600 text-sm mb-6 hover:text-slate-900 transition-colors flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>

              <h2 className="text-xl font-semibold text-slate-900 mb-2">
                Enter Verification Code
              </h2>
              <p className="text-slate-600 text-sm mb-6">
                We sent a 6-digit code to {phone}
              </p>

              {devCode && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm rounded-lg mb-4">
                  <strong>Dev Mode:</strong> Your code is <code className="font-mono font-bold ml-1">{devCode}</code>
                </div>
              )}

              <form onSubmit={handleVerifyCode} className="space-y-4">
                <div>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                    className="w-full px-4 py-4 text-center text-2xl font-mono tracking-widest rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    maxLength={6}
                    required
                  />
                </div>

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading || code.length !== 6}
                  className="w-full py-2.5 px-4 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow"
                >
                  {isLoading ? "Verifying..." : "Verify & Continue"}
                </button>
              </form>
            </>
          )}
        </div>

        {/* Info */}
        <p className="text-center text-slate-500 text-xs mt-6">
          Your phone number is how we identify you when you call.
          <br />
          No password needed - just call from your registered phone!
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// HEADER
// ============================================================================

function Header({ user }: { user: User }) {
  const { logout } = useAuth();

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
            <div className="text-right">
              <p className="text-sm font-medium text-slate-900 dark:text-white">{user.name}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{user.primaryPhone}</p>
            </div>
            <button
              onClick={logout}
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

function Dashboard({ userId }: { userId: Id<"users"> }) {
  const stats = useQuery(api.conversations.getConversationStats, { userId });
  const conversations = useQuery(api.conversations.listConversations, { limit: 10, userId });
  const activities = useQuery(api.activities.getRecentActivities, { limit: 10 });
  const sfStatus = useQuery(api.salesforce.getSalesforceStatus, { userId });
  const [highlightedRecordId, setHighlightedRecordId] = useState<string | null>(null);

  // Check for OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("sf_connected") === "true") {
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Auto-clear highlight after 5 seconds
  useEffect(() => {
    if (highlightedRecordId) {
      const timer = setTimeout(() => setHighlightedRecordId(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [highlightedRecordId]);

  const convexUrl = import.meta.env.VITE_CONVEX_URL || "";
  const httpUrl = convexUrl.replace(".cloud", ".site");

  useEffect(() => {
    // #region agent log
    fetch("http://127.0.0.1:7244/ingest/1e251e9c-b8aa-4e39-b968-d4efd22e542b", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ location: "src/App.tsx:Dashboard", message: "Dashboard: derived Convex URLs", data: { hasConvexUrl: Boolean(convexUrl), convexPreview: convexUrl.slice(0, 48), httpUrlPreview: httpUrl.slice(0, 48) }, timestamp: Date.now(), sessionId: "debug-session", runId: "pre-fix", hypothesisId: "B" }) }).catch(() => {});
    // #endregion
  }, []);

  const connectSalesforce = () => {
    const returnUrl = encodeURIComponent(window.location.href);
    window.location.href = `${httpUrl}/auth/salesforce/connect?user_id=${userId}&return_url=${returnUrl}`;
  };

  return (
    <div className="space-y-8">
      {/* Salesforce Connection Status */}
      {sfStatus && !sfStatus.connected && (
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
      )}

      {sfStatus?.connected && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center text-lg">
              ✓
            </div>
            <div>
              <span className="font-medium text-green-900 dark:text-green-100">Salesforce Connected</span>
              <span className="text-sm text-green-700 dark:text-green-300 ml-2">
                {sfStatus.instanceUrl?.replace("https://", "")}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Real-time Activity Feed - Prominent at top */}
      <ActivityFeed
        activities={activities || []}
        onRecordClick={(recordId) => setHighlightedRecordId(recordId)}
        highlightedRecordId={highlightedRecordId}
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Calls"
          value={stats?.total ?? 0}
          icon="📞"
          color="blue"
        />
        <StatCard
          title="Today"
          value={stats?.today ?? 0}
          icon="📅"
          color="green"
        />
        <StatCard
          title="Records Accessed"
          value={stats?.recordsAccessed ?? 0}
          icon="📊"
          color="purple"
        />
        <StatCard
          title="Records Modified"
          value={stats?.recordsModified ?? 0}
          icon="✏️"
          color="orange"
        />
      </div>

      {/* How to Use */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          How to Use TalkCRM
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          <Step
            number={1}
            title="Call the Number"
            description="Call from your registered phone to automatically authenticate"
          />
          <Step
            number={2}
            title="Ask Anything"
            description="'Show me my pipeline', 'Find the Acme account', 'Create a follow-up task'"
          />
          <Step
            number={3}
            title="Get Things Done"
            description="Your assistant will search, create, and update Salesforce records for you"
          />
        </div>
      </div>

      {/* Phone Number Display */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm opacity-80">Your TalkCRM Number</p>
            <p className="text-3xl font-bold font-mono">+1 (646) 600-5041</p>
            <p className="text-sm mt-2 opacity-80">Call from your registered phone to authenticate automatically</p>
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
          <CommandExample
            command="Show me my pipeline"
            description="Get a summary of your open opportunities"
          />
          <CommandExample
            command="Find the Acme account"
            description="Search for an account by name"
          />
          <CommandExample
            command="What tasks do I have today?"
            description="List your open tasks due today"
          />
          <CommandExample
            command="Create a task to follow up with John"
            description="Create a new task in Salesforce"
          />
          <CommandExample
            command="Update the Acme deal to Closed Won"
            description="Update an opportunity stage"
          />
          <CommandExample
            command="Log this call on the Johnson contact"
            description="Log call activity in Salesforce"
          />
        </div>
      </div>

      {/* Recent Conversations */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Your Recent Conversations
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
  color: 'blue' | 'green' | 'purple' | 'orange';
}) {
  const colorClasses = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
    orange: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400',
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
// ACTIVITY FEED - Real-time agent activity display
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

  // Check if there's recent activity (within 30 seconds)
  const hasRecentActivity = activities.some(a => Date.now() - a.timestamp < 30000);

  return (
    <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-xl p-6 text-white overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${hasRecentActivity ? 'bg-green-500 animate-pulse' : 'bg-slate-500'}`} />
          <h2 className="text-lg font-semibold">Agent Activity</h2>
        </div>
        {hasRecentActivity && (
          <span className="text-xs text-green-400 font-medium">LIVE</span>
        )}
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
                ${isRecent ? 'animate-pulse' : ''}
                ${isHighlighted ? 'ring-2 ring-white/50' : ''}
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

function Step({
  number,
  title,
  description,
}: {
  number: number;
  title: string;
  description: string;
}) {
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

function CommandExample({
  command,
  description,
}: {
  command: string;
  description: string;
}) {
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
    status: 'active' | 'completed' | 'failed';
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
        <div className={`w-3 h-3 rounded-full ${
          conversation.status === 'active' ? 'bg-green-500 animate-pulse' :
          conversation.status === 'completed' ? 'bg-slate-400' : 'bg-red-500'
        }`} />
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
