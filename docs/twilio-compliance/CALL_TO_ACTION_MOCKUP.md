# TalkCRM Call to Action & Opt-In Mockup

## SMS Program Opt-In Documentation

**Program Name:** TalkCRM Phone Verification
**Opt-In Type:** Web Form (Single Opt-In with Explicit Consent)

---

## 1. Opt-In Flow Overview

Users opt-in to receive SMS verification messages through the TalkCRM signup/login flow:

```
User visits TalkCRM → Enters phone number → Sees consent disclosure →
Clicks "Send Verification Code" → Receives SMS → Enters code → Account verified
```

---

## 2. Call to Action Mockup

### Screen 1: Phone Number Entry with Consent Disclosure

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                         [TalkCRM Logo]                          │
│                                                                 │
│              Voice-Powered Salesforce for Sales Reps            │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                                                           │  │
│  │   Verify Your Phone Number                                │  │
│  │                                                           │  │
│  │   Enter the phone number you'll use to call TalkCRM.      │  │
│  │   We'll send you a verification code via SMS.             │  │
│  │                                                           │  │
│  │   Phone Number                                            │  │
│  │   ┌─────────────────────────────────────────────────────┐ │  │
│  │   │  +1  │  (555) 123-4567                              │ │  │
│  │   └─────────────────────────────────────────────────────┘ │  │
│  │                                                           │  │
│  │   ┌─────────────────────────────────────────────────────┐ │  │
│  │   │                                                     │ │  │
│  │   │           Send Verification Code                    │ │  │
│  │   │                                                     │ │  │
│  │   └─────────────────────────────────────────────────────┘ │  │
│  │                                                           │  │
│  │   ─────────────────────────────────────────────────────   │  │
│  │                                                           │  │
│  │   By clicking "Send Verification Code", you agree to      │  │
│  │   receive a one-time SMS verification code from TalkCRM.  │  │
│  │   Message and data rates may apply. Reply STOP to         │  │
│  │   opt-out. Reply HELP for help. View our SMS Terms of     │  │
│  │   Service and Privacy Policy.                             │  │
│  │                                     [Terms] [Privacy]     │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Screen 2: Verification Code Entry

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                         [TalkCRM Logo]                          │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                                                           │  │
│  │   Enter Verification Code                                 │  │
│  │                                                           │  │
│  │   We sent a 6-digit code to +1 (555) 123-4567            │  │
│  │                                                           │  │
│  │   ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐        │  │
│  │   │  1  │ │  2  │ │  3  │ │  4  │ │  5  │ │  6  │        │  │
│  │   └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘        │  │
│  │                                                           │  │
│  │   ┌─────────────────────────────────────────────────────┐ │  │
│  │   │                                                     │ │  │
│  │   │              Verify Phone Number                    │ │  │
│  │   │                                                     │ │  │
│  │   └─────────────────────────────────────────────────────┘ │  │
│  │                                                           │  │
│  │   Didn't receive the code?  [Resend Code]                │  │
│  │                                                           │  │
│  │   Code expires in 9:42                                    │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Required Consent Disclosures

The following disclosures are displayed to users BEFORE they opt-in:

### Primary Disclosure (Visible on Form)
> By clicking "Send Verification Code", you agree to receive a one-time SMS verification code from TalkCRM. Message and data rates may apply. Reply STOP to opt-out. Reply HELP for help. View our [SMS Terms of Service] and [Privacy Policy].

### Expanded Disclosures (Linked Pages)

**SMS Terms of Service** includes:
- Program description (phone verification only)
- Message frequency (1-2 messages per signup)
- Opt-out instructions (STOP)
- Help instructions (HELP)
- Carrier rate disclaimer
- Contact information

**SMS Privacy Policy** includes:
- What data we collect (phone number, verification status)
- How we use the data (verification only, no marketing)
- No sale of data to third parties
- Data retention periods
- User rights and choices

---

## 4. Consent Checklist (CTIA Compliance)

| Requirement | Implementation |
|-------------|----------------|
| **Program Name** | "TalkCRM Phone Verification" - displayed in Terms |
| **Message Content** | Verification codes only - clearly stated |
| **Message Frequency** | "One-time SMS verification code" - on form |
| **Opt-Out Instructions** | "Reply STOP to opt-out" - on form |
| **Help Instructions** | "Reply HELP for help" - on form |
| **Carrier Disclaimer** | "Message and data rates may apply" - on form |
| **Terms Link** | [SMS Terms of Service] - linked on form |
| **Privacy Link** | [Privacy Policy] - linked on form |
| **Explicit Action** | Button click required ("Send Verification Code") |
| **Clear Language** | Plain English, no hidden consent |

---

## 5. Sample SMS Message

When users click "Send Verification Code", they receive:

```
Your TalkCRM verification code is: 123456. This code expires in 10 minutes.
```

**Message characteristics:**
- No marketing content
- No links (security best practice for OTP)
- Clear sender identification ("TalkCRM")
- Actionable information (the code)
- Expiration notice

---

## 6. Opt-Out Handling

### STOP Response
When user texts "STOP":
```
TalkCRM: You have been unsubscribed and will not receive any more messages. Reply HELP for help or contact support@talkcrm.ai.
```

### HELP Response
When user texts "HELP":
```
TalkCRM Phone Verification: Msgs verify your phone for TalkCRM voice services. Msg freq: 1-2 per signup. Msg&Data rates may apply. Reply STOP to cancel. support@talkcrm.ai
```

---

## 7. User Journey Summary

1. **User Action:** Enters phone number in signup form
2. **Disclosure Shown:** Full consent text with Terms/Privacy links visible
3. **User Action:** Clicks "Send Verification Code" (explicit opt-in)
4. **System Action:** Sends single SMS with 6-digit code
5. **User Action:** Enters code in verification form
6. **System Action:** Verifies code, completes registration
7. **Ongoing:** No further SMS unless user initiates new verification

---

## 8. Screenshots / Visual Assets

*Note: For Twilio submission, export the actual UI screenshots from the live application or design files (Figma, Sketch, etc.) showing:*

1. Phone number entry screen with consent disclosure
2. Verification code entry screen
3. SMS Terms of Service page
4. SMS Privacy Policy page

**Recommended format:** PNG or PDF, minimum 1280x720 resolution

---

## 9. URL References

| Document | URL |
|----------|-----|
| SMS Terms of Service | https://talkcrm.ai/sms-terms |
| SMS Privacy Policy | https://talkcrm.ai/sms-privacy |
| General Privacy Policy | https://talkcrm.ai/privacy |
| General Terms of Service | https://talkcrm.ai/terms |
| Support | https://talkcrm.ai/support |

---

*This mockup document prepared for Twilio Short Code application submission.*
