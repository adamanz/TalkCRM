import { LightningElement, api } from 'lwc';

export default class TalkCrmVoiceWidget extends LightningElement {
    // Public properties - can be set by admin in App Builder
    @api agentId = 'agent_0701kc80pzcvfnytxrbeaezmy4tg'; // Default ElevenLabs agent ID
    @api widgetHeight = '500px';

    // Base URL for the widget endpoint
    WIDGET_BASE_URL = 'https://tough-raccoon-796.convex.site/widget/elevenlabs';

    get showWidget() {
        return true;
    }

    get widgetUrl() {
        const params = new URLSearchParams();
        params.set('agent_id', this.agentId);
        return `${this.WIDGET_BASE_URL}?${params.toString()}`;
    }
}
