import { useState } from "react";
import { signInWithGoogle } from "@/lib/auth-client";

interface LoginPageProps {
  onBack?: () => void;
}

export function LoginPage({ onBack }: LoginPageProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      setError(err.message || "Failed to sign in with Google");
      setIsLoading(false);
    }
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
          <h2 className="text-xl font-semibold text-slate-900 text-center mb-2">
            Welcome to TalkCRM
          </h2>
          <p className="text-slate-600 text-center text-sm mb-8">
            Sign in to manage your Salesforce with voice commands
          </p>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg mb-6">
              {error}
            </div>
          )}

          {/* Google Sign In Button */}
          <button
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            <span className="text-slate-700 font-medium">
              {isLoading ? "Signing in..." : "Continue with Google"}
            </span>
          </button>

          <div className="mt-6 text-center">
            <p className="text-xs text-slate-500">
              By signing in, you agree to our Terms of Service
              <br />
              and Privacy Policy
            </p>
          </div>
        </div>

        {/* Features */}
        <div className="mt-8 grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center mx-auto mb-2">
              <span className="text-lg">🎙️</span>
            </div>
            <p className="text-xs text-slate-600">Voice Commands</p>
          </div>
          <div>
            <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center mx-auto mb-2">
              <span className="text-lg">☁️</span>
            </div>
            <p className="text-xs text-slate-600">Salesforce Sync</p>
          </div>
          <div>
            <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center mx-auto mb-2">
              <span className="text-lg">🤖</span>
            </div>
            <p className="text-xs text-slate-600">AI Powered</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
