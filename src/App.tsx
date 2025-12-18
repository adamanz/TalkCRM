import { useState, useEffect } from "react";
import { useAuth } from "@workos-inc/authkit-react";
import LoginPage from "@/components/LoginPage";
import TermsPage from "@/components/TermsPage";
import PrivacyPage from "@/components/PrivacyPage";
import LandingPage from "./LandingPage";

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

export default function App() {
  const { isLoading, user, signOut } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const { path, navigate } = useSimpleRouter();

  // Handle callback - redirect to home once auth completes
  useEffect(() => {
    if (path === "/callback" && !isLoading && user) {
      window.location.replace("/");
    }
  }, [path, isLoading, user]);

  // Handle legal pages
  if (path === "/terms") {
    return <TermsPage onBack={() => navigate("/")} />;
  }
  if (path === "/privacy") {
    return <PrivacyPage onBack={() => navigate("/")} />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 bg-black rounded-xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <p className="text-gray-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // Not authenticated - show landing or login
  if (!user) {
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

  // Authenticated - show installation page
  return <InstallationPage user={user} onSignOut={signOut} />;
}

interface WorkOSUser {
  email: string;
  firstName?: string;
  lastName?: string;
  profilePictureUrl?: string;
}

function InstallationPage({ user, onSignOut }: { user: WorkOSUser; onSignOut: () => void }) {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="font-semibold text-gray-900">TalkCRM</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">{user.email}</span>
            <button
              onClick={onSignOut}
              className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-3xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-semibold text-gray-900 mb-3">
            Install TalkCRM
          </h1>
          <p className="text-gray-500">
            A Salesforce admin is required to install the package.
          </p>
        </div>

        {/* Installation Steps */}
        <div className="space-y-6">
          {/* Step 1 */}
          <div className="bg-gray-50 rounded-xl p-6">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-black text-white rounded-full flex items-center justify-center text-sm font-medium">
                1
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-gray-900 mb-2">Install the Salesforce Package</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Click the button that matches your Salesforce environment
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  {/* Production Badge Button */}
                  <a
                    href="https://login.salesforce.com/packaging/installPackage.apexp?p0=04tHn000000QBNdIAO"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center overflow-hidden rounded-md shadow-sm hover:shadow-md transition-shadow"
                  >
                    <span className="px-3 py-2 bg-slate-700 text-white text-sm font-medium">
                      Deploy to Salesforce
                    </span>
                    <span className="px-3 py-2 bg-[#00A1E0] text-white text-sm font-semibold">
                      production
                    </span>
                  </a>
                  {/* Sandbox Badge Button */}
                  <a
                    href="https://test.salesforce.com/packaging/installPackage.apexp?p0=04tHn000000QBNdIAO"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center overflow-hidden rounded-md shadow-sm hover:shadow-md transition-shadow"
                  >
                    <span className="px-3 py-2 bg-slate-700 text-white text-sm font-medium">
                      Deploy to Salesforce
                    </span>
                    <span className="px-3 py-2 bg-orange-500 text-white text-sm font-semibold">
                      sandbox
                    </span>
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="bg-gray-50 rounded-xl p-6">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-black text-white rounded-full flex items-center justify-center text-sm font-medium">
                2
              </div>
              <div>
                <h3 className="font-medium text-gray-900 mb-1">Select "Install for All Users"</h3>
                <p className="text-sm text-gray-500">
                  This allows TalkCRM to access Salesforce on behalf of your team using their existing permissions
                </p>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="bg-gray-50 rounded-xl p-6">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-black text-white rounded-full flex items-center justify-center text-sm font-medium">
                3
              </div>
              <div>
                <h3 className="font-medium text-gray-900 mb-1">Approve Third-Party Access</h3>
                <p className="text-sm text-gray-500">
                  Check the box to grant API permissions, then click Install
                </p>
              </div>
            </div>
          </div>

          {/* Step 4 */}
          <div className="bg-gray-50 rounded-xl p-6">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-black text-white rounded-full flex items-center justify-center text-sm font-medium">
                4
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-gray-900 mb-1">Start Using TalkCRM</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Save this number and call to update Salesforce by voice
                </p>
                <div className="inline-flex items-center gap-3 px-5 py-4 bg-white rounded-xl border border-gray-200 shadow-sm">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">TalkCRM Hotline</p>
                    <p className="font-mono text-xl font-semibold text-gray-900">+1 (646) 600-5041</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Example Commands */}
        <div className="mt-10 p-6 bg-slate-900 rounded-xl text-white">
          <h3 className="font-medium text-white mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            Try these voice commands
          </h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="flex items-start gap-2 text-sm">
              <span className="text-slate-500">"</span>
              <span className="text-slate-200">What's in my pipeline?</span>
              <span className="text-slate-500">"</span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <span className="text-slate-500">"</span>
              <span className="text-slate-200">Find the Acme account</span>
              <span className="text-slate-500">"</span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <span className="text-slate-500">"</span>
              <span className="text-slate-200">Update Acme deal to Closed Won</span>
              <span className="text-slate-500">"</span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <span className="text-slate-500">"</span>
              <span className="text-slate-200">Create a task to call John tomorrow</span>
              <span className="text-slate-500">"</span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <span className="text-slate-500">"</span>
              <span className="text-slate-200">Log this call</span>
              <span className="text-slate-500">"</span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <span className="text-slate-500">"</span>
              <span className="text-slate-200">What are my open tasks?</span>
              <span className="text-slate-500">"</span>
            </div>
          </div>
        </div>

        {/* Technical Details - Collapsible */}
        <details className="mt-10 group">
          <summary className="flex items-center justify-center gap-2 cursor-pointer text-sm text-slate-500 hover:text-slate-700 transition-colors list-none">
            <svg className="w-4 h-4 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
            <span>Technical Details</span>
          </summary>

          <div className="mt-6 p-6 bg-slate-50 rounded-xl border border-slate-100">
            <h4 className="text-sm font-semibold text-slate-900 mb-4">Architecture</h4>

            {/* Architecture Diagram */}
            <div className="bg-white rounded-lg p-4 mb-6 font-mono text-xs text-slate-600 overflow-x-auto border border-slate-200">
              <pre className="whitespace-pre">{`
  ┌──────────────┐                              ┌──────────────┐
  │  Sales Rep   │                              │  Salesforce  │
  │   (Phone)    │                              │   REST API   │
  └──────┬───────┘                              └──────▲───────┘
         │ Call                                        │
         ▼                                             │
  ┌──────────────┐         ┌──────────────┐           │
  │    Twilio    │────────▶│  ElevenLabs  │───────────┤
  │  (Phone #)   │         │  Voice AI    │           │
  └──────────────┘         └──────────────┘           │
                                  │                    │
                                  ▼                    │
                           ┌──────────────┐           │
                           │    Convex    │───────────┘
                           │   Backend    │
                           └──────────────┘
              `}</pre>
            </div>

            {/* Tech Stack */}
            <h4 className="text-sm font-semibold text-slate-900 mb-3">Tech Stack</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
                <span><strong>Voice AI:</strong> ElevenLabs</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
                <span><strong>Phone:</strong> Twilio</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
                <span><strong>Backend:</strong> Convex</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
                <span><strong>CRM:</strong> Salesforce</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
                <span><strong>AI:</strong> Claude</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
                <span><strong>Auth:</strong> WorkOS</span>
              </div>
            </div>

            {/* Available Tools */}
            <h4 className="text-sm font-semibold text-slate-900 mb-3">Salesforce Tools</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="flex items-start gap-2 text-slate-600 bg-white rounded px-3 py-2 border border-slate-100">
                <code className="text-slate-800 font-semibold">search_salesforce</code>
                <span className="text-slate-400">– Find records</span>
              </div>
              <div className="flex items-start gap-2 text-slate-600 bg-white rounded px-3 py-2 border border-slate-100">
                <code className="text-slate-800 font-semibold">update_record</code>
                <span className="text-slate-400">– Modify fields</span>
              </div>
              <div className="flex items-start gap-2 text-slate-600 bg-white rounded px-3 py-2 border border-slate-100">
                <code className="text-slate-800 font-semibold">create_record</code>
                <span className="text-slate-400">– New records</span>
              </div>
              <div className="flex items-start gap-2 text-slate-600 bg-white rounded px-3 py-2 border border-slate-100">
                <code className="text-slate-800 font-semibold">log_call</code>
                <span className="text-slate-400">– Log activities</span>
              </div>
              <div className="flex items-start gap-2 text-slate-600 bg-white rounded px-3 py-2 border border-slate-100">
                <code className="text-slate-800 font-semibold">get_my_pipeline</code>
                <span className="text-slate-400">– View deals</span>
              </div>
              <div className="flex items-start gap-2 text-slate-600 bg-white rounded px-3 py-2 border border-slate-100">
                <code className="text-slate-800 font-semibold">get_my_tasks</code>
                <span className="text-slate-400">– View to-dos</span>
              </div>
            </div>

            {/* How it works */}
            <h4 className="text-sm font-semibold text-slate-900 mt-6 mb-3">How It Works</h4>
            <ol className="text-xs text-slate-600 space-y-2">
              <li className="flex gap-2">
                <span className="text-slate-400 font-mono">1.</span>
                <span>Sales rep calls the TalkCRM number</span>
              </li>
              <li className="flex gap-2">
                <span className="text-slate-400 font-mono">2.</span>
                <span>Twilio connects to ElevenLabs voice AI agent</span>
              </li>
              <li className="flex gap-2">
                <span className="text-slate-400 font-mono">3.</span>
                <span>Agent understands natural language requests</span>
              </li>
              <li className="flex gap-2">
                <span className="text-slate-400 font-mono">4.</span>
                <span>Convex backend queries/updates Salesforce via REST API</span>
              </li>
              <li className="flex gap-2">
                <span className="text-slate-400 font-mono">5.</span>
                <span>Agent speaks the result back to the rep</span>
              </li>
            </ol>

            {/* Security Note */}
            <div className="mt-6 p-3 bg-slate-100 rounded-lg">
              <p className="text-xs text-slate-600">
                <strong className="text-slate-800">Security:</strong> TalkCRM uses your existing Salesforce permissions.
                Users can only access and modify records they have permission to in Salesforce.
              </p>
            </div>
          </div>
        </details>

        {/* Help section */}
        <div className="mt-10 pt-8 border-t border-slate-100 text-center">
          <p className="text-sm text-slate-500">
            Need help?{" "}
            <a
              href="https://cal.com/team/simple/talk-crm-onboarding"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-900 hover:text-slate-700 font-medium"
            >
              Schedule a setup call
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
