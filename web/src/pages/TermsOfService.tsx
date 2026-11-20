import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const TermsOfService: React.FC = () => {
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
            Terms of Service
          </h1>
          <p className="text-pg-text-secondary dark:text-[#B8AEDE] mt-2 font-[Nunito]">Last updated: March 5, 2026</p>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white dark:bg-[#241E35] border-[3px] border-pg-navy dark:border-[#4A3F66] rounded-2xl p-8 space-y-8 shadow-[4px_4px_0px_0px_rgba(44,62,80,0.15)]">
          {/* Introduction */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 font-[Fredoka] text-pg-navy dark:text-[#F5F0FF]">1. Agreement to Terms</h2>
            <p className="text-pg-text dark:text-[#B8AEDE] leading-relaxed font-[Nunito]">
              By accessing or using BrainLift ("Service"), you agree to be bound by these Terms of Service ("Terms").
              If you disagree with any part of these terms, you do not have permission to access the Service.
            </p>
          </section>

          {/* Use License */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 font-[Fredoka] text-pg-navy dark:text-[#F5F0FF]">2. Use License</h2>
            <p className="text-pg-text dark:text-[#B8AEDE] mb-3 font-[Nunito]">Permission is granted to temporarily use BrainLift for personal, non-commercial purposes. This is the grant of a license, not a transfer of title, and under this license you may not:</p>
            <ul className="list-disc list-inside space-y-2 text-pg-text dark:text-[#B8AEDE] ml-4 font-[Nunito]">
              <li>Modify or copy the materials</li>
              <li>Use the materials for any commercial purpose or public display</li>
              <li>Attempt to reverse engineer any software contained in BrainLift</li>
              <li>Remove any copyright or proprietary notations from the materials</li>
            </ul>
          </section>

          {/* Account Terms */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 font-[Fredoka] text-pg-navy dark:text-[#F5F0FF]">3. Account Terms</h2>
            <div className="space-y-3 text-pg-text dark:text-[#B8AEDE] font-[Nunito]">
              <p>When you create an account with us, you must provide information that is accurate, complete, and current at all times.</p>
              <p>You are responsible for safeguarding the password and for all activities that occur under your account.</p>
              <p>You must be at least 13 years of age to use this Service. By using this Service, you represent that you are at least 13 years old.</p>
            </div>
          </section>

          {/* Acceptable Use */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 font-[Fredoka] text-pg-navy dark:text-[#F5F0FF]">4. Acceptable Use</h2>
            <p className="text-pg-text dark:text-[#B8AEDE] mb-3 font-[Nunito]">You agree not to use the Service to:</p>
            <ul className="list-disc list-inside space-y-2 text-pg-text dark:text-[#B8AEDE] ml-4 font-[Nunito]">
              <li>Upload or transmit viruses or malicious code</li>
              <li>Violate any applicable laws or regulations</li>
              <li>Infringe upon intellectual property rights</li>
              <li>Harass, abuse, or harm other users</li>
              <li>Create multiple accounts for fraudulent purposes</li>
              <li>Share your account credentials with others</li>
              <li>Use automated systems or scripts to access the Service</li>
            </ul>
          </section>

          {/* Content and Intellectual Property */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 font-[Fredoka] text-pg-navy dark:text-[#F5F0FF]">5. Content and Intellectual Property</h2>
            <div className="space-y-3 text-pg-text dark:text-[#B8AEDE] font-[Nunito]">
              <h3 className="text-xl font-medium text-pg-navy dark:text-[#F5F0FF] font-[Fredoka]">5.1 Your Content</h3>
              <p>You retain all rights to content you upload to BrainLift. By uploading content, you grant us a worldwide, non-exclusive, royalty-free license to use, store, and process your content solely for the purpose of providing the Service.</p>

              <h3 className="text-xl font-medium text-pg-navy dark:text-[#F5F0FF] mt-4 font-[Fredoka]">5.2 AI-Generated Content</h3>
              <p>Content generated by our AI tools is provided for educational purposes. While we strive for accuracy, we make no warranties about the completeness, reliability, or accuracy of AI-generated content.</p>

              <h3 className="text-xl font-medium text-pg-navy dark:text-[#F5F0FF] mt-4 font-[Fredoka]">5.3 Our Intellectual Property</h3>
              <p>The Service and its original content (excluding user content) remain the property of BrainLift and are protected by intellectual property laws.</p>
            </div>
          </section>

          {/* Payment Terms */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 font-[Fredoka] text-pg-navy dark:text-[#F5F0FF]">6. Payment and Subscription Terms</h2>
            <div className="space-y-3 text-pg-text dark:text-[#B8AEDE] font-[Nunito]">
              <h3 className="text-xl font-medium text-pg-navy dark:text-[#F5F0FF] font-[Fredoka]">6.1 Subscription Plans</h3>
              <p>BrainLift offers the following auto-renewable subscription plans:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong className="text-pg-navy dark:text-[#F5F0FF]">Weekly</strong> — billed every week</li>
                <li><strong className="text-pg-navy dark:text-[#F5F0FF]">Monthly</strong> — billed every month</li>
                <li><strong className="text-pg-navy dark:text-[#F5F0FF]">Yearly</strong> — billed every year</li>
              </ul>
              <p>Prices are displayed in the app at the time of purchase and may vary by region.</p>

              <h3 className="text-xl font-medium text-pg-navy dark:text-[#F5F0FF] mt-4 font-[Fredoka]">6.2 Billing and Renewal</h3>
              <p>Payment is charged to your Apple ID account (or Google Play account) at confirmation of purchase. Subscriptions automatically renew unless auto-renew is turned off at least 24 hours before the end of the current billing period. Your account will be charged for renewal within 24 hours prior to the end of the current period at the same price.</p>

              <h3 className="text-xl font-medium text-pg-navy dark:text-[#F5F0FF] mt-4 font-[Fredoka]">6.3 Managing and Cancelling Subscriptions</h3>
              <p>You can manage or cancel your subscription at any time through your device settings:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong className="text-pg-navy dark:text-[#F5F0FF]">iOS:</strong> Settings → [Your Name] → Subscriptions</li>
                <li><strong className="text-pg-navy dark:text-[#F5F0FF]">Android:</strong> Google Play Store → Menu → Subscriptions</li>
              </ul>
              <p>Cancellation takes effect at the end of the current billing period. You will retain access to premium features until the end of your paid period.</p>

              <h3 className="text-xl font-medium text-pg-navy dark:text-[#F5F0FF] mt-4 font-[Fredoka]">6.4 Free Trials</h3>
              <p>If offered, any unused portion of a free trial period will be forfeited when you purchase a subscription. Free trial eligibility is determined by Apple or Google and may be limited to one trial per user.</p>

              <h3 className="text-xl font-medium text-pg-navy dark:text-[#F5F0FF] mt-4 font-[Fredoka]">6.5 Refunds</h3>
              <p>All purchases are final and non-refundable, except as required by applicable law. Refund requests for App Store purchases must be directed to Apple; refund requests for Google Play purchases must be directed to Google.</p>

              <h3 className="text-xl font-medium text-pg-navy dark:text-[#F5F0FF] mt-4 font-[Fredoka]">6.6 Price Changes</h3>
              <p>We reserve the right to modify subscription pricing. Existing subscribers will receive at least 30 days notice before any price change takes effect. Continued use of the Service after a price change constitutes acceptance of the new pricing.</p>
            </div>
          </section>

          {/* Privacy and Data Protection */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 font-[Fredoka] text-pg-navy dark:text-[#F5F0FF]">7. Privacy and Data Protection</h2>
            <p className="text-pg-text dark:text-[#B8AEDE] font-[Nunito]">
              Your use of the Service is also governed by our{' '}
              <Link to="/privacy" className="text-pg-indigo dark:text-[#7C6FF6] underline hover:text-pg-coral transition">Privacy Policy</Link>.
              Please review our Privacy Policy, which also governs the Site and informs users of our data collection practices.
            </p>
          </section>

          {/* Disclaimers and Limitations */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 font-[Fredoka] text-pg-navy dark:text-[#F5F0FF]">8. Disclaimers and Limitations of Liability</h2>
            <div className="space-y-3 text-pg-text dark:text-[#B8AEDE] font-[Nunito]">
              <p className="uppercase font-semibold">
                THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED.
              </p>
              <p>
                BrainLift shall not be liable for any indirect, incidental, special, consequential, or punitive damages
                resulting from your use or inability to use the Service.
              </p>
              <p>
                We do not guarantee that the Service will be uninterrupted, secure, or error-free.
              </p>
            </div>
          </section>

          {/* Termination */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 font-[Fredoka] text-pg-navy dark:text-[#F5F0FF]">9. Termination</h2>
            <p className="text-pg-text dark:text-[#B8AEDE] font-[Nunito]">
              We may terminate or suspend your account immediately, without prior notice or liability,
              for any reason whatsoever, including without limitation if you breach the Terms.
            </p>
          </section>

          {/* Governing Law */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 font-[Fredoka] text-pg-navy dark:text-[#F5F0FF]">10. Governing Law</h2>
            <p className="text-pg-text dark:text-[#B8AEDE] font-[Nunito]">
              These Terms shall be governed and construed in accordance with the laws of the United States,
              without regard to its conflict of law provisions. Any disputes arising from these Terms will be
              resolved through binding arbitration.
            </p>
          </section>

          {/* Changes to Terms */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 font-[Fredoka] text-pg-navy dark:text-[#F5F0FF]">11. Changes to Terms</h2>
            <p className="text-pg-text dark:text-[#B8AEDE] font-[Nunito]">
              We reserve the right to modify or replace these Terms at any time. If a revision is material,
              we will provide at least 30 days notice prior to any new terms taking effect.
            </p>
          </section>

          {/* Contact Information */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 font-[Fredoka] text-pg-navy dark:text-[#F5F0FF]">12. Contact Information</h2>
            <p className="text-pg-text dark:text-[#B8AEDE] font-[Nunito]">
              If you have any questions about these Terms, please contact us at:
            </p>
            <div className="mt-3 text-pg-text dark:text-[#B8AEDE] font-[Nunito]">
              <p><strong className="text-pg-navy dark:text-[#F5F0FF]">Email:</strong> support@getbrainlift.app</p>
              <p><strong className="text-pg-navy dark:text-[#F5F0FF]">Address:</strong> BrainLift Inc.</p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default TermsOfService;
