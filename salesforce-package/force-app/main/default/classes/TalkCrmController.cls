public with sharing class TalkCrmController {
    private static final String TALKCRM_API_URL = 'https://tough-raccoon-796.convex.site';

    /**
     * Get the current setup state for the org and user
     * Returns: orgConfigured (boolean), userVerified (boolean), verifiedPhone (string), talkCrmUserId (string)
     */
    @AuraEnabled(cacheable=false)
    public static Map<String, Object> getSetupState() {
        Map<String, Object> state = new Map<String, Object>();

        // Check org-level configuration (Custom Setting)
        TalkCRM_Settings__c orgSettings = TalkCRM_Settings__c.getOrgDefaults();
        state.put('orgConfigured', orgSettings != null && orgSettings.App_Configured__c == true);

        // Check current user's verification status
        User currentUser = [
            SELECT Id, TalkCRM_Phone_Verified__c, TalkCRM_Verified_Phone__c, TalkCRM_User_Id__c, Email
            FROM User
            WHERE Id = :UserInfo.getUserId()
            LIMIT 1
        ];

        state.put('userVerified', currentUser.TalkCRM_Phone_Verified__c == true);
        state.put('verifiedPhone', currentUser.TalkCRM_Verified_Phone__c);
        state.put('talkCrmUserId', currentUser.TalkCRM_User_Id__c);
        state.put('userEmail', currentUser.Email);
        state.put('salesforceUserId', currentUser.Id);

        return state;
    }

    /**
     * Save Connected App credentials and mark org as configured
     */
    @AuraEnabled
    public static Map<String, Object> saveCredentials(String consumerKey, String consumerSecret) {
        try {
            // Get the instance URL from the current org
            String instanceUrl = URL.getOrgDomainUrl().toExternalForm();

            HttpRequest req = new HttpRequest();
            req.setEndpoint(TALKCRM_API_URL + '/api/org/register');
            req.setMethod('POST');
            req.setHeader('Content-Type', 'application/json');
            req.setBody(JSON.serialize(new Map<String, String>{
                'instanceUrl' => instanceUrl,
                'consumerKey' => consumerKey,
                'consumerSecret' => consumerSecret
            }));
            req.setTimeout(30000);

            Http http = new Http();
            HttpResponse res = http.send(req);

            Map<String, Object> result = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());

            if (res.getStatusCode() >= 400) {
                String errorMsg = result.containsKey('error') ? (String) result.get('error') : 'Failed to save credentials';
                AuraHandledException ex = new AuraHandledException(errorMsg);
                ex.setMessage(errorMsg);
                throw ex;
            }

            // Mark org as configured in Custom Setting
            TalkCRM_Settings__c orgSettings = TalkCRM_Settings__c.getOrgDefaults();
            if (orgSettings == null) {
                orgSettings = new TalkCRM_Settings__c();
            }
            orgSettings.App_Configured__c = true;
            upsert orgSettings;

            return result;
        } catch (AuraHandledException e) {
            throw e;
        } catch (Exception e) {
            String msg = e.getMessage();
            if (e.getTypeName().contains('CalloutException')) {
                msg = 'Unable to connect to TalkCRM. Please check Remote Site Settings.';
            }
            AuraHandledException ex = new AuraHandledException(msg);
            ex.setMessage(msg);
            throw ex;
        }
    }

    /**
     * Save the TalkCRM user ID after OAuth completion
     */
    @AuraEnabled
    public static void saveUserConnection(String talkCrmUserId) {
        try {
            User currentUser = [SELECT Id FROM User WHERE Id = :UserInfo.getUserId() LIMIT 1];
            currentUser.TalkCRM_User_Id__c = talkCrmUserId;
            update currentUser;
        } catch (Exception e) {
            AuraHandledException ex = new AuraHandledException(e.getMessage());
            ex.setMessage(e.getMessage());
            throw ex;
        }
    }

    @AuraEnabled
    public static Map<String, Object> sendVerificationCode(String userId, String phone) {
        try {
            HttpRequest req = new HttpRequest();
            req.setEndpoint(TALKCRM_API_URL + '/api/auth/add-phone');
            req.setMethod('POST');
            req.setHeader('Content-Type', 'application/json');
            req.setBody(JSON.serialize(new Map<String, String>{
                'userId' => userId,
                'phone' => phone
            }));
            req.setTimeout(30000);

            Http http = new Http();
            HttpResponse res = http.send(req);

            Map<String, Object> result = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());

            if (res.getStatusCode() >= 400) {
                String errorMsg = result.containsKey('error') ? (String) result.get('error') : 'Request failed';
                AuraHandledException ex = new AuraHandledException(errorMsg);
                ex.setMessage(errorMsg);
                throw ex;
            }

            return result;
        } catch (AuraHandledException e) {
            throw e;
        } catch (Exception e) {
            String msg = e.getMessage();
            if (e.getTypeName().contains('CalloutException')) {
                msg = 'Unable to connect to TalkCRM. Please check Remote Site Settings.';
            }
            AuraHandledException ex = new AuraHandledException(msg);
            ex.setMessage(msg);
            throw ex;
        }
    }

    @AuraEnabled
    public static Map<String, Object> verifyCode(String phone, String code) {
        HttpRequest req = new HttpRequest();
        req.setEndpoint(TALKCRM_API_URL + '/api/auth/verify');
        req.setMethod('POST');
        req.setHeader('Content-Type', 'application/json');
        req.setBody(JSON.serialize(new Map<String, String>{
            'phone' => phone,
            'code' => code
        }));
        req.setTimeout(30000);

        Http http = new Http();
        HttpResponse res = http.send(req);

        Map<String, Object> result = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());

        if (res.getStatusCode() >= 400) {
            String errorMsg = result.containsKey('error') ? (String) result.get('error') : 'Verification failed';
            AuraHandledException ex = new AuraHandledException(errorMsg);
            ex.setMessage(errorMsg);
            throw ex;
        }

        // Save verification status on current user
        try {
            User currentUser = [SELECT Id FROM User WHERE Id = :UserInfo.getUserId() LIMIT 1];
            currentUser.TalkCRM_Phone_Verified__c = true;
            currentUser.TalkCRM_Verified_Phone__c = phone;
            update currentUser;
        } catch (Exception e) {
            // Log but don't fail - the verification itself succeeded
            System.debug('Failed to update user verification status: ' + e.getMessage());
        }

        return result;
    }

    /**
     * Clear the current user's verification (for changing phone number)
     */
    @AuraEnabled
    public static void clearUserVerification() {
        try {
            User currentUser = [SELECT Id FROM User WHERE Id = :UserInfo.getUserId() LIMIT 1];
            currentUser.TalkCRM_Phone_Verified__c = false;
            currentUser.TalkCRM_Verified_Phone__c = null;
            update currentUser;
        } catch (Exception e) {
            AuraHandledException ex = new AuraHandledException(e.getMessage());
            ex.setMessage(e.getMessage());
            throw ex;
        }
    }

    /**
     * Clear the current user's TalkCRM connection (for re-auth)
     */
    @AuraEnabled
    public static void clearUserConnection() {
        try {
            User currentUser = [SELECT Id FROM User WHERE Id = :UserInfo.getUserId() LIMIT 1];
            currentUser.TalkCRM_User_Id__c = null;
            update currentUser;
        } catch (Exception e) {
            AuraHandledException ex = new AuraHandledException(e.getMessage());
            ex.setMessage(e.getMessage());
            throw ex;
        }
    }
}
