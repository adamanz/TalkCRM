@isTest
private class TalkCrmControllerTest {

    // Mock HTTP callout for successful responses
    private class MockHttpSuccess implements HttpCalloutMock {
        public HTTPResponse respond(HTTPRequest req) {
            HttpResponse res = new HttpResponse();
            res.setHeader('Content-Type', 'application/json');
            res.setStatusCode(200);

            if (req.getEndpoint().contains('/api/auth/add-phone')) {
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

    @isTest
    static void testVerifyCodeSuccess() {
        Test.setMock(HttpCalloutMock.class, new MockHttpSuccess());

        Test.startTest();
        Map<String, Object> result = TalkCrmController.verifyCode('+14155551234', '123456');
        Test.stopTest();

        System.assertEquals(true, result.get('success'), 'Expected success to be true');
        System.assertEquals(true, result.get('verified'), 'Expected verified to be true');
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
}
