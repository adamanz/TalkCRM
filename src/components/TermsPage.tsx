import { Phone, ArrowLeft } from "lucide-react";

interface TermsPageProps {
  onBack: () => void;
}

export default function TermsPage({ onBack }: TermsPageProps) {
  const effectiveDate = "December 18, 2024";

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="flex justify-between h-14 items-center">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
                <Phone className="w-4 h-4 text-white" />
              </div>
              <span className="text-base font-semibold tracking-tight">TalkCRM</span>
            </div>
            <div className="w-16" /> {/* Spacer for centering */}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <div className="mb-8">
          <p className="text-sm text-slate-400 mb-2">Effective: {effectiveDate}</p>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900">
            Terms of Service
          </h1>
        </div>

        <div className="prose prose-slate prose-sm max-w-none">
          <p className="text-slate-600 leading-relaxed">
            Welcome to TalkCRM. These Terms of Service ("Terms") govern your access to and use of our voice-powered CRM assistant services. By using TalkCRM, you agree to these Terms.
          </p>

          <Section title="1. Acceptance of Terms">
            <p>
              By accessing or using TalkCRM's services, including our voice assistant, phone services, web application, and API (collectively, the "Services"), you agree to be bound by these Terms. If you do not agree to these Terms, you may not use the Services.
            </p>
            <p>
              If you are using the Services on behalf of an organization, you represent and warrant that you have the authority to bind that organization to these Terms.
            </p>
          </Section>

          <Section title="2. Description of Services">
            <p>
              TalkCRM provides a voice-first AI assistant that integrates with Salesforce and other CRM platforms. Our Services enable you to:
            </p>
            <ul>
              <li>Update CRM records using voice commands</li>
              <li>Search and retrieve CRM data via phone calls</li>
              <li>Create tasks, log activities, and manage your pipeline</li>
              <li>Access real-time dashboard and activity tracking</li>
            </ul>
          </Section>

          <Section title="3. Account Registration">
            <p>
              To use certain features of the Services, you must create an account. You agree to:
            </p>
            <ul>
              <li>Provide accurate and complete registration information</li>
              <li>Maintain the security of your account credentials</li>
              <li>Promptly notify us of any unauthorized access</li>
              <li>Accept responsibility for all activities under your account</li>
            </ul>
          </Section>

          <Section title="4. User Responsibilities">
            <p>You agree not to:</p>
            <ul>
              <li>Use the Services for any unlawful purpose</li>
              <li>Attempt to gain unauthorized access to our systems</li>
              <li>Interfere with or disrupt the Services</li>
              <li>Transmit harmful code, viruses, or malware</li>
              <li>Impersonate any person or entity</li>
              <li>Use the Services to store or transmit content that infringes on third-party rights</li>
              <li>Use automated means to access the Services without our permission</li>
            </ul>
          </Section>

          <Section title="5. Third-Party Integrations">
            <p>
              TalkCRM integrates with third-party services including Salesforce. Your use of these integrations is subject to:
            </p>
            <ul>
              <li>The terms and policies of those third-party services</li>
              <li>Your valid subscription or license with those providers</li>
              <li>Authorization to connect TalkCRM to your accounts</li>
            </ul>
            <p>
              We are not responsible for the availability, accuracy, or practices of third-party services.
            </p>
          </Section>

          <Section title="6. Data and Privacy">
            <p>
              Your use of the Services is also governed by our <a href="/privacy" className="text-blue-600 hover:text-blue-800 underline">Privacy Policy</a>, which describes how we collect, use, and protect your information.
            </p>
            <p>
              You retain ownership of all data you submit through the Services. You grant us a limited license to process this data solely to provide the Services.
            </p>
          </Section>

          <Section title="7. Intellectual Property">
            <p>
              TalkCRM and its licensors retain all rights in the Services, including all software, content, trademarks, and other intellectual property. These Terms do not grant you any rights to use our trademarks or branding.
            </p>
          </Section>

          <Section title="8. Payment and Billing">
            <p>
              Certain features of the Services may require payment. By subscribing to paid features:
            </p>
            <ul>
              <li>You agree to pay all applicable fees</li>
              <li>Fees are non-refundable except as required by law</li>
              <li>We may change pricing with 30 days notice</li>
              <li>Failure to pay may result in suspension of your account</li>
            </ul>
          </Section>

          <Section title="9. Service Availability">
            <p>
              We strive to maintain high availability but do not guarantee uninterrupted access. We may:
            </p>
            <ul>
              <li>Perform maintenance that temporarily affects availability</li>
              <li>Modify or discontinue features with reasonable notice</li>
              <li>Suspend accounts that violate these Terms</li>
            </ul>
          </Section>

          <Section title="10. Disclaimers">
            <p>
              THE SERVICES ARE PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED. WE DO NOT WARRANT THAT THE SERVICES WILL BE ERROR-FREE, SECURE, OR UNINTERRUPTED.
            </p>
            <p>
              We are not responsible for any decisions made based on information provided through the Services. Voice recognition and AI systems may not always be accurate.
            </p>
          </Section>

          <Section title="11. Limitation of Liability">
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, TALKCRM SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES.
            </p>
            <p>
              OUR TOTAL LIABILITY FOR ANY CLAIMS ARISING FROM THESE TERMS OR THE SERVICES SHALL NOT EXCEED THE AMOUNT YOU PAID US IN THE TWELVE MONTHS PRECEDING THE CLAIM.
            </p>
          </Section>

          <Section title="12. Indemnification">
            <p>
              You agree to indemnify and hold harmless TalkCRM and its officers, directors, employees, and agents from any claims, damages, or expenses arising from:
            </p>
            <ul>
              <li>Your use of the Services</li>
              <li>Your violation of these Terms</li>
              <li>Your violation of any third-party rights</li>
            </ul>
          </Section>

          <Section title="13. Termination">
            <p>
              You may terminate your account at any time. We may suspend or terminate your access if you violate these Terms or for any reason with reasonable notice.
            </p>
            <p>
              Upon termination, your right to use the Services ceases immediately. We may retain certain data as required by law or for legitimate business purposes.
            </p>
          </Section>

          <Section title="14. Changes to Terms">
            <p>
              We may modify these Terms at any time. We will notify you of material changes via email or through the Services. Continued use after changes constitutes acceptance of the modified Terms.
            </p>
          </Section>

          <Section title="15. Governing Law">
            <p>
              These Terms are governed by the laws of the State of Delaware, without regard to conflict of law principles. Any disputes shall be resolved in the courts of Delaware.
            </p>
          </Section>

          <Section title="16. Contact">
            <p>
              If you have questions about these Terms, please contact us at:
            </p>
            <p className="mt-2">
              <strong>Email:</strong> legal@talkcrm.io<br />
              <strong>Address:</strong> TalkCRM, Inc.
            </p>
          </Section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-100 py-8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-sm text-slate-400">
            © {new Date().getFullYear()} TalkCRM. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-slate-900 mb-3">{title}</h2>
      <div className="text-slate-600 leading-relaxed space-y-3">{children}</div>
    </section>
  );
}
