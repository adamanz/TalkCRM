import { Phone, ArrowLeft } from "lucide-react";

interface PrivacyPageProps {
  onBack: () => void;
}

export default function PrivacyPage({ onBack }: PrivacyPageProps) {
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
            Privacy Policy
          </h1>
        </div>

        <div className="prose prose-slate prose-sm max-w-none">
          <p className="text-slate-600 leading-relaxed">
            At TalkCRM, we respect your privacy and are committed to protecting your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Services.
          </p>

          <Section title="1. Information We Collect">
            <h3 className="text-base font-medium text-slate-800 mt-4 mb-2">Information You Provide</h3>
            <ul>
              <li><strong>Account Information:</strong> Name, email address, phone number, and account credentials when you register</li>
              <li><strong>Voice Data:</strong> Audio recordings and transcriptions from your voice interactions with our Services</li>
              <li><strong>CRM Data:</strong> Information you access, create, or modify in connected CRM systems through our Services</li>
              <li><strong>Communication:</strong> Messages you send us for support or feedback</li>
              <li><strong>Payment Information:</strong> Billing details processed by our payment providers</li>
            </ul>

            <h3 className="text-base font-medium text-slate-800 mt-4 mb-2">Information Collected Automatically</h3>
            <ul>
              <li><strong>Usage Data:</strong> How you interact with our Services, features used, and timestamps</li>
              <li><strong>Device Information:</strong> Browser type, operating system, and device identifiers</li>
              <li><strong>Log Data:</strong> IP addresses, access times, and pages visited</li>
              <li><strong>Caller Information:</strong> Phone numbers used to call our Services</li>
            </ul>
          </Section>

          <Section title="2. How We Use Your Information">
            <p>We use the information we collect to:</p>
            <ul>
              <li>Provide, maintain, and improve our Services</li>
              <li>Process voice commands and deliver responses</li>
              <li>Sync data with your connected CRM platforms</li>
              <li>Authenticate your identity and secure your account</li>
              <li>Process payments and manage subscriptions</li>
              <li>Send service updates and important notifications</li>
              <li>Respond to your requests and provide support</li>
              <li>Analyze usage patterns to improve our Services</li>
              <li>Detect, prevent, and address security issues</li>
              <li>Comply with legal obligations</li>
            </ul>
          </Section>

          <Section title="3. Voice Data and AI Processing">
            <p>
              When you use our voice services, your audio is processed to understand commands and generate responses. Here's how we handle voice data:
            </p>
            <ul>
              <li><strong>Processing:</strong> Voice recordings are transcribed and analyzed by our AI systems to execute your commands</li>
              <li><strong>Retention:</strong> Transcriptions may be retained to provide conversation history and improve service quality</li>
              <li><strong>No Training:</strong> We do not use your voice data or CRM content to train AI models without your explicit consent</li>
              <li><strong>Deletion:</strong> You can request deletion of your voice data at any time</li>
            </ul>
          </Section>

          <Section title="4. Data Sharing and Disclosure">
            <p>We do not sell your personal information. We may share your information with:</p>
            <ul>
              <li><strong>Service Providers:</strong> Third parties that help us operate our Services (hosting, analytics, payment processing)</li>
              <li><strong>Connected Platforms:</strong> CRM systems you authorize us to connect with (e.g., Salesforce)</li>
              <li><strong>Legal Requirements:</strong> When required by law, court order, or governmental authority</li>
              <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets</li>
              <li><strong>Protection:</strong> To protect our rights, safety, or property, or that of our users</li>
            </ul>
          </Section>

          <Section title="5. Data Security">
            <p>We implement industry-standard security measures to protect your information:</p>
            <ul>
              <li>Encryption of data in transit (TLS) and at rest</li>
              <li>Secure authentication and access controls</li>
              <li>Regular security assessments and monitoring</li>
              <li>Employee access limited to those who need it</li>
              <li>Incident response procedures</li>
            </ul>
            <p>
              While we strive to protect your information, no method of transmission over the Internet is 100% secure. We cannot guarantee absolute security.
            </p>
          </Section>

          <Section title="6. Data Retention">
            <p>
              We retain your information for as long as your account is active or as needed to provide Services. We may retain certain information as required by law or for legitimate business purposes, such as:
            </p>
            <ul>
              <li>Maintaining records for legal compliance</li>
              <li>Resolving disputes and enforcing agreements</li>
              <li>Preventing fraud and abuse</li>
            </ul>
            <p>
              When you delete your account, we will delete or anonymize your information within 90 days, except as required by law.
            </p>
          </Section>

          <Section title="7. Your Rights and Choices">
            <p>Depending on your location, you may have the following rights:</p>
            <ul>
              <li><strong>Access:</strong> Request a copy of the personal information we hold about you</li>
              <li><strong>Correction:</strong> Request correction of inaccurate information</li>
              <li><strong>Deletion:</strong> Request deletion of your personal information</li>
              <li><strong>Portability:</strong> Request your data in a portable format</li>
              <li><strong>Objection:</strong> Object to certain processing of your information</li>
              <li><strong>Restriction:</strong> Request restriction of processing in certain circumstances</li>
            </ul>
            <p>
              To exercise these rights, contact us at privacy@talkcrm.io. We will respond within 30 days.
            </p>
          </Section>

          <Section title="8. Third-Party Services">
            <p>
              Our Services integrate with third-party platforms like Salesforce. When you connect these services:
            </p>
            <ul>
              <li>We access and process data according to your authorization</li>
              <li>Their privacy policies govern data within their platforms</li>
              <li>You can disconnect integrations at any time through your settings</li>
            </ul>
            <p>
              We recommend reviewing the privacy policies of any third-party services you connect.
            </p>
          </Section>

          <Section title="9. Cookies and Tracking">
            <p>We use cookies and similar technologies to:</p>
            <ul>
              <li>Maintain your session and authentication</li>
              <li>Remember your preferences</li>
              <li>Analyze usage and improve our Services</li>
            </ul>
            <p>
              You can control cookies through your browser settings. Disabling certain cookies may affect functionality.
            </p>
          </Section>

          <Section title="10. Children's Privacy">
            <p>
              Our Services are not directed to children under 16. We do not knowingly collect personal information from children. If we learn we have collected information from a child, we will delete it promptly.
            </p>
          </Section>

          <Section title="11. International Data Transfers">
            <p>
              Your information may be processed in countries other than your own. We ensure appropriate safeguards are in place for international transfers, including:
            </p>
            <ul>
              <li>Standard contractual clauses</li>
              <li>Data processing agreements</li>
              <li>Compliance with applicable data protection laws</li>
            </ul>
          </Section>

          <Section title="12. California Privacy Rights">
            <p>
              California residents have additional rights under the CCPA:
            </p>
            <ul>
              <li>Right to know what personal information is collected</li>
              <li>Right to delete personal information</li>
              <li>Right to opt-out of sale (we do not sell personal information)</li>
              <li>Right to non-discrimination for exercising rights</li>
            </ul>
          </Section>

          <Section title="13. Changes to This Policy">
            <p>
              We may update this Privacy Policy from time to time. We will notify you of material changes by email or through the Services. Your continued use after changes constitutes acceptance of the updated policy.
            </p>
          </Section>

          <Section title="14. Contact Us">
            <p>
              If you have questions or concerns about this Privacy Policy or our data practices, please contact us:
            </p>
            <p className="mt-2">
              <strong>Email:</strong> privacy@talkcrm.io<br />
              <strong>Address:</strong> TalkCRM, Inc.
            </p>
            <p className="mt-4">
              For data protection inquiries in the EU, you may also contact your local data protection authority.
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
