public with sharing class TalkCrmController {
    private static final String TALKCRM_API_URL = 'https://gregarious-crocodile-506.convex.site';

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

        return result;
    }
}
