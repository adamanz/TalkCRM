import { LightningElement, track } from 'lwc';
import sendVerificationCode from '@salesforce/apex/TalkCrmController.sendVerificationCode';
import verifyCode from '@salesforce/apex/TalkCrmController.verifyCode';

export default class TalkCrmSetup extends LightningElement {
    @track currentStep = '1';
    @track isLoading = false;
    @track errorMessage = '';

    // Step 1: OAuth
    @track isConnected = false;
    @track userEmail = '';
    @track userId = '';

    // Step 2: Phone
    @track phoneNumber = '';
    @track codeSent = false;
    @track verificationCode = '';

    // Getters for step visibility
    get isStep1() { return this.currentStep === '1'; }
    get isStep2() { return this.currentStep === '2'; }
    get isStep3() { return this.currentStep === '3'; }

    // Getters for phone verification UI
    get showPhoneInput() { return !this.codeSent; }
    get showCodeInput() { return this.codeSent; }

    connectedCallback() {
        // Check URL params for OAuth callback
        this.checkOAuthCallback();
        // Check if already set up
        this.checkExistingSetup();
    }

    checkOAuthCallback() {
        // Check URL query params
        const urlParams = new URLSearchParams(window.location.search);
        let userId = urlParams.get('talkcrm_user_id');
        let email = urlParams.get('talkcrm_email');

        // Also check URL hash (for cross-domain redirect)
        if (!userId && window.location.hash) {
            const hashParams = new URLSearchParams(window.location.hash.substring(1));
            userId = hashParams.get('talkcrm_user_id');
            email = hashParams.get('talkcrm_email');
        }

        if (userId) {
            this.isConnected = true;
            this.userId = userId;
            this.userEmail = email || 'Connected';
            // Store in localStorage for persistence
            localStorage.setItem('talkcrm_user_id', userId);
            localStorage.setItem('talkcrm_email', email || '');
            // Clean URL
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }

    checkExistingSetup() {
        const storedUserId = localStorage.getItem('talkcrm_user_id');
        const storedEmail = localStorage.getItem('talkcrm_email');
        const storedPhone = localStorage.getItem('talkcrm_phone');
        const setupComplete = localStorage.getItem('talkcrm_setup_complete');

        if (storedUserId) {
            this.isConnected = true;
            this.userId = storedUserId;
            this.userEmail = storedEmail || 'Connected';
        }

        if (setupComplete === 'true' && storedPhone) {
            this.phoneNumber = storedPhone;
            this.currentStep = '3';
        } else if (storedUserId) {
            this.currentStep = '2';
        }
    }

    // Step 1: Start OAuth flow
    startOAuth() {
        this.isLoading = true;
        this.errorMessage = '';

        // Get current Salesforce session info
        const instanceUrl = window.location.origin;

        // Redirect to TalkCRM OAuth initiation endpoint
        const TALKCRM_API_URL = 'https://gregarious-crocodile-506.convex.site';
        const callbackUrl = encodeURIComponent(window.location.href.split('?')[0]);
        const oauthUrl = `${TALKCRM_API_URL}/auth/salesforce/initiate?callback_url=${callbackUrl}&instance_url=${encodeURIComponent(instanceUrl)}`;

        window.location.href = oauthUrl;
    }

    goToStep2() {
        this.currentStep = '2';
    }

    // Step 2: Phone verification
    handlePhoneChange(event) {
        this.phoneNumber = event.target.value;
    }

    handleCodeChange(event) {
        this.verificationCode = event.target.value;
    }

    async handleSendVerificationCode() {
        if (!this.phoneNumber) {
            this.errorMessage = 'Please enter a phone number';
            return;
        }

        this.isLoading = true;
        this.errorMessage = '';

        try {
            const result = await sendVerificationCode({
                userId: this.userId,
                phone: this.phoneNumber
            });

            this.codeSent = true;
            this.phoneNumber = result.phone || this.phoneNumber;

            // In dev mode, show the code (for testing)
            if (result.code) {
                console.log('DEV MODE - Verification code:', result.code);
                this.errorMessage = `DEV MODE: Code is ${result.code}`;
            }
        } catch (error) {
            this.errorMessage = error.body ? error.body.message : error.message;
        } finally {
            this.isLoading = false;
        }
    }

    async handleVerifyCode() {
        if (!this.verificationCode) {
            this.errorMessage = 'Please enter the verification code';
            return;
        }

        this.isLoading = true;
        this.errorMessage = '';

        try {
            await verifyCode({
                phone: this.phoneNumber,
                code: this.verificationCode
            });

            // Success! Save and move to step 3
            localStorage.setItem('talkcrm_phone', this.phoneNumber);
            localStorage.setItem('talkcrm_setup_complete', 'true');
            this.currentStep = '3';
        } catch (error) {
            this.errorMessage = error.body ? error.body.message : error.message;
        } finally {
            this.isLoading = false;
        }
    }

    // Settings Management
    handleChangePhone() {
        // Go back to step 2 to change phone number
        this.codeSent = false;
        this.verificationCode = '';
        this.phoneNumber = '';
        this.errorMessage = '';
        this.currentStep = '2';
    }

    handleReconnectSalesforce() {
        // Clear Salesforce auth and restart OAuth flow
        localStorage.removeItem('talkcrm_user_id');
        localStorage.removeItem('talkcrm_email');
        this.isConnected = false;
        this.userId = '';
        this.userEmail = '';
        this.errorMessage = '';
        // Start OAuth flow immediately
        this.startOAuth();
    }

    handleResetAll() {
        // Confirm before resetting
        if (confirm('Are you sure you want to reset all TalkCRM settings? You will need to reconnect Salesforce and verify your phone number again.')) {
            // Clear all localStorage
            localStorage.removeItem('talkcrm_user_id');
            localStorage.removeItem('talkcrm_email');
            localStorage.removeItem('talkcrm_phone');
            localStorage.removeItem('talkcrm_setup_complete');

            // Reset component state
            this.isConnected = false;
            this.userId = '';
            this.userEmail = '';
            this.phoneNumber = '';
            this.codeSent = false;
            this.verificationCode = '';
            this.errorMessage = '';
            this.currentStep = '1';
        }
    }
}
