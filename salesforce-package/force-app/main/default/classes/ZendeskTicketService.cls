/**
 * ZendeskTicketService - Creates Zendesk tickets from Salesforce Cases
 * Uses Custom Metadata (Zendesk_Settings__mdt) for API credentials
 */
public with sharing class ZendeskTicketService {

    /**
     * Input wrapper for the invocable method
     */
    public class TicketRequest {
        @InvocableVariable(label='Case ID' required=true)
        public Id caseId;

        @InvocableVariable(label='Subject')
        public String subject;

        @InvocableVariable(label='Description')
        public String description;

        @InvocableVariable(label='Priority')
        public String priority;

        @InvocableVariable(label='Requester Email')
        public String requesterEmail;

        @InvocableVariable(label='Requester Name')
        public String requesterName;
    }

    /**
     * Output wrapper for the invocable method
     */
    public class TicketResponse {
        @InvocableVariable(label='Success')
        public Boolean success;

        @InvocableVariable(label='Zendesk Ticket ID')
        public String zendeskTicketId;

        @InvocableVariable(label='Error Message')
        public String errorMessage;
    }

    /**
     * Invocable method to create Zendesk tickets from Flow
     */
    @InvocableMethod(label='Create Zendesk Ticket' description='Creates a ticket in Zendesk from a Salesforce Case')
    public static List<TicketResponse> createTickets(List<TicketRequest> requests) {
        List<TicketResponse> responses = new List<TicketResponse>();

        // Get Zendesk settings from Custom Metadata
        Zendesk_Settings__mdt settings = getZendeskSettings();

        if (settings == null || !settings.Is_Active__c) {
            TicketResponse errorResponse = new TicketResponse();
            errorResponse.success = false;
            errorResponse.errorMessage = 'Zendesk integration is not configured or inactive';
            for (Integer i = 0; i < requests.size(); i++) {
                responses.add(errorResponse);
            }
            return responses;
        }

        for (TicketRequest request : requests) {
            TicketResponse response = createSingleTicket(request, settings);
            responses.add(response);
        }

        return responses;
    }

    /**
     * Creates a single Zendesk ticket
     */
    private static TicketResponse createSingleTicket(TicketRequest request, Zendesk_Settings__mdt settings) {
        TicketResponse response = new TicketResponse();

        try {
            // Build the Zendesk API endpoint
            String endpoint = 'https://' + settings.Subdomain__c + '.zendesk.com/api/v2/tickets.json';

            // Build the request body
            Map<String, Object> ticketData = new Map<String, Object>();
            Map<String, Object> ticket = new Map<String, Object>();

            // Set subject
            ticket.put('subject', String.isNotBlank(request.subject) ? request.subject : 'Case from Salesforce');

            // Set comment (description)
            Map<String, Object> comment = new Map<String, Object>();
            comment.put('body', String.isNotBlank(request.description) ? request.description : 'No description provided');
            ticket.put('comment', comment);

            // Map Salesforce priority to Zendesk priority
            if (String.isNotBlank(request.priority)) {
                ticket.put('priority', mapPriority(request.priority));
            }

            // Set requester if email provided
            if (String.isNotBlank(request.requesterEmail)) {
                Map<String, Object> requester = new Map<String, Object>();
                requester.put('email', request.requesterEmail);
                if (String.isNotBlank(request.requesterName)) {
                    requester.put('name', request.requesterName);
                }
                ticket.put('requester', requester);
            }

            // Add external ID for linking back to Salesforce
            ticket.put('external_id', request.caseId);

            // Add tags
            ticket.put('tags', new List<String>{'salesforce', 'auto-created'});

            ticketData.put('ticket', ticket);

            // Make the HTTP callout
            HttpRequest httpReq = new HttpRequest();
            httpReq.setEndpoint(endpoint);
            httpReq.setMethod('POST');
            httpReq.setHeader('Content-Type', 'application/json');
            httpReq.setHeader('Accept', 'application/json');

            // Set Basic Auth header
            String authString = settings.Email__c + '/token:' + settings.API_Token__c;
            Blob authBlob = Blob.valueOf(authString);
            String authHeader = 'Basic ' + EncodingUtil.base64Encode(authBlob);
            httpReq.setHeader('Authorization', authHeader);

            httpReq.setBody(JSON.serialize(ticketData));
            httpReq.setTimeout(30000);

            Http http = new Http();
            HttpResponse httpRes = http.send(httpReq);

            if (httpRes.getStatusCode() == 201) {
                // Success - parse response
                Map<String, Object> responseBody = (Map<String, Object>) JSON.deserializeUntyped(httpRes.getBody());
                Map<String, Object> createdTicket = (Map<String, Object>) responseBody.get('ticket');

                response.success = true;
                response.zendeskTicketId = String.valueOf(createdTicket.get('id'));
            } else {
                // Error
                response.success = false;
                response.errorMessage = 'Zendesk API Error: ' + httpRes.getStatusCode() + ' - ' + httpRes.getBody();
            }

        } catch (Exception e) {
            response.success = false;
            response.errorMessage = 'Exception: ' + e.getMessage();
        }

        return response;
    }

    /**
     * Maps Salesforce Case priority to Zendesk ticket priority
     */
    private static String mapPriority(String salesforcePriority) {
        Map<String, String> priorityMap = new Map<String, String>{
            'High' => 'high',
            'Medium' => 'normal',
            'Low' => 'low'
        };
        return priorityMap.containsKey(salesforcePriority) ? priorityMap.get(salesforcePriority) : 'normal';
    }

    /**
     * Gets the active Zendesk settings from Custom Metadata
     */
    private static Zendesk_Settings__mdt getZendeskSettings() {
        List<Zendesk_Settings__mdt> settings = [
            SELECT DeveloperName, Subdomain__c, Email__c, API_Token__c, Is_Active__c
            FROM Zendesk_Settings__mdt
            WHERE Is_Active__c = true
            LIMIT 1
        ];
        return settings.isEmpty() ? null : settings[0];
    }
}
