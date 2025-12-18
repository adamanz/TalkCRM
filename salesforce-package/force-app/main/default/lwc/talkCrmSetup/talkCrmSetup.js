import { LightningElement, track } from 'lwc';
import getSetupState from '@salesforce/apex/TalkCrmController.getSetupState';
import saveCredentials from '@salesforce/apex/TalkCrmController.saveCredentials';
import saveUserConnection from '@salesforce/apex/TalkCrmController.saveUserConnection';
import sendVerificationCode from '@salesforce/apex/TalkCrmController.sendVerificationCode';
import verifyCode from '@salesforce/apex/TalkCrmController.verifyCode';
import clearUserVerification from '@salesforce/apex/TalkCrmController.clearUserVerification';
import clearUserConnection from '@salesforce/apex/TalkCrmController.clearUserConnection';

export default class TalkCrmSetup extends LightningElement {
    @track currentStep = '1';
    @track isLoading = true; // Start with loading state
    @track errorMessage = '';
    @track successMessage = '';

    // Step 1: Connected App Credentials
    @track consumerKey = '';
    @track consumerSecret = '';
    @track credentialsConfigured = false;

    // Step 2: OAuth
    @track isConnected = false;
    @track userEmail = '';
    @track userId = '';

    // Step 3: Phone
    @track phoneNumber = '';
    @track codeSent = false;
    @track verificationCode = '';

    // Getters for step visibility
    get isStep1() { return this.currentStep === '1'; }
    get isStep2() { return this.currentStep === '2'; }
    get isStep3() { return this.currentStep === '3'; }
    get isStep4() { return this.currentStep === '4'; }

    // Getters for phone verification UI
    get showPhoneInput() { return !this.codeSent; }
    get showCodeInput() { return this.codeSent; }

    // Getter for instance URL display
    get instanceUrl() {
        return window.location.origin;
    }

    async connectedCallback() {
        // Check URL params for OAuth callback first
        await this.checkOAuthCallback();
        // Then load setup state from server
        await this.loadSetupState();
    }

    async loadSetupState() {
        this.isLoading = true;
        try {
            const state = await getSetupState();
            console.log('Setup state from server:', state);

            // Set state from server response
            this.credentialsConfigured = state.orgConfigured === true;

            if (state.talkCrmUserId) {
                this.isConnected = true;
                this.userId = state.talkCrmUserId;
                this.userEmail = state.userEmail || 'Connected';
            }

            if (state.userVerified && state.verifiedPhone) {
                this.phoneNumber = state.verifiedPhone;
            }

            // Determine current step based on server state
            if (state.userVerified && state.verifiedPhone) {
                // User has verified phone - show completion
                this.currentStep = '4';
            } else if (state.talkCrmUserId) {
                // User is OAuth connected but hasn't verified phone
                this.currentStep = '3';
            } else if (state.orgConfigured) {
                // Org is configured but user hasn't connected
                this.currentStep = '2';
            } else {
                // Nothing configured yet
                this.currentStep = '1';
            }

        } catch (error) {
            console.error('Error loading setup state:', error);
            this.errorMessage = 'Failed to load setup state. Please refresh the page.';
            // Default to step 1 on error
            this.currentStep = '1';
        } finally {
            this.isLoading = false;
        }
    }

    async checkOAuthCallback() {
        // Check URL query params for OAuth callback
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
            console.log('OAuth callback detected, saving user connection:', userId);

            // Save the connection to the User record
            try {
                await saveUserConnection({ talkCrmUserId: userId });
                this.isConnected = true;
                this.userId = userId;
                this.userEmail = email || 'Connected';
                this.successMessage = 'Salesforce connected successfully!';
            } catch (error) {
                console.error('Error saving user connection:', error);
                this.errorMessage = 'Failed to save connection. Please try again.';
            }

            // Clean URL
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }

    // Step 1: Configure Connected App Credentials
    handleConsumerKeyChange(event) {
        this.consumerKey = event.target.value;
    }

    handleConsumerSecretChange(event) {
        this.consumerSecret = event.target.value;
    }

    async handleSaveCredentials() {
        if (!this.consumerKey || !this.consumerSecret) {
            this.errorMessage = 'Please enter both Consumer Key and Consumer Secret';
            return;
        }

        this.isLoading = true;
        this.errorMessage = '';

        try {
            // Register credentials with TalkCRM backend via Apex
            // This also marks the org as configured
            await saveCredentials({
                consumerKey: this.consumerKey,
                consumerSecret: this.consumerSecret
            });

            this.credentialsConfigured = true;
            this.successMessage = 'Credentials saved successfully!';

            // Move to next step after a brief delay
            setTimeout(() => {
                this.successMessage = '';
                this.currentStep = '2';
            }, 1500);

        } catch (error) {
            this.errorMessage = error.body?.message || error.message || 'Failed to save credentials';
        } finally {
            this.isLoading = false;
        }
    }

    // Step 2: Start OAuth flow
    startOAuth() {
        this.isLoading = true;
        this.errorMessage = '';

        // Get current Salesforce session info
        const instanceUrl = window.location.origin;

        // Redirect to TalkCRM OAuth initiation endpoint with instance URL
        // The backend will look up credentials for this org
        const TALKCRM_API_URL = 'https://tough-raccoon-796.convex.site';
        const callbackUrl = encodeURIComponent(window.location.href.split('?')[0]);
        const oauthUrl = `${TALKCRM_API_URL}/auth/salesforce/initiate?callback_url=${callbackUrl}&instance_url=${encodeURIComponent(instanceUrl)}`;

        window.location.href = oauthUrl;
    }

    goToStep3() {
        this.currentStep = '3';
    }

    // Step 3: Phone verification
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
            // This also saves verification status to User record
            await verifyCode({
                phone: this.phoneNumber,
                code: this.verificationCode
            });

            // Success! Move to step 4
            this.currentStep = '4';
        } catch (error) {
            this.errorMessage = error.body ? error.body.message : error.message;
        } finally {
            this.isLoading = false;
        }
    }

    // Settings Management
    async handleChangePhone() {
        this.isLoading = true;
        this.errorMessage = '';

        try {
            // Clear verification on server
            await clearUserVerification();

            // Reset UI state
            this.codeSent = false;
            this.verificationCode = '';
            this.phoneNumber = '';
            this.currentStep = '3';
        } catch (error) {
            this.errorMessage = error.body ? error.body.message : error.message;
        } finally {
            this.isLoading = false;
        }
    }

    async handleReconnectSalesforce() {
        this.isLoading = true;
        this.errorMessage = '';

        try {
            // Clear connection on server
            await clearUserConnection();

            // Reset UI state
            this.isConnected = false;
            this.userId = '';
            this.userEmail = '';
            this.currentStep = '2';
        } catch (error) {
            this.errorMessage = error.body ? error.body.message : error.message;
        } finally {
            this.isLoading = false;
        }
    }

    handleReconfigureCredentials() {
        // Go back to step 1 to reconfigure credentials
        // Note: Org-level config is preserved, this just lets admin update credentials
        this.errorMessage = '';
        this.currentStep = '1';
    }

    async handleResetAll() {
        // Confirm before resetting
        if (confirm('Are you sure you want to reset your TalkCRM settings? You will need to verify your phone again.')) {
            this.isLoading = true;
            this.errorMessage = '';

            try {
                // Clear user-level data on server
                await clearUserConnection();
                await clearUserVerification();

                // Reset component state
                this.isConnected = false;
                this.userId = '';
                this.userEmail = '';
                this.phoneNumber = '';
                this.codeSent = false;
                this.verificationCode = '';

                // Go to step 2 (org credentials are preserved)
                this.currentStep = '2';
            } catch (error) {
                this.errorMessage = error.body ? error.body.message : error.message;
            } finally {
                this.isLoading = false;
            }
        }
    }
}
