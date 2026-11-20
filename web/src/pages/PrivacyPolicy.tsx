import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const PrivacyPolicy: React.FC = () => {
  return (
    <div className="min-h-screen bg-pg-cream dark:bg-[#1A1625]">
      {/* Header */}
      <header className="border-b-[3px] border-pg-navy dark:border-[#4A3F66] bg-white dark:bg-[#241E35]">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <Link to="/" className="inline-flex items-center text-pg-navy dark:text-[#D4CCE8] hover:text-pg-coral transition mb-4 font-[Nunito] font-semibold">
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Home
          </Link>
          <h1 className="text-4xl font-bold font-[Fredoka] text-pg-navy dark:text-[#F5F0FF]">
            Privacy Policy
          </h1>
          <p className="text-pg-text-secondary dark:text-[#B8AEDE] mt-2 font-[Nunito]">Last updated: October 31, 2026</p>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white dark:bg-[#241E35] border-[3px] border-pg-navy dark:border-[#4A3F66] rounded-2xl p-8 space-y-8 shadow-[4px_4px_0px_0px_rgba(44,62,80,0.15)]">
          {/* Introduction */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 font-[Fredoka] text-pg-navy dark:text-[#F5F0FF]">1. Introduction</h2>
            <p className="text-pg-text dark:text-[#B8AEDE] leading-relaxed font-[Nunito]">
              BrainLift ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect,
              use, disclose, and safeguard your information when you use our mobile application and web services.
            </p>
          </section>

          {/* Information We Collect */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 font-[Fredoka] text-pg-navy dark:text-[#F5F0FF]">2. Information We Collect</h2>

            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-medium mb-2 font-[Fredoka] text-pg-navy dark:text-[#F5F0FF]">2.1 Personal Information</h3>
                <ul className="list-disc list-inside space-y-2 text-pg-text dark:text-[#B8AEDE] ml-4 font-[Nunito]">
                  <li>Name and email address</li>
                  <li>Account credentials (username and encrypted password)</li>
                  <li>Profile information (avatar, educational level)</li>
                  <li>Payment information (processed securely through third-party providers)</li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-medium mb-2 font-[Fredoka] text-pg-navy dark:text-[#F5F0FF]">2.2 Usage Data</h3>
                <ul className="list-disc list-inside space-y-2 text-pg-text dark:text-[#B8AEDE] ml-4 font-[Nunito]">
                  <li>Study session data and progress</li>
                  <li>Quiz scores and flashcard performance</li>
                  <li>App usage patterns and preferences</li>
                  <li>Device information (type, operating system, app version)</li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-medium mb-2 font-[Fredoka] text-pg-navy dark:text-[#F5F0FF]">2.3 Content Data</h3>
                <ul className="list-disc list-inside space-y-2 text-pg-text dark:text-[#B8AEDE] ml-4 font-[Nunito]">
                  <li>Documents and files you upload</li>
                  <li>Quizzes and flashcards you create</li>
                  <li>Chat messages with AI assistant</li>
                  <li>Shared content and collaboration data</li>
                </ul>
              </div>
            </div>
          </section>

          {/* How We Use Information */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 font-[Fredoka] text-pg-navy dark:text-[#F5F0FF]">3. How We Use Your Information</h2>
            <p className="text-pg-text dark:text-[#B8AEDE] mb-3 font-[Nunito]">We use the collected information for:</p>
            <ul className="list-disc list-inside space-y-2 text-pg-text dark:text-[#B8AEDE] ml-4 font-[Nunito]">
              <li>Providing and maintaining the Service</li>
              <li>Processing your documents to create study materials</li>
              <li>Personalizing your learning experience</li>
              <li>Tracking your progress and performance</li>
              <li>Sending notifications about your study schedule</li>
              <li>Improving our AI algorithms and services</li>
              <li>Customer support and communication</li>
              <li>Compliance with legal obligations</li>
            </ul>
          </section>

          {/* Data Sharing */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 font-[Fredoka] text-pg-navy dark:text-[#F5F0FF]">4. Information Sharing and Disclosure</h2>
            <div className="space-y-3 text-pg-text dark:text-[#B8AEDE] font-[Nunito]">
              <p>We do not sell, trade, or rent your personal information. We may share your information only in these circumstances:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong className="text-pg-navy dark:text-[#F5F0FF]">With your consent:</strong> When you explicitly agree to share</li>
                <li><strong className="text-pg-navy dark:text-[#F5F0FF]">Service providers:</strong> Third-party companies that help us operate our Service (hosting, analytics, payment processing)</li>
                <li><strong className="text-pg-navy dark:text-[#F5F0FF]">Legal requirements:</strong> When required by law or to protect our rights</li>
                <li><strong className="text-pg-navy dark:text-[#F5F0FF]">Business transfers:</strong> In connection with merger, acquisition, or sale of assets</li>
                <li><strong className="text-pg-navy dark:text-[#F5F0FF]">Aggregated data:</strong> Non-identifiable aggregate data for analytics</li>
              </ul>
            </div>
          </section>

          {/* Data Security */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 font-[Fredoka] text-pg-navy dark:text-[#F5F0FF]">5. Data Security</h2>
            <div className="space-y-3 text-pg-text dark:text-[#B8AEDE] font-[Nunito]">
              <p>We implement appropriate technical and organizational measures to protect your data:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Encryption of data in transit and at rest</li>
                <li>Secure password hashing</li>
                <li>Regular security audits and updates</li>
                <li>Access controls and authentication</li>
                <li>Secure cloud infrastructure</li>
              </ul>
              <p className="mt-3">However, no method of transmission over the Internet is 100% secure, and we cannot guarantee absolute security.</p>
            </div>
          </section>

          {/* Data Retention */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 font-[Fredoka] text-pg-navy dark:text-[#F5F0FF]">6. Data Retention</h2>
            <p className="text-pg-text dark:text-[#B8AEDE] font-[Nunito]">
              We retain your personal information for as long as necessary to provide the Service and fulfill the purposes outlined in this policy.
              When you delete your account, we will delete or anonymize your personal information within 30 days, except where retention is required by law.
            </p>
          </section>

          {/* Your Rights */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 font-[Fredoka] text-pg-navy dark:text-[#F5F0FF]">7. Your Data Rights</h2>
            <p className="text-pg-text dark:text-[#B8AEDE] mb-3 font-[Nunito]">Depending on your location, you may have the following rights:</p>
            <ul className="list-disc list-inside space-y-2 text-pg-text dark:text-[#B8AEDE] ml-4 font-[Nunito]">
              <li><strong className="text-pg-navy dark:text-[#F5F0FF]">Access:</strong> Request a copy of your personal data</li>
              <li><strong className="text-pg-navy dark:text-[#F5F0FF]">Correction:</strong> Request correction of inaccurate data</li>
              <li><strong className="text-pg-navy dark:text-[#F5F0FF]">Deletion:</strong> Request deletion of your data</li>
              <li><strong className="text-pg-navy dark:text-[#F5F0FF]">Portability:</strong> Receive your data in a portable format</li>
              <li><strong className="text-pg-navy dark:text-[#F5F0FF]">Objection:</strong> Object to certain uses of your data</li>
              <li><strong className="text-pg-navy dark:text-[#F5F0FF]">Restriction:</strong> Request limited processing of your data</li>
            </ul>
            <p className="mt-3 text-pg-text dark:text-[#B8AEDE] font-[Nunito]">To exercise these rights, contact us at support@getbrainlift.app</p>
          </section>

          {/* GDPR Compliance */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 font-[Fredoka] text-pg-navy dark:text-[#F5F0FF]">8. GDPR Compliance (European Users)</h2>
            <div className="space-y-3 text-pg-text dark:text-[#B8AEDE] font-[Nunito]">
              <p>For users in the European Economic Area (EEA), we process personal data based on:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong className="text-pg-navy dark:text-[#F5F0FF]">Contract:</strong> To provide the Service you requested</li>
                <li><strong className="text-pg-navy dark:text-[#F5F0FF]">Consent:</strong> When you've given explicit consent</li>
                <li><strong className="text-pg-navy dark:text-[#F5F0FF]">Legitimate interests:</strong> To improve and secure our Service</li>
                <li><strong className="text-pg-navy dark:text-[#F5F0FF]">Legal obligations:</strong> To comply with applicable laws</li>
              </ul>
            </div>
          </section>

          {/* CCPA Compliance */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 font-[Fredoka] text-pg-navy dark:text-[#F5F0FF]">9. CCPA Compliance (California Users)</h2>
            <p className="text-pg-text dark:text-[#B8AEDE] font-[Nunito]">
              California residents have additional rights under the California Consumer Privacy Act (CCPA), including the right to:
            </p>
            <ul className="list-disc list-inside space-y-2 text-pg-text dark:text-[#B8AEDE] ml-4 mt-2 font-[Nunito]">
              <li>Know what personal information is collected</li>
              <li>Know whether personal information is sold or disclosed</li>
              <li>Say no to the sale of personal information</li>
              <li>Access personal information</li>
              <li>Request deletion of personal information</li>
              <li>Not be discriminated against for exercising privacy rights</li>
            </ul>
          </section>

          {/* Children's Privacy */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 font-[Fredoka] text-pg-navy dark:text-[#F5F0FF]">10. Children's Privacy</h2>
            <p className="text-pg-text dark:text-[#B8AEDE] font-[Nunito]">
              Our Service is not intended for children under 13. We do not knowingly collect personal information from children under 13.
              If we discover that a child under 13 has provided us with personal information, we will delete such information from our systems.
            </p>
          </section>

          {/* Third-Party Services */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 font-[Fredoka] text-pg-navy dark:text-[#F5F0FF]">11. Third-Party Services</h2>
            <p className="text-pg-text dark:text-[#B8AEDE] mb-3 font-[Nunito]">Our Service may contain links to third-party services. We use the following third-party services:</p>
            <ul className="list-disc list-inside space-y-2 text-pg-text dark:text-[#B8AEDE] ml-4 font-[Nunito]">
              <li><strong className="text-pg-navy dark:text-[#F5F0FF]">Cloud Infrastructure:</strong> Database and hosting</li>
              <li><strong className="text-pg-navy dark:text-[#F5F0FF]">AI Providers:</strong> To generate quizzes, flashcards, summaries and tutor answers, the content you choose to submit (photos, PDFs, typed notes, topics and chat messages) is sent from our servers to third-party AI providers, currently OpenAI and Google (Gemini). They process it only to produce your study material. We do not sell your study materials, and we do not use them for advertising.</li>
              <li><strong className="text-pg-navy dark:text-[#F5F0FF]">Payment Processing:</strong> Subscription and payment handling</li>
              <li><strong className="text-pg-navy dark:text-[#F5F0FF]">Analytics:</strong> Usage analytics and error monitoring</li>
            </ul>
            <p className="mt-3 text-pg-text dark:text-[#B8AEDE] font-[Nunito]">These services have their own privacy policies, and we encourage you to review them.</p>
          </section>

          {/* International Transfers */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 font-[Fredoka] text-pg-navy dark:text-[#F5F0FF]">12. International Data Transfers</h2>
            <p className="text-pg-text dark:text-[#B8AEDE] font-[Nunito]">
              Your information may be transferred to and processed in countries other than your country of residence.
              We ensure appropriate safeguards are in place to protect your information in accordance with this Privacy Policy.
            </p>
          </section>

          {/* Updates to Policy */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 font-[Fredoka] text-pg-navy dark:text-[#F5F0FF]">13. Changes to This Privacy Policy</h2>
            <p className="text-pg-text dark:text-[#B8AEDE] font-[Nunito]">
              We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page
              and updating the "Last updated" date. For material changes, we will provide additional notice through the app or via email.
            </p>
          </section>

          {/* Contact Information */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 font-[Fredoka] text-pg-navy dark:text-[#F5F0FF]">14. Contact Us</h2>
            <p className="text-pg-text dark:text-[#B8AEDE] mb-3 font-[Nunito]">If you have questions about this Privacy Policy or your data, contact us at:</p>
            <div className="text-pg-text dark:text-[#B8AEDE] space-y-1 font-[Nunito]">
              <p><strong className="text-pg-navy dark:text-[#F5F0FF]">Email:</strong> support@getbrainlift.app</p>
              <p><strong className="text-pg-navy dark:text-[#F5F0FF]">Data Protection Officer:</strong> support@getbrainlift.app</p>
              <p><strong className="text-pg-navy dark:text-[#F5F0FF]">Address:</strong> BrainLift Inc.</p>
            </div>
          </section>

          {/* Cookie Policy */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 font-[Fredoka] text-pg-navy dark:text-[#F5F0FF]">15. Cookie Policy</h2>
            <p className="text-pg-text dark:text-[#B8AEDE] mb-3 font-[Nunito]">We use cookies and similar tracking technologies to:</p>
            <ul className="list-disc list-inside space-y-2 text-pg-text dark:text-[#B8AEDE] ml-4 font-[Nunito]">
              <li>Keep you signed in</li>
              <li>Remember your preferences</li>
              <li>Analyze usage patterns</li>
              <li>Improve Service performance</li>
            </ul>
            <p className="mt-3 text-pg-text dark:text-[#B8AEDE] font-[Nunito]">
              You can control cookies through your browser settings. Disabling cookies may limit some features of the Service.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
};

export default PrivacyPolicy;
