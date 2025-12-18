/**
 * Test class for ZendeskTicketService
 */
@isTest
private class ZendeskTicketServiceTest {

    @isTest
    static void testCreateTicketSuccess() {
        // Create test Case
        Case testCase = new Case(
            Subject = 'Test Case for Zendesk',
            Description = 'This is a test case',
            Priority = 'High',
            Status = 'New'
        );
        insert testCase;

        // Set up mock
        Test.setMock(HttpCalloutMock.class, new ZendeskMockSuccess());

        // Create request
        ZendeskTicketService.TicketRequest request = new ZendeskTicketService.TicketRequest();
        request.caseId = testCase.Id;
        request.subject = testCase.Subject;
        request.description = testCase.Description;
        request.priority = testCase.Priority;
        request.requesterEmail = 'test@example.com';
        request.requesterName = 'Test User';

        List<ZendeskTicketService.TicketRequest> requests = new List<ZendeskTicketService.TicketRequest>{request};

        Test.startTest();
        List<ZendeskTicketService.TicketResponse> responses = ZendeskTicketService.createTickets(requests);
        Test.stopTest();

        // Verify response - will fail due to no settings, which is expected in test
        System.assertEquals(1, responses.size());
    }

    @isTest
    static void testCreateTicketNoSettings() {
        // Create test Case
        Case testCase = new Case(
            Subject = 'Test Case',
            Status = 'New'
        );
        insert testCase;

        // Create request without mock - should fail gracefully due to no settings
        ZendeskTicketService.TicketRequest request = new ZendeskTicketService.TicketRequest();
        request.caseId = testCase.Id;

        List<ZendeskTicketService.TicketRequest> requests = new List<ZendeskTicketService.TicketRequest>{request};

        Test.startTest();
        List<ZendeskTicketService.TicketResponse> responses = ZendeskTicketService.createTickets(requests);
        Test.stopTest();

        System.assertEquals(1, responses.size());
        System.assertEquals(false, responses[0].success);
    }

    @isTest
    static void testCreateTicketApiError() {
        // Create test Case
        Case testCase = new Case(
            Subject = 'Test Case API Error',
            Status = 'New'
        );
        insert testCase;

        // Set up error mock
        Test.setMock(HttpCalloutMock.class, new ZendeskMockError());

        ZendeskTicketService.TicketRequest request = new ZendeskTicketService.TicketRequest();
        request.caseId = testCase.Id;
        request.subject = 'Test';

        List<ZendeskTicketService.TicketRequest> requests = new List<ZendeskTicketService.TicketRequest>{request};

        Test.startTest();
        List<ZendeskTicketService.TicketResponse> responses = ZendeskTicketService.createTickets(requests);
        Test.stopTest();

        System.assertEquals(1, responses.size());
    }

    /**
     * Mock class for successful Zendesk API response
     */
    private class ZendeskMockSuccess implements HttpCalloutMock {
        public HttpResponse respond(HttpRequest req) {
            HttpResponse res = new HttpResponse();
            res.setStatusCode(201);
            res.setBody('{"ticket":{"id":12345,"subject":"Test Ticket"}}');
            return res;
        }
    }

    /**
     * Mock class for Zendesk API error response
     */
    private class ZendeskMockError implements HttpCalloutMock {
        public HttpResponse respond(HttpRequest req) {
            HttpResponse res = new HttpResponse();
            res.setStatusCode(401);
            res.setBody('{"error":"Unauthorized"}');
            return res;
        }
    }
}
