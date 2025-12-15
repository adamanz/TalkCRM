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
                throw new AuraHandledException(errorMsg);
            }

            return result;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled
    public static Map<String, Object> verifyCode(String phone, String code) {
        try {
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
                throw new AuraHandledException(errorMsg);
            }

            return result;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }
}
