# TalkCRM Salesforce Package

Voice-first CRM assistant that lets you manage Salesforce by phone.

## Features

- **Voice Commands**: Update Salesforce records, create tasks, and query data using natural language
- **Secure OAuth**: One-click Salesforce authorization (no setup required)
- **Phone Verification**: Two-factor authentication via SMS

## Quick Install

### 1. Deploy the Package

```bash
cd salesforce-package
sf org login web -a MyOrg
sf project deploy start --target-org MyOrg
```

### 2. Assign Permission Set

1. **Setup** → **Permission Sets** → **TalkCRM User**
2. **Manage Assignments** → **Add Assignment** → Select users

### 3. Launch & Connect

1. **App Launcher** → Search **"TalkCRM"**
2. Click **Connect Salesforce** → Authorize
3. Verify your phone number
4. Done! Call **+1 (646) 600-5041**

## Package Contents

| Component | Type | Description |
|-----------|------|-------------|
| talkCrmSetup | LWC | Setup wizard component |
| TalkCrmController | Apex | API communication controller |
| TalkCrmControllerTest | Apex Test | Test coverage (100%) |
| TalkCRM_User | Permission Set | User access permissions |
| TalkCRM_Setup | Tab | Custom tab for setup |
| TalkCRM | App | Lightning App |
| TalkCRM_Convex | Remote Site | API endpoint whitelist |
| TalkCRM_Convex | CSP Trusted Site | Browser security policy |

## Example Voice Commands

- "What's in my pipeline?"
- "Find the Acme account"
- "Create a task to call John tomorrow"
- "Update the Acme deal to Closed Won"
- "Log a call on the Johnson contact"

## FAQ

**Do I need to create a Connected App?**
No. TalkCRM uses a centralized Connected App. Just click "Connect Salesforce" and authorize.

**Can multiple users use TalkCRM?**
Yes. Each user needs the permission set and completes their own setup.

## Support

- Email: support@talkcrm.com
- Docs: https://talkcrm.com/docs
