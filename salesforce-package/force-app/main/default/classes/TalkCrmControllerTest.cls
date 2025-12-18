@isTest
private class TalkCrmControllerTest {

    // Mock HTTP callout for successful responses
    private class MockHttpSuccess implements HttpCalloutMock {
        public HTTPResponse respond(HTTPRequest req) {
            HttpResponse res = new HttpResponse();
            res.setHeader('Content-Type', 'application/json');
            res.setStatusCode(200);

            if (req.getEndpoint().contains('/api/org/register')) {
                res.setBody('{"success": true, "instanceUrl": "https://test.my.salesforce.com", "message": "Credentials saved successfully"}');
            } else if (req.getEndpoint().contains('/api/auth/add-phone')) {
                res.setBody('{"success": true, "phone": "+14155551234", "expiresAt": 1702500000000}');
            } else if (req.getEndpoint().contains('/api/auth/verify')) {
                res.setBody('{"success": true, "userId": "test123", "verified": true}');
            }

            return res;
        }
    }

    // Mock HTTP callout for error responses
    private class MockHttpError implements HttpCalloutMock {
        public HTTPResponse respond(HTTPRequest req) {
            HttpResponse res = new HttpResponse();
            res.setHeader('Content-Type', 'application/json');
            res.setStatusCode(400);
            res.setBody('{"error": "Invalid request"}');
            return res;
        }
    }

    // Mock HTTP callout for error without 'error' field
    private class MockHttpErrorNoMessage implements HttpCalloutMock {
        public HTTPResponse respond(HTTPRequest req) {
            HttpResponse res = new HttpResponse();
            res.setHeader('Content-Type', 'application/json');
            res.setStatusCode(500);
            res.setBody('{"status": "failed"}');
            return res;
        }
    }

    // ============================================================================
    // Tests for getSetupState()
    // ============================================================================

    @isTest
    static void testGetSetupStateInitial() {
        Test.startTest();
        Map<String, Object> state = TalkCrmController.getSetupState();
        Test.stopTest();

        // Initially, org should not be configured and user should not be verified
        System.assertEquals(false, state.get('orgConfigured'), 'Org should not be configured initially');
        System.assertEquals(false, state.get('userVerified'), 'User should not be verified initially');
        System.assertEquals(null, state.get('verifiedPhone'), 'Verified phone should be null initially');
        System.assertEquals(null, state.get('talkCrmUserId'), 'TalkCRM user ID should be null initially');
        System.assertNotEquals(null, state.get('userEmail'), 'User email should be present');
        System.assertNotEquals(null, state.get('salesforceUserId'), 'Salesforce user ID should be present');
    }

    @isTest
    static void testGetSetupStateAfterOrgConfig() {
        // Set up org-level custom setting
        TalkCRM_Settings__c settings = new TalkCRM_Settings__c();
        settings.App_Configured__c = true;
        insert settings;

        Test.startTest();
        Map<String, Object> state = TalkCrmController.getSetupState();
        Test.stopTest();

        System.assertEquals(true, state.get('orgConfigured'), 'Org should be configured');
        System.assertEquals(false, state.get('userVerified'), 'User should not be verified yet');
    }

    @isTest
    static void testGetSetupStateFullyConfigured() {
        // Set up org-level custom setting
        TalkCRM_Settings__c settings = new TalkCRM_Settings__c();
        settings.App_Configured__c = true;
        insert settings;

        // Set up user fields
        User currentUser = [SELECT Id FROM User WHERE Id = :UserInfo.getUserId() LIMIT 1];
        currentUser.TalkCRM_Phone_Verified__c = true;
        currentUser.TalkCRM_Verified_Phone__c = '+14155551234';
        currentUser.TalkCRM_User_Id__c = 'talkcrm_user_123';
        update currentUser;

        Test.startTest();
        Map<String, Object> state = TalkCrmController.getSetupState();
        Test.stopTest();

        System.assertEquals(true, state.get('orgConfigured'), 'Org should be configured');
        System.assertEquals(true, state.get('userVerified'), 'User should be verified');
        System.assertEquals('+14155551234', state.get('verifiedPhone'), 'Verified phone should match');
        System.assertEquals('talkcrm_user_123', state.get('talkCrmUserId'), 'TalkCRM user ID should match');
    }

    // ============================================================================
    // Tests for saveUserConnection()
    // ============================================================================

    @isTest
    static void testSaveUserConnectionSuccess() {
        Test.startTest();
        TalkCrmController.saveUserConnection('talkcrm_test_user');
        Test.stopTest();

        User currentUser = [SELECT TalkCRM_User_Id__c FROM User WHERE Id = :UserInfo.getUserId() LIMIT 1];
        System.assertEquals('talkcrm_test_user', currentUser.TalkCRM_User_Id__c, 'TalkCRM user ID should be saved');
    }

    // ============================================================================
    // Tests for clearUserVerification()
    // ============================================================================

    @isTest
    static void testClearUserVerification() {
        // First, set verification on the user
        User currentUser = [SELECT Id FROM User WHERE Id = :UserInfo.getUserId() LIMIT 1];
        currentUser.TalkCRM_Phone_Verified__c = true;
        currentUser.TalkCRM_Verified_Phone__c = '+14155551234';
        update currentUser;

        Test.startTest();
        TalkCrmController.clearUserVerification();
        Test.stopTest();

        currentUser = [SELECT TalkCRM_Phone_Verified__c, TalkCRM_Verified_Phone__c FROM User WHERE Id = :UserInfo.getUserId() LIMIT 1];
        System.assertEquals(false, currentUser.TalkCRM_Phone_Verified__c, 'Phone verified should be false');
        System.assertEquals(null, currentUser.TalkCRM_Verified_Phone__c, 'Verified phone should be null');
    }

    // ============================================================================
    // Tests for clearUserConnection()
    // ============================================================================

    @isTest
    static void testClearUserConnection() {
        // First, set connection on the user
        User currentUser = [SELECT Id FROM User WHERE Id = :UserInfo.getUserId() LIMIT 1];
        currentUser.TalkCRM_User_Id__c = 'talkcrm_test_user';
        update currentUser;

        Test.startTest();
        TalkCrmController.clearUserConnection();
        Test.stopTest();

        currentUser = [SELECT TalkCRM_User_Id__c FROM User WHERE Id = :UserInfo.getUserId() LIMIT 1];
        System.assertEquals(null, currentUser.TalkCRM_User_Id__c, 'TalkCRM user ID should be null');
    }

    // ============================================================================
    // Tests for saveCredentials()
    // ============================================================================

    @isTest
    static void testSaveCredentialsSuccess() {
        Test.setMock(HttpCalloutMock.class, new MockHttpSuccess());

        Test.startTest();
        Map<String, Object> result = TalkCrmController.saveCredentials('consumerKey123', 'consumerSecret456');
        Test.stopTest();

        System.assertEquals(true, result.get('success'), 'Expected success to be true');

        // Verify custom setting was created
        TalkCRM_Settings__c settings = TalkCRM_Settings__c.getOrgDefaults();
        System.assertNotEquals(null, settings, 'Custom setting should exist');
        System.assertEquals(true, settings.App_Configured__c, 'App should be marked as configured');
    }

    @isTest
    static void testSaveCredentialsError() {
        Test.setMock(HttpCalloutMock.class, new MockHttpError());

        Test.startTest();
        Boolean exceptionThrown = false;
        try {
            TalkCrmController.saveCredentials('consumerKey123', 'consumerSecret456');
        } catch (AuraHandledException e) {
            exceptionThrown = true;
        }
        Test.stopTest();

        System.assert(exceptionThrown, 'Expected AuraHandledException to be thrown');
    }

    // ============================================================================
    // Tests for sendVerificationCode()
    // ============================================================================

    @isTest
    static void testSendVerificationCodeSuccess() {
        Test.setMock(HttpCalloutMock.class, new MockHttpSuccess());

        Test.startTest();
        Map<String, Object> result = TalkCrmController.sendVerificationCode('user123', '+14155551234');
        Test.stopTest();

        System.assertEquals(true, result.get('success'), 'Expected success to be true');
        System.assertEquals('+14155551234', result.get('phone'), 'Expected phone to match');
    }

    @isTest
    static void testSendVerificationCodeError() {
        Test.setMock(HttpCalloutMock.class, new MockHttpError());

        Test.startTest();
        Boolean exceptionThrown = false;
        try {
            TalkCrmController.sendVerificationCode('user123', '+14155551234');
        } catch (AuraHandledException e) {
            exceptionThrown = true;
        }
        Test.stopTest();

        System.assert(exceptionThrown, 'Expected AuraHandledException to be thrown');
    }

    // ============================================================================
    // Tests for verifyCode()
    // ============================================================================

    @isTest
    static void testVerifyCodeSuccess() {
        Test.setMock(HttpCalloutMock.class, new MockHttpSuccess());

        Test.startTest();
        Map<String, Object> result = TalkCrmController.verifyCode('+14155551234', '123456');
        Test.stopTest();

        System.assertEquals(true, result.get('success'), 'Expected success to be true');
        System.assertEquals(true, result.get('verified'), 'Expected verified to be true');

        // Verify user fields were updated
        User currentUser = [SELECT TalkCRM_Phone_Verified__c, TalkCRM_Verified_Phone__c FROM User WHERE Id = :UserInfo.getUserId() LIMIT 1];
        System.assertEquals(true, currentUser.TalkCRM_Phone_Verified__c, 'Phone verified should be true');
        System.assertEquals('+14155551234', currentUser.TalkCRM_Verified_Phone__c, 'Verified phone should match');
    }

    @isTest
    static void testVerifyCodeError() {
        Test.setMock(HttpCalloutMock.class, new MockHttpError());

        Test.startTest();
        Boolean exceptionThrown = false;
        try {
            TalkCrmController.verifyCode('+14155551234', '123456');
        } catch (AuraHandledException e) {
            exceptionThrown = true;
        }
        Test.stopTest();

        System.assert(exceptionThrown, 'Expected AuraHandledException to be thrown');
    }

    // ============================================================================
    // Error handling edge cases
    // ============================================================================

    @isTest
    static void testSendVerificationCodeErrorNoMessage() {
        Test.setMock(HttpCalloutMock.class, new MockHttpErrorNoMessage());

        Test.startTest();
        Boolean exceptionThrown = false;
        try {
            TalkCrmController.sendVerificationCode('user123', '+14155551234');
        } catch (AuraHandledException e) {
            exceptionThrown = true;
        }
        Test.stopTest();

        System.assert(exceptionThrown, 'Expected AuraHandledException to be thrown');
    }

    @isTest
    static void testVerifyCodeErrorNoMessage() {
        Test.setMock(HttpCalloutMock.class, new MockHttpErrorNoMessage());

        Test.startTest();
        Boolean exceptionThrown = false;
        try {
            TalkCrmController.verifyCode('+14155551234', '123456');
        } catch (AuraHandledException e) {
            exceptionThrown = true;
        }
        Test.stopTest();

        System.assert(exceptionThrown, 'Expected AuraHandledException to be thrown');
    }

    @isTest
    static void testSaveCredentialsErrorNoMessage() {
        Test.setMock(HttpCalloutMock.class, new MockHttpErrorNoMessage());

        Test.startTest();
        Boolean exceptionThrown = false;
        try {
            TalkCrmController.saveCredentials('consumerKey123', 'consumerSecret456');
        } catch (AuraHandledException e) {
            exceptionThrown = true;
            // Verify it uses the default error message
            System.assert(e.getMessage().contains('Failed to save credentials') || e.getMessage().contains('failed'),
                'Expected default error message');
        }
        Test.stopTest();

        System.assert(exceptionThrown, 'Expected AuraHandledException to be thrown');
    }

    // Mock that returns invalid JSON to trigger parsing exception
    private class MockHttpInvalidResponse implements HttpCalloutMock {
        public HTTPResponse respond(HTTPRequest req) {
            HttpResponse res = new HttpResponse();
            res.setHeader('Content-Type', 'application/json');
            res.setStatusCode(200);
            res.setBody('not valid json {{{');
            return res;
        }
    }

    @isTest
    static void testSaveCredentialsParsingException() {
        Test.setMock(HttpCalloutMock.class, new MockHttpInvalidResponse());

        Test.startTest();
        Boolean exceptionThrown = false;
        String errorMessage = '';
        try {
            TalkCrmController.saveCredentials('consumerKey123', 'consumerSecret456');
        } catch (AuraHandledException e) {
            exceptionThrown = true;
            errorMessage = e.getMessage();
        }
        Test.stopTest();

        System.assert(exceptionThrown, 'Expected AuraHandledException to be thrown');
        System.assertNotEquals('', errorMessage, 'Expected error message');
    }

    @isTest
    static void testSendVerificationCodeParsingException() {
        Test.setMock(HttpCalloutMock.class, new MockHttpInvalidResponse());

        Test.startTest();
        Boolean exceptionThrown = false;
        String errorMessage = '';
        try {
            TalkCrmController.sendVerificationCode('user123', '+14155551234');
        } catch (AuraHandledException e) {
            exceptionThrown = true;
            errorMessage = e.getMessage();
        }
        Test.stopTest();

        System.assert(exceptionThrown, 'Expected AuraHandledException to be thrown');
        System.assertNotEquals('', errorMessage, 'Expected error message');
    }
}
