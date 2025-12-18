import { useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import {
  Phone,
  Mic,
  Zap,
  Search,
  Calendar,
  Shield,
  ArrowRight,
  Play,
  CheckCircle2,
  Sparkles,
  Menu,
  X
} from "lucide-react";
import { OptimizedVideo } from "./components/OptimizedVideo";

interface LandingPageProps {
  onLogin: () => void;
  onSignup: () => void;
  onNavigate?: (path: string) => void;
}

export default function LandingPage({ onLogin, onSignup, onNavigate }: LandingPageProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { scrollYProgress } = useScroll();
  const opacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);

  return (
    <div className="min-h-screen bg-white text-slate-900 antialiased">
      {/* Subtle grid background */}
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#00000005_1px,transparent_1px),linear-gradient(to_bottom,#00000005_1px,transparent_1px)] bg-[size:14px_24px] pointer-events-none" />

      {/* Top gradient line */}
      <div className="fixed top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent z-50" />

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex justify-between h-14 items-center">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
                <Phone className="w-4 h-4 text-white" />
              </div>
              <span className="text-base font-semibold tracking-tight">TalkCRM</span>
            </div>

            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">Features</a>
              <a href="#how-it-works" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">How it works</a>
              <a href="#pricing" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">Pricing</a>
            </div>

            <div className="hidden md:flex items-center gap-3">
              <button onClick={onLogin} className="text-sm text-slate-600 hover:text-slate-900 transition-colors px-3 py-1.5">
                Log in
              </button>
              <button onClick={onSignup} className="text-sm font-medium bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors">
                Get started
              </button>
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-2 text-slate-600 hover:text-slate-900"
            >
              {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="md:hidden border-t border-slate-100 bg-white"
          >
            <div className="px-4 py-4 space-y-3">
              <a href="#features" className="block text-sm text-slate-600 hover:text-slate-900">Features</a>
              <a href="#how-it-works" className="block text-sm text-slate-600 hover:text-slate-900">How it works</a>
              <a href="#pricing" className="block text-sm text-slate-600 hover:text-slate-900">Pricing</a>
              <div className="pt-3 border-t border-slate-100 space-y-2">
                <button onClick={onLogin} className="block w-full text-left text-sm text-slate-600">Log in</button>
                <button onClick={onSignup} className="block w-full text-sm font-medium text-slate-900">Sign up</button>
              </div>
            </div>
          </motion.div>
        )}
      </nav>

      <main>
        {/* Hero Section */}
        <section className="pt-32 pb-20 px-4 sm:px-6 relative overflow-hidden">
          <div className="max-w-3xl mx-auto text-center relative z-10">
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium mb-8"
            >
              <Sparkles className="w-3 h-3" />
              <span>Now in public beta</span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight text-slate-900 leading-[1.1] mb-6"
            >
              Update Salesforce
              <br />
              <span className="text-slate-400">in 30 seconds, hands-free</span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-lg text-slate-500 mb-10 max-w-xl mx-auto leading-relaxed"
            >
              Sales reps spend 5+ hours a week on CRM data entry. TalkCRM lets you update Salesforce by voice from your car, between meetings, wherever. Sell more, type less.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-3"
            >
              <button
                onClick={onSignup}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
              >
                Start for free
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' })}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-white text-slate-700 text-sm font-medium rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors"
              >
                <Play className="w-4 h-4" />
                Watch demo
              </button>
            </motion.div>

            {/* Trust text */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="mt-8 text-xs text-slate-400"
            >
              No credit card required · By continuing, you agree to our{" "}
              <button
                onClick={() => onNavigate?.("/terms")}
                className="underline hover:text-slate-600 transition-colors"
              >
                Terms
              </button>{" "}
              and{" "}
              <button
                onClick={() => onNavigate?.("/privacy")}
                className="underline hover:text-slate-600 transition-colors"
              >
                Privacy Policy
              </button>
            </motion.p>
          </div>
        </section>

        {/* Demo Video */}
        <section id="demo" className="px-4 sm:px-6 pb-32">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="max-w-4xl mx-auto"
          >
            <div className="relative rounded-xl overflow-hidden bg-slate-900 border border-slate-200 shadow-2xl shadow-slate-200/50">
              <div className="aspect-video">
                <OptimizedVideo
                  src="/talkcrm-demo.mp4"
                  className="w-full h-full object-cover"
                  autoPlay
                  loop
                  muted
                  playsInline
                  playWithSoundOnScroll
                  fallback={
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
                      <div className="text-center">
                        <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Play className="w-6 h-6 text-white" />
                        </div>
                        <p className="text-white/60 text-sm">Watch TalkCRM in action</p>
                      </div>
                    </div>
                  }
                />
              </div>
            </div>
          </motion.div>
        </section>

        {/* Features */}
        <section id="features" className="py-24 bg-slate-50/50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2 className="text-3xl font-semibold tracking-tight text-slate-900 mb-3">
                Get 5+ hours back every week
              </h2>
              <p className="text-base text-slate-500 max-w-lg mx-auto">
                Stop typing into Salesforce. Just call in and talk. Your pipeline stays accurate without the admin work.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-6">
              <FeatureCard
                icon={Zap}
                title="10x faster updates"
                description="30 seconds by voice vs 5 minutes typing. Update deals, log calls, change stages instantly."
                delay={0}
              />
              <FeatureCard
                icon={Search}
                title="Real-time accuracy"
                description="Update in the moment, not days later. Your pipeline is always current."
                delay={0.1}
              />
              <FeatureCard
                icon={Phone}
                title="Works from anywhere"
                description="No app to open. Call from your car, between meetings, wherever you are."
                delay={0.2}
              />
              <FeatureCard
                icon={Mic}
                title="Natural language"
                description="Just say 'update the Acme deal to Closed Won'—our AI handles the rest."
                delay={0.3}
              />
              <FeatureCard
                icon={Calendar}
                title="Tasks & follow-ups"
                description="Create reminders as you think of them. 'Remind me to call John tomorrow.'"
                delay={0.4}
              />
              <FeatureCard
                icon={Shield}
                title="Your permissions, respected"
                description="Uses your existing Salesforce roles and permissions. No extra admin setup."
                delay={0.5}
              />
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="py-24">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2 className="text-3xl font-semibold tracking-tight text-slate-900 mb-3">
                Setup takes 2 minutes
              </h2>
              <p className="text-base text-slate-500 max-w-lg mx-auto">
                No IT required. No app to install. Just connect and start talking.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
              <StepCard
                number="01"
                title="Connect Salesforce"
                description="One-click OAuth. Uses your existing permissions—no admin setup needed."
              />
              <StepCard
                number="02"
                title="Save the number"
                description="Get your dedicated TalkCRM number. Save it as a contact."
              />
              <StepCard
                number="03"
                title="Start talking"
                description="'Update the Acme deal to Closed Won.' Done in 30 seconds."
              />
            </div>
          </div>
        </section>

        {/* Social Proof */}
        <section className="py-16 border-y border-slate-100">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="text-center"
            >
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-8">
                Trusted by sales teams at
              </p>
              <div className="flex items-center justify-center gap-12 opacity-40 grayscale">
                <div className="text-xl font-semibold text-slate-400">Acme</div>
                <div className="text-xl font-semibold text-slate-400">Globex</div>
                <div className="text-xl font-semibold text-slate-400">Initech</div>
                <div className="text-xl font-semibold text-slate-400">Umbrella</div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl font-semibold tracking-tight text-slate-900 mb-4">
                Stop typing. Start selling.
              </h2>
              <p className="text-base text-slate-500 mb-8 max-w-md mx-auto">
                Get 5+ hours back every week. Your reps will actually use Salesforce when it only takes 30 seconds.
              </p>
              <button
                onClick={onSignup}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
              >
                Start free trial
                <ArrowRight className="w-4 h-4" />
              </button>
              <p className="text-xs text-slate-400 mt-4">
                Free tier available · No credit card required
              </p>
            </motion.div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-100 py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-slate-900 rounded flex items-center justify-center">
                <Phone className="w-3 h-3 text-white" />
              </div>
              <span className="text-sm font-semibold text-slate-900">TalkCRM</span>
            </div>
            <div className="flex gap-8 text-sm text-slate-400">
              <button
                onClick={() => onNavigate?.("/privacy")}
                className="hover:text-slate-600 transition-colors"
              >
                Privacy
              </button>
              <button
                onClick={() => onNavigate?.("/terms")}
                className="hover:text-slate-600 transition-colors"
              >
                Terms
              </button>
              <a href="mailto:hello@talkcrm.io" className="hover:text-slate-600 transition-colors">Contact</a>
            </div>
            <p className="text-sm text-slate-400">
              © {new Date().getFullYear()} TalkCRM
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Feature Card Component
function FeatureCard({
  icon: Icon,
  title,
  description,
  delay
}: {
  icon: any,
  title: string,
  description: string,
  delay: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
      className="p-6 rounded-xl bg-white border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all group"
    >
      <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-slate-900 transition-colors">
        <Icon className="w-5 h-5 text-slate-600 group-hover:text-white transition-colors" />
      </div>
      <h3 className="text-base font-semibold text-slate-900 mb-2">{title}</h3>
      <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
    </motion.div>
  );
}

// Step Card Component
function StepCard({ number, title, description }: { number: string, title: string, description: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="text-center"
    >
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 text-slate-900 font-mono text-sm font-medium mb-4">
        {number}
      </div>
      <h3 className="text-lg font-semibold text-slate-900 mb-2">{title}</h3>
      <p className="text-sm text-slate-500 leading-relaxed max-w-xs mx-auto">{description}</p>
    </motion.div>
  );
}
