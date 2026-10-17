import React from 'react';
import { Link } from 'react-router-dom';

const legal = {
privacy: {
title: 'Privacy Policy', updated: '[DATE]',
sections: [
['Who operates this service?', 'This template is for [WEBSITE NAME], operated by [COMPANY/OWNER NAME]. Contact: [CONTACT EMAIL]. Replace these placeholders before publishing.'],
['What information is collected?', 'We collect only the information needed to provide the service: your name and email address; a password stored as a bcrypt password hash rather than plain text; and the expense records you choose to save (amount, category, date, and optional note). The service also processes a short-lived authentication cookie and basic request data needed to deliver and secure the service. Do not enter highly sensitive information in expense notes.'],
['Why is it processed?', 'Your name and email identify your account and support sign-in. The password hash verifies your password. Expense records provide the tracker, charts, search, and exports. Authentication cookie data keeps your session signed in. Security logs, if enabled by the hosting provider, are used only to diagnose faults and prevent abuse; configure them to minimize retention and personal data.'],
['Legal basis and India law', 'This template is intended to be reviewed against India’s Digital Personal Data Protection Act, 2023 and applicable rules and commencement notifications in force at publication. The operator should provide required notices, obtain valid consent where required, protect personal data, support grievance redressal, and meet applicable retention and breach duties. Do not assume this template alone satisfies legal obligations.'],
['Sharing and hosting', 'Your data is stored in the MongoDB instance configured by the operator and processed by the hosting providers used to run the frontend and API. No advertising or analytics integrations are included in this codebase. Hosting providers may process limited technical data to operate their infrastructure under their own terms. Add provider names and transfer details here before launch.'],
['Retention and deletion', 'Account information and expense records remain until you delete your account or the operator removes them. Account deletion deletes the account and its expense records from the application database. Backups, security logs, or provider records may persist for a limited period under the operator’s documented retention schedule and applicable law; specify that schedule before launch.'],
['Your choices and rights', 'You can review and export your expense data from the app, correct account and expense details by editing them, and delete your account. Depending on applicable law, you may also have rights to access information, correction, erasure, grievance redressal, and nomination. GDPR-style access, correction, and deletion concepts are described for convenience, but GDPR applies only where legally applicable. Contact [CONTACT EMAIL] for requests.'],
['Children and security', 'The service is not designed for children under the age specified by applicable law. The operator should assess age-related requirements before launch. We use password hashing, access controls, HTTPS in production, and security headers, but no system can guarantee absolute security.'],
['Changes and contact', 'We may update this policy and change the date above. Material changes should be communicated as required by law. Contact [CONTACT EMAIL]. Governing law and jurisdiction: [GOVERNING LAW: India].']
]},
terms: {
title: 'Terms and Conditions', updated: '[DATE]',
sections: [
['Agreement', 'These terms apply to [WEBSITE NAME], operated by [COMPANY/OWNER NAME]. By using the service, you agree to these terms. If you do not agree, do not use it. Replace all bracketed placeholders before publication.'],
['Eligibility and account', 'You must be legally able to enter into this agreement. Keep your account credentials secure and provide a valid email address. You are responsible for activity under your account, subject to applicable law. Do not share access or attempt to access another user’s records.'],
['Permitted use', 'Use the service for personal expense tracking. Do not abuse, disrupt, reverse engineer in violation of applicable law, upload malicious content, probe other accounts, or use the service unlawfully. You are responsible for the accuracy and appropriateness of information you enter.'],
['No financial advice', 'The service records and summarizes information you provide. It does not provide financial, tax, accounting, investment, or legal advice. Charts and totals may be affected by incorrect entries or technical issues. Verify important figures independently.'],
['Data, export, and deletion', 'You retain rights you have in the information you submit. You authorize the operator to process it only as needed to provide, secure, and maintain the service, subject to the Privacy Policy. You may export your records and delete your account. Deletion may be irreversible.'],
['Availability and disclaimers', 'The service is provided on an “as available” basis to the extent permitted by law. We do not guarantee uninterrupted availability, error-free operation, or that stored data will never be lost. Keep your own exports of records that matter to you. Nothing here excludes rights or liabilities that cannot be excluded under applicable law.'],
['Liability and indemnity', 'To the extent permitted by applicable law, the operator is not liable for indirect or consequential losses arising from use of the service. Nothing in these terms limits liability where such limitation is unlawful. Any indemnity must be reviewed and tailored by qualified counsel for the relevant jurisdiction.'],
['Suspension and changes', 'We may suspend access to address abuse, security threats, legal obligations, or service changes. We will provide notice where required. We may revise these terms and publish the updated date.'],
['Governing law and contact', 'These terms are governed by [GOVERNING LAW: India], subject to mandatory legal protections. Contact [CONTACT EMAIL].']
]},
cookies: {
title: 'Cookie Policy', updated: '[DATE]',
sections: [
['What this app stores', 'This codebase uses one server cookie and two browser local-storage entries. There are no analytics, advertising, social-media, or third-party tracking scripts included. Confirm this inventory against the final deployed app and dependencies before publication.'],
['Essential authentication cookie', 'Name: expense_auth. Purpose: carries a signed JWT so the server can authenticate your session. Type: HttpOnly cookie, not readable by client-side JavaScript. Duration: up to 7 days, or until cleared/logged out. Essential: yes. Secure and SameSite attributes are configured through environment variables; production must use HTTPS.'],
['Theme preference', 'Name: expense-theme (localStorage, not a cookie). Purpose: remembers light/dark theme. Duration: until cleared by the user. Essential: preference / non-tracking. It is not sent to the server.'],
['Consent choice', 'Name: expense-cookie-consent (localStorage, not a cookie). Purpose: stores the selected consent choice, timestamp, and policy version. Duration: until cleared by the user or replaced by a new choice. Essential: yes, to remember the privacy choice.'],
['Non-essential cookies', 'No non-essential cookies or third-party scripts are included by default. Accepting all does not activate any tracking because this codebase contains no optional trackers. If analytics, embedded media, or other optional technologies are added later, update this policy and ensure they do not load before valid consent where required.'],
['Changing choices', 'Use “Cookie settings” in the footer to change your choice. You can also clear local storage and cookies in your browser settings, though this may sign you out or reset preferences.'],
['Contact and template note', 'Contact [CONTACT EMAIL]. Last updated: [DATE]. This policy is a template and must be reviewed against the technologies and laws that apply to the deployed service.']
]}
};
export default function Legal({ page }) {
  const data = legal[page] || legal.privacy;
  return <article className="legal-page"><span className="eyebrow">POCKETLEDGER · INFORMATION</span><h1>{data.title}</h1><p className="muted">Last updated: {data.updated}</p><div className="legal-notice"><strong>Template notice:</strong> This content is a starting template, not legal advice. Replace placeholders and have qualified counsel review it before launch.</div>
    {data.sections.map(([heading, content]) => <section key={heading}><h2>{heading}</h2><p>{content}</p></section>)}
    <p className="legal-links"><Link to="/privacy">Privacy Policy</Link> · <Link to="/terms">Terms and Conditions</Link> · <Link to="/cookies">Cookie Policy</Link></p>
  </article>;
}
