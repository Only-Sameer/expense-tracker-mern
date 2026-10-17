import React from 'react';
import { Link } from 'react-router-dom';

const LAST_UPDATED = '17 October 2026';
const CONTACT = 'singh.sameer131207@gmail.com';
const OPERATOR = 'Sameer';
const SITE = 'Budgetry';
const JURISDICTION = 'These terms and this policy are governed by the laws of India. Subject to applicable mandatory law and rules on jurisdiction, courts at Visakhapatnam, Andhra Pradesh, India will have jurisdiction over disputes relating to this service.';

const legal = {
  privacy: {
    title: 'Privacy Policy', updated: LAST_UPDATED,
    sections: [
      ['Who operates Budgetry?', 'Budgetry is an expense-tracking project operated by Sameer. For privacy questions, requests, or complaints, contact singh.sameer131207@gmail.com.'],
      ['Information we collect', 'When you create an account, we process your name and email address and store a password hash rather than your plain-text password. When you use the tracker, we process the expense details you choose to enter, such as amount, category, date, and optional note. The app uses HttpOnly access and refresh cookies, browser local storage for theme, onboarding and consent preferences, and session metadata needed to show active logins. Security audit events record action type, success, approximate network address, user-agent and timestamp, not expense notes or passwords. Hosting infrastructure may produce limited technical logs for security and reliability.'],
      ['How we use information', 'We use account information to create accounts and authenticate sessions; expense information to display, search, summarize, and export your records; and essential technical data to secure, debug, and maintain the service. We do not sell personal data or use it for targeted advertising. Budgetry does not use advertising or behavioural analytics trackers. If configured by the operator, Cloudflare Turnstile processes anti-bot/security signals during registration and some sign-in attempts; Google Identity Services processes credentials when a user chooses Google sign-in; and Sentry receives technical error messages, stack traces and route metadata. These integrations remain disabled while their respective environment keys are empty.'],
      ['Legal framework', 'We aim to handle personal data in accordance with applicable Indian law, including the Digital Personal Data Protection Act, 2023 and the Digital Personal Data Protection Rules, 2025 to the extent and when their provisions apply under the relevant commencement notifications. This notice is a plain-language summary and does not by itself guarantee legal compliance.'],
      ['Storage and service providers', 'The current deployment uses Render for hosting and MongoDB Atlas for the database. The page also loads the Inter font family from Google Fonts, so the browser requests font resources from Google. Optional integrations are Cloudflare Turnstile for anti-bot verification, Google Identity Services for sign-in and Sentry for error diagnostics; these services are contacted only when configured and/or when a user chooses Google sign-in. Their own terms and privacy notices apply. Keep configuration and this inventory in sync.'],
      ['Sharing', 'We do not share expense records with advertisers. Information may be processed by the infrastructure providers described above, disclosed when required by law, or used where reasonably necessary to address fraud, security incidents, or misuse of the service. We do not publish user profiles or expense histories.'],
      ['Retention and deletion', 'We retain account and expense data while your account remains active, unless a different period is needed or required by law. The app lets you export records and delete your account; account deletion removes the account and its associated expenses from the application database. Service-provider backups and technical logs may follow separate retention cycles that the application does not control.'],
      ['Your choices and privacy requests', 'You can review and export records, edit expense details, and request deletion of your account from the app. You may send privacy requests or complaints to singh.sameer131207@gmail.com. We will respond in accordance with applicable law. Do not put passwords, payment-card details, government identifiers, or other highly sensitive information in optional expense notes.'],
      ['Security and children', 'The app uses bcrypt password hashes, short-lived signed access sessions, rotating refresh tokens stored only as database hashes, HTTPS/HttpOnly cookies, origin validation, request rate limits, server-side validation and server-side administrator allowlisting. If configured, CAPTCHA verification is performed server-side. Optional Sentry reporting sends redacted technical diagnostic events only. No internet service can promise perfect security. The app does not currently verify age; parents and guardians should assess whether a child may use the service under applicable law.'],
      ['Policy updates and governing law', 'We may revise this policy as the service changes. The updated date above indicates the latest revision. ' + JURISDICTION],
      ['Contact', 'Privacy contact: singh.sameer131207@gmail.com. Operator: Sameer.']
    ]
  },
  terms: {
    title: 'Terms and Conditions', updated: LAST_UPDATED,
    sections: [
      ['About these terms', 'Budgetry is an expense-tracking project operated by Sameer. By creating an account or using the service, you agree to these terms and the Privacy Policy. If you do not agree, do not use the service. Contact: singh.sameer131207@gmail.com.'],
      ['Eligibility and your account', 'Provide accurate account details, protect your sign-in credentials, and notify the operator if you suspect unauthorized access. You are responsible for activity performed through your account, subject to applicable law. Do not access or attempt to access another person’s account or records.'],
      ['Permitted use', 'Use Budgetry for lawful personal expense tracking. Do not misuse the service, disrupt availability, upload malicious content, test or bypass access controls without permission, interfere with another user, or use it for unlawful purposes.'],
      ['No financial or professional advice', 'Budgetry records and summarizes information you enter. It does not provide financial, investment, tax, accounting, or legal advice. Charts and totals depend on the accuracy of your entries and may be affected by technical issues. Independently verify figures before relying on them.'],
      ['Your records and exports', 'You retain any rights you have in the information you submit. You permit Budgetry to process that information only as reasonably necessary to operate, secure, and maintain the service, subject to the Privacy Policy and applicable law. You can export data from the application. Keep your own backup of any records you need.'],
      ['Account deletion', 'You can delete your account from the dashboard. Deletion removes your account and associated expense records from the application database and may not be reversible. Backups or provider logs can persist temporarily under separate retention processes or legal requirements.'],
      ['Availability and changes', 'The service is provided on an as-available basis to the extent permitted by law. We do not promise uninterrupted availability, error-free operation, or that data will never be lost. We may change, suspend, or discontinue parts of the service for maintenance, security, misuse, or legal reasons, providing notice where required.'],
      ['Liability', 'To the extent permitted by applicable law, the operator is not responsible for indirect or consequential losses arising from use of the service. Nothing in these terms excludes a right or liability that cannot lawfully be excluded or limited.'],
      ['Governing law and jurisdiction', JURISDICTION],
      ['Contact', 'For questions about these terms, contact singh.sameer131207@gmail.com. Operator: Sameer.']
    ]
  },
  cookies: {
    title: 'Cookie Policy', updated: LAST_UPDATED,
    sections: [
      ['What the app stores', 'Budgetry uses essential HttpOnly cookies for access and rotating refresh sessions, plus browser local storage for theme, onboarding, and cookie-choice preferences. It does not use advertising or behavioural analytics trackers. The page loads font assets from Google Fonts. Optional Cloudflare Turnstile, Google Identity Services and Sentry are enabled only through environment configuration or when Google sign-in is selected.'],
      ['Authentication cookie', 'The expense_auth cookie carries a short-lived signed access session (about 15 minutes). The budgetry_refresh cookie carries a rotating refresh token, is HttpOnly and scoped to auth endpoints, and can keep a checked-in device signed in for up to 30 days of sliding activity (or a shorter session if you uncheck “Keep me signed in”). Production should use Secure cookies and SameSite=Lax; logging out, revoking a session, password reset, or refresh-token reuse detection invalidates server-side sessions.'],
      ['Theme preference', 'The expense-theme key in browser local storage remembers whether you chose dark or light appearance. It is stored in your browser and is not sent to the API as a cookie.'],
      ['Privacy choice', 'The expense-cookie-consent key in browser local storage remembers your cookie-choice setting, timestamp, and policy version so the app can remember your selection.'],
      ['Optional tracking', 'Budgetry does not use advertising or behavioural analytics. The Inter font is loaded from Google Fonts. When configured, Cloudflare Turnstile and Google Identity Services load third-party scripts for security verification and sign-in; Sentry sends technical error diagnostics only when its DSN is configured. These tools are not advertising or behavioural analytics trackers. The site operator must update the keys and this notice together if providers change.'],
      ['Changing your choices', 'Use Cookie settings in the website footer to change the saved choice. You can also clear cookies and site storage through your browser settings; doing so may sign you out or reset preferences.'],
      ['Contact and governing law', 'For questions about this policy, contact singh.sameer131207@gmail.com. Operator: Sameer. This policy is governed by the laws of India, subject to applicable mandatory requirements. Last updated: 17 October 2026.']
    ]
  }
};

export default function Legal({ page }) {
  const data = legal[page] || legal.privacy;
  return <article className="legal-page">
    <span className="eyebrow">BUDGETRY · INFORMATION</span>
    <h1>{data.title}</h1>
    <p className="muted">Last updated: {data.updated}</p>
    <div className="legal-notice"><strong>Important:</strong> This page explains the current product at a high level. It is not legal advice; the operator should review the notice and actual data handling with qualified counsel and update it as the service changes.</div>
    {data.sections.map(([heading, content]) => <section key={heading}><h2>{heading}</h2><p>{content}</p></section>)}
    <p className="legal-links"><Link to="/privacy">Privacy Policy</Link> · <Link to="/terms">Terms and Conditions</Link> · <Link to="/cookies">Cookie Policy</Link></p>
  </article>;
}
