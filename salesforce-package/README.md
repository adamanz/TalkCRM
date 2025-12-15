# TalkCRM Salesforce Package

Voice-first CRM assistant that lets you manage Salesforce by phone.

## Features

- **Voice Commands**: Update Salesforce records, create tasks, and query data using natural language
- **Secure OAuth**: Uses Salesforce OAuth 2.0 for secure authentication
- **Phone Verification**: Two-factor authentication via SMS

## Installation

### Prerequisites

1. Salesforce org (Developer, Sandbox, or Production)
2. System Administrator access
3. Salesforce CLI (sf) installed

### Deploy to Salesforce

```bash
# Navigate to package directory
cd salesforce-package

# Authenticate to your org
sf org login web -a MyOrg

# Deploy the package
sf project deploy start --target-org MyOrg
```

### Post-Installation Setup

1. **Assign Permission Set**
   - Go to Setup > Permission Sets
   - Find "TalkCRM User"
   - Click "Manage Assignments" > "Add Assignment"
   - Select users who should access TalkCRM

2. **Configure the App**
   - Open the App Launcher
   - Search for "TalkCRM"
   - Follow the 3-step setup wizard

## Package Contents

| Component | Type | Description |
|-----------|------|-------------|
| talkCrmSetup | LWC | Setup wizard component |
| TalkCrmController | Apex | API communication controller |
| TalkCrmControllerTest | Apex Test | Test coverage for controller |
| TalkCRM_User | Permission Set | User access permissions |
| TalkCRM_Setup | Tab | Custom tab for setup wizard |
| TalkCRM | App | Lightning App |
| TalkCRM_Convex | Remote Site | API endpoint whitelist |
| TalkCRM_OAuth | Connected App | OAuth configuration |

## Support

- Documentation: https://talkcrm.com/docs
- Email: support@talkcrm.com

## Version History

- **1.0.0** - Initial release with OAuth flow and phone verification
