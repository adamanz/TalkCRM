import { useState } from "react";
import { motion } from "framer-motion";
import { Phone, ArrowLeft, Mic, Shield, RefreshCw, Loader2 } from "lucide-react";
import { useSignInWithGoogle } from "@/lib/auth-client";

interface LoginPageProps {
  onBack?: () => void;
}

export function LoginPage({ onBack }: LoginPageProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const signInWithGoogle = useSignInWithGoogle();

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
    <div className="min-h-screen bg-[#fafafa] flex flex-col antialiased">
      {/* Subtle grid background */}
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#00000005_1px,transparent_1px),linear-gradient(to_bottom,#00000005_1px,transparent_1px)] bg-[size:14px_24px]" />

      {/* Top gradient accent */}
      <div className="fixed top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

      {/* Header */}
      <header className="relative z-10 px-6 py-4">
        {onBack && (
          <motion.button
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
            Back
          </motion.button>
        )}
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-[360px]"
        >
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-10 h-10 bg-slate-900 rounded-lg mb-4">
              <Phone className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-semibold text-slate-900 tracking-tight">Sign in to TalkCRM</h1>
            <p className="text-sm text-slate-500 mt-1.5">Voice-powered Salesforce assistant</p>
          </div>

          {/* Auth Card */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-6">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg"
              >
                {error}
              </motion.div>
            )}

            {/* Google Sign In Button */}
            <button
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 px-4 py-2.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all text-sm font-medium text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              )}
              <span>{isLoading ? "Signing in..." : "Continue with Google"}</span>
            </button>

            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-xs text-slate-400 text-center leading-relaxed">
                By continuing, you agree to our{" "}
                <a href="#" className="text-slate-500 hover:text-slate-700 underline underline-offset-2">Terms</a>
                {" "}and{" "}
                <a href="#" className="text-slate-500 hover:text-slate-700 underline underline-offset-2">Privacy Policy</a>
              </p>
            </div>
          </div>

          {/* Features - minimal */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mt-8 flex items-center justify-center gap-6 text-xs text-slate-400"
          >
            <div className="flex items-center gap-1.5">
              <Mic className="w-3.5 h-3.5" />
              <span>Voice-first</span>
            </div>
            <div className="w-1 h-1 bg-slate-300 rounded-full" />
            <div className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" />
              <span>Enterprise secure</span>
            </div>
            <div className="w-1 h-1 bg-slate-300 rounded-full" />
            <div className="flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Real-time sync</span>
            </div>
          </motion.div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 px-6 py-4 text-center">
        <p className="text-xs text-slate-400">
          TalkCRM © {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  );
}

export default LoginPage;
