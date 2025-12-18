import { useState } from "react";
import { OptimizedVideo } from "./components/OptimizedVideo";
import { useScrollAnimation } from "./hooks/useScrollAnimation";
import { VoiceWaves } from "./components/VoiceWaves";
import { FloatingOrbs } from "./components/FloatingOrbs";
import { AnimatedGradient } from "./components/AnimatedGradient";

export default function LandingPage({ onLogin, onSignup }: { onLogin: () => void, onSignup: () => void }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white text-slate-900 selection:bg-blue-50">
      {/* Banner */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100/50 text-center py-2.5 px-4 text-xs font-medium text-slate-700">
        Salesforce package now in beta <span className="mx-2 text-slate-400">·</span> <a href="#" onClick={(e) => { e.preventDefault(); onSignup(); }} className="text-blue-600 hover:text-blue-700 font-semibold transition-colors">Try it now</a>
      </div>

      {/* Navigation */}
      <nav className="border-b border-slate-200/60 sticky top-0 bg-white/70 backdrop-blur-xl z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-md flex items-center justify-center text-white font-semibold text-sm shadow-sm">
                T
              </div>
              <span className="text-lg font-semibold tracking-tight text-slate-900">TalkCRM</span>
            </div>
            
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Features</a>
              <a href="#how-it-works" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">How it Works</a>
              <a href="#pricing" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Pricing</a>
              <div className="flex items-center gap-3 ml-4">
                <button onClick={onLogin} className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
                  Log in
                </button>
                <button onClick={onSignup} className="text-sm font-medium bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-all shadow-sm hover:shadow">
                  Get Started
                </button>
              </div>
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden">
              <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 text-slate-600">
                <span className="sr-only">Open menu</span>
                {isMenuOpen ? (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {isMenuOpen && (
          <div className="md:hidden border-t border-slate-100 bg-white absolute w-full">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              <a href="#features" className="block px-3 py-2 text-base font-medium text-slate-600 hover:bg-slate-50 rounded-md">Features</a>
              <a href="#how-it-works" className="block px-3 py-2 text-base font-medium text-slate-600 hover:bg-slate-50 rounded-md">How it Works</a>
              <a href="#pricing" className="block px-3 py-2 text-base font-medium text-slate-600 hover:bg-slate-50 rounded-md">Pricing</a>
              <div className="mt-4 pt-4 border-t border-slate-100">
                <button onClick={onLogin} className="block w-full text-left px-3 py-2 text-base font-medium text-slate-600 hover:bg-slate-50 rounded-md">
                  Log in
                </button>
                <button onClick={onSignup} className="block w-full text-left px-3 py-2 text-base font-medium text-blue-600 hover:bg-blue-50 rounded-md">
                  Sign up
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>

      <main>
        {/* Hero Section */}
        <section className="pt-24 pb-20 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto relative overflow-hidden">
          {/* Animated background elements */}
          <AnimatedGradient />
          <FloatingOrbs />
          <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-40">
            <VoiceWaves />
          </div>
          
          <div className="text-center max-w-3xl mx-auto relative z-10">
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-semibold tracking-tight text-slate-900 mb-6 animate-[fadeInUp_0.8s_ease-out] leading-[1.1]">
              Your voice is the <br/>
              <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 bg-clip-text text-transparent animate-[gradient_3s_ease_infinite] bg-[length:200%_auto]">
                fastest interface
              </span>
              <br/>
              <span className="text-slate-900">to your CRM</span>
            </h1>
            <p className="text-lg md:text-xl text-slate-600 mb-10 max-w-xl mx-auto leading-relaxed animate-[fadeInUp_0.8s_ease-out_0.2s_both] font-normal">
              TalkCRM updates Salesforce while you drive, walk, or grab coffee. Just talk naturally, and we handle the data entry.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 animate-[fadeInUp_0.8s_ease-out_0.4s_both]">
              <button onClick={onSignup} className="w-full sm:w-auto px-6 py-3 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition-all shadow-sm hover:shadow">
                Start for free
              </button>
              <button onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })} className="w-full sm:w-auto px-6 py-3 bg-white text-slate-700 border border-slate-300 font-medium rounded-lg hover:bg-slate-50 hover:border-slate-400 transition-all">
                See how it works
              </button>
            </div>
            <p className="mt-8 text-xs text-slate-500 animate-[fadeInUp_0.8s_ease-out_0.6s_both]">
              No credit card required · Works with any phone
            </p>
          </div>
        </section>

        {/* Demo / Hero Video */}
        <section className="px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto mb-32">
          <div className="relative rounded-xl overflow-hidden border border-slate-200/80 shadow-lg group bg-white">
             {/* Subtle gradient glow effect */}
             <div className="absolute -inset-px bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-50 rounded-xl opacity-50 group-hover:opacity-75 transition duration-500 -z-10"></div>
             
             <div className="relative bg-slate-50 rounded-lg overflow-hidden aspect-video border border-slate-200/60">
                <OptimizedVideo
                  src="/talkcrm-demo.mp4"
                  className="w-full h-full object-cover"
                  autoPlay
                  loop
                  muted
                  playsInline
                  fallback={
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 flex items-center justify-center">
                      <div className="w-full max-w-4xl mx-auto p-8">
                        <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-6">
                          <div className="flex gap-3 mb-6">
                            <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                            <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                            <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                            <div className="flex-1"></div>
                            <div className="bg-white/10 px-3 py-1 rounded text-xs text-white/70">talkcrm.com/dashboard</div>
                          </div>
                          <div className="space-y-4">
                            <div className="flex gap-4 items-start animate-pulse">
                              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-2xl flex-shrink-0">
                                🎤
                              </div>
                              <div className="bg-blue-500/20 backdrop-blur-sm p-4 rounded-2xl rounded-tl-none text-white/90 text-sm max-w-md">
                                "Update the Acme opportunity to Closed Won and set a reminder to call Sarah next Tuesday."
                              </div>
                            </div>
                            <div className="flex gap-4 items-start flex-row-reverse animate-pulse" style={{ animationDelay: '0.5s' }}>
                              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-2xl flex-shrink-0">
                                🤖
                              </div>
                              <div className="bg-white/10 backdrop-blur-sm border border-white/20 p-4 rounded-2xl rounded-tr-none text-white/80 text-sm max-w-md">
                                <div className="flex items-center gap-2 text-green-400 mb-2 font-medium text-xs">
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                  Updated Acme Inc.
                                </div>
                                <p className="text-xs">Opportunity stage changed to <span className="font-semibold text-white">Closed Won</span>.</p>
                                <p className="text-xs mt-1">Task created: <span className="font-semibold text-white">Call Sarah</span> (Due: Next Tuesday)</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  }
                />
             </div>
          </div>
        </section>

        {/* Features Grid */}
        <section id="features" className="py-32 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <FeaturesHeader />
            
            <div className="grid md:grid-cols-3 gap-8">
              <FeatureCard 
                icon="⚡️"
                title="Instant Updates"
                description="Update fields, change stages, and log notes in seconds. No clicks required."
              />
              <FeatureCard 
                icon="🔍"
                title="Smart Search"
                description="Ask 'What's the status of the Acme deal?' and get an answer instantly."
              />
              <FeatureCard 
                icon="📱"
                title="Works on Any Phone"
                description="No app to install. Just call your dedicated assistant number from your phone."
              />
              <FeatureCard 
                icon="📝"
                title="Meeting Summaries"
                description="Call right after a meeting to dump your brain. We structure it into Salesforce."
              />
              <FeatureCard 
                icon="📅"
                title="Task Management"
                description="Create follow-up tasks and reminders naturally as you think of them."
              />
              <FeatureCard 
                icon="🔒"
                title="Enterprise Secure"
                description="Your data is encrypted and synced directly with your Salesforce instance."
              />
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="py-32 bg-slate-50/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <HowItWorksHeader />
            <HowItWorksSteps />
          </div>
        </section>

        {/* CTA */}
        <CTASection onSignup={onSignup} />
      </main>

      <footer className="bg-white py-12 border-t border-slate-200/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-slate-900 rounded flex items-center justify-center text-white text-xs font-bold">
              T
            </div>
            <span className="font-bold text-slate-900">TalkCRM</span>
          </div>
          <div className="flex gap-8 text-sm text-slate-500">
            <a href="#" className="hover:text-slate-900">Privacy</a>
            <a href="#" className="hover:text-slate-900">Terms</a>
            <a href="#" className="hover:text-slate-900">Contact</a>
          </div>
          <div className="text-sm text-slate-400">
            © {new Date().getFullYear()} TalkCRM. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: string, title: string, description: string }) {
  const { ref, isVisible } = useScrollAnimation({ threshold: 0.2 });
  
  return (
    <div 
      ref={ref as React.RefObject<HTMLDivElement>}
      className={`p-6 rounded-lg bg-white border border-slate-200/60 hover:border-slate-300 hover:shadow-md transition-all duration-300 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
    >
      <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center text-xl mb-4 text-slate-700 border border-slate-200/60">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-slate-900 mb-2">{title}</h3>
      <p className="text-sm text-slate-600 leading-relaxed">
        {description}
      </p>
    </div>
  );
}

function HowItWorksHeader() {
  const { ref, isVisible } = useScrollAnimation({ threshold: 0.3 });
  
  return (
    <div 
      ref={ref as React.RefObject<HTMLDivElement>}
      className={`text-center mb-16 transition-all duration-700 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
      }`}
    >
      <h2 className="text-3xl md:text-4xl font-semibold text-slate-900 mb-3">
        How it works
      </h2>
      <p className="text-base text-slate-600 max-w-xl mx-auto">
        Three simple steps to transform how you manage Salesforce
      </p>
    </div>
  );
}

function FeaturesHeader() {
  const { ref, isVisible } = useScrollAnimation({ threshold: 0.3 });
  
  return (
    <div 
      ref={ref as React.RefObject<HTMLDivElement>}
      className={`text-center max-w-3xl mx-auto mb-16 transition-all duration-700 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-8'
      }`}
    >
      <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl mb-4">
        Everything you need to manage deals on the go.
      </h2>
      <p className="mt-4 text-lg text-slate-500">
        Stop wrestling with the Salesforce mobile app. Just talk.
      </p>
    </div>
  );
}

function CTASection({ onSignup }: { onSignup: () => void }) {
  const { ref, isVisible } = useScrollAnimation({ threshold: 0.3 });
  
  return (
    <section className="py-24 bg-slate-900 text-white relative overflow-hidden">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] opacity-40"></div>
      
      <div className="max-w-3xl mx-auto px-4 text-center relative z-10">
        <div
          ref={ref as React.RefObject<HTMLDivElement>}
          className={`transition-all duration-500 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          <h2 className="text-3xl md:text-4xl font-semibold mb-4 text-white">
            Ready to ditch the data entry?
          </h2>
          <p className="text-base text-slate-400 mb-8 max-w-xl mx-auto">
            Join the beta today and get your own voice assistant for Salesforce.
          </p>
          <button 
            onClick={onSignup} 
            className="px-6 py-3 bg-white text-slate-900 font-medium rounded-lg hover:bg-slate-100 transition-all shadow-sm hover:shadow"
          >
            Get Started for Free
          </button>
        </div>
      </div>
    </section>
  );
}

function HowItWorksSteps() {
  const step1 = useScrollAnimation({ threshold: 0.2 });
  const step2 = useScrollAnimation({ threshold: 0.2 });
  const step3 = useScrollAnimation({ threshold: 0.2 });
  
  const steps = [
    {
      ref: step1.ref,
      isVisible: step1.isVisible,
      number: 1,
      icon: "📞",
      title: "Call",
      description: "Dial your dedicated TalkCRM number from your registered phone.",
      delay: "0ms"
    },
    {
      ref: step2.ref,
      isVisible: step2.isVisible,
      number: 2,
      icon: "🗣️",
      title: "Speak",
      description: "Tell your assistant what to do, just like talking to a human.",
      delay: "150ms"
    },
    {
      ref: step3.ref,
      isVisible: step3.isVisible,
      number: 3,
      icon: "✅",
      title: "Done",
      description: "Salesforce is updated instantly. You get a confirmation back.",
      delay: "300ms"
    }
  ];

  return (
    <div className="grid md:grid-cols-3 gap-8 lg:gap-12 relative">
      {/* Subtle connecting line */}
      <div className="hidden md:block absolute top-12 left-[12%] right-[12%] h-px bg-slate-200 -z-10"></div>

      {steps.map((step) => (
        <div
          key={step.number}
          ref={step.ref as React.RefObject<HTMLDivElement>}
          className={`text-center relative transition-all duration-500 ${
            step.isVisible 
              ? 'opacity-100 translate-y-0' 
              : 'opacity-0 translate-y-6'
          }`}
          style={{ transitionDelay: step.delay }}
        >
          {/* Icon container */}
          <div className="relative mb-6">
            <div className="relative w-16 h-16 bg-white border border-slate-200/80 rounded-xl flex items-center justify-center mx-auto shadow-sm transform transition-all duration-300 hover:shadow-md group">
              <span className="text-3xl transform transition-transform group-hover:scale-110">
                {step.icon}
              </span>
              
              {/* Number badge */}
              <div className="absolute -top-2 -right-2 w-6 h-6 bg-slate-900 rounded-full flex items-center justify-center text-white font-semibold text-xs shadow-sm">
                {step.number}
              </div>
            </div>
          </div>

          {/* Content */}
          <h3 className="text-xl font-semibold text-slate-900 mb-2">
            {step.title}
          </h3>
          <p className="text-sm text-slate-600 leading-relaxed max-w-xs mx-auto">
            {step.description}
          </p>

          {/* Decorative line below on mobile */}
          {step.number < 3 && (
            <div className="md:hidden mt-8 mb-4 flex justify-center">
              <div className="w-8 h-px bg-slate-200"></div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

