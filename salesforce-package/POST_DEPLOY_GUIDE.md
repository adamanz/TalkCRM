# TalkCRM Post-Deployment Setup Guide

This guide walks you through setting up TalkCRM after deploying the Salesforce package.

**Time Required:** 5 minutes

---

## Step 1: Deploy the Package

```bash
# Navigate to package directory
cd salesforce-package

# Authenticate to your org
sf org login web -a MyOrg

# Deploy the package
sf project deploy start --target-org MyOrg
```

---

## Step 2: Assign Permission Set

Users need the TalkCRM permission set to access the app.

1. Go to **Setup** → Quick Find → **"Permission Sets"**
2. Click **TalkCRM User**
3. Click **Manage Assignments** → **Add Assignment**
4. Select the users who should have access
5. Click **Assign** → **Done**

---

## Step 3: Launch TalkCRM

1. Click the **App Launcher** (9-dot grid icon, top left)
2. Search for **"TalkCRM"**
3. Click **TalkCRM** to open

---

## Step 4: Complete Setup Wizard

The TalkCRM Setup tab will guide you through:

1. **Connect Salesforce**
   - Click the button to authorize TalkCRM
   - Log in to Salesforce when prompted
   - Grant access to TalkCRM

2. **Verify Phone**
   - Enter your phone number
   - Enter the verification code sent via SMS

3. **Ready!**
   - You'll see the TalkCRM phone number to call

---

## Step 5: Make Your First Call

1. Save the TalkCRM number: **+1 (646) 600-5041**
2. Call from your registered phone number
3. Try saying:
   - "What's in my pipeline?"
   - "Find the Acme account"
   - "Create a task to follow up tomorrow"

---

## Verification Checklist

Before going live, verify:

- [ ] Package deployed successfully
- [ ] Permission Set assigned to users
- [ ] At least one user completed the setup wizard
- [ ] Test call successful

---

## Troubleshooting

### OAuth fails or "Access Denied"
- Make sure you're logging into the correct Salesforce org
- Try clearing browser cache and cookies
- Contact support if the issue persists

### Phone verification code not received
- Check that you entered the correct phone number
- Wait 1-2 minutes for the SMS to arrive
- In dev mode, the code appears in a yellow box on screen

### "TalkCRM" not appearing in App Launcher
- Verify the Permission Set is assigned to your user
- Try refreshing the page or logging out/in

### Call not recognized / "Unknown caller"
- Make sure to call from your verified phone number
- Complete phone verification in the TalkCRM Setup wizard

---

## FAQ

### Do I need to create a Connected App?
**No.** TalkCRM uses a centralized Connected App. Just click "Connect Salesforce" in the setup wizard and authorize.

### Can multiple users in my org use TalkCRM?
**Yes.** Each user should:
1. Be assigned the TalkCRM User permission set
2. Complete the setup wizard with their own phone number

### What data does TalkCRM access?
TalkCRM accesses your Salesforce data (Accounts, Contacts, Opportunities, Tasks, etc.) to respond to your voice commands. It only accesses data you have permission to see.

### Is my data secure?
Yes. TalkCRM uses Salesforce OAuth 2.0 for secure authentication. Your credentials are never stored - only secure access tokens.

---

## Support

- **Email:** support@talkcrm.com
- **Documentation:** https://talkcrm.com/docs
