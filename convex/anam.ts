import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import Anthropic from "@anthropic-ai/sdk";

// ============================================================================
// ANAM SESSION MANAGEMENT
// ============================================================================

/**
 * Create an Anam session token for the Deal Coach avatar
 * This is called from the frontend to initiate a coaching session
 */
export const createSession = action({
  args: {
    opportunityId: v.string(),
    personaType: v.optional(v.string()), // "skeptical_cfo", "technical_evaluator", "friendly_champion"
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args): Promise<{
    sessionToken: string;
    coachingSessionId: Id<"coachingSessions">;
    persona: { name: string; type: string; description: string };
    dealContext: { opportunityName: string; amount: number | null; stage: string; accountName: string | null };
  }> => {
    const anamApiKey = process.env.ANAM_API_KEY;
    if (!anamApiKey) {
      throw new Error("ANAM_API_KEY not configured");
    }

    // Fetch opportunity data from Salesforce to build context
    const opportunityData = await ctx.runAction(api.salesforce.getRecord, {
      recordId: args.opportunityId,
      objectType: "Opportunity",
      fields: ["Id", "Name", "Amount", "StageName", "CloseDate", "AccountId", "Description", "NextStep", "Probability"],
    });

    // Fetch account data if we have an AccountId
    let accountData = null;
    if (opportunityData.AccountId) {
      accountData = await ctx.runAction(api.salesforce.getRecord, {
        recordId: opportunityData.AccountId,
        objectType: "Account",
        fields: ["Id", "Name", "Industry", "NumberOfEmployees", "AnnualRevenue", "Description", "Website"],
      });
    }

    // Build the persona based on type
    const persona = getCoachingPersona(args.personaType || "skeptical_cfo", opportunityData, accountData);

    // Create Anam session token
    const response = await fetch("https://api.anam.ai/v1/auth/session-token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${anamApiKey}`,
      },
      body: JSON.stringify({
        personaConfig: {
          name: persona.name,
          avatarId: persona.avatarId,
          voiceId: persona.voiceId,
          // Use custom LLM - we'll handle the brain
          llmId: "CUSTOMER_CLIENT_V1",
          systemPrompt: persona.systemPrompt,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Anam session creation failed:", error);
      throw new Error(`Failed to create Anam session: ${error}`);
    }

    const data = await response.json();

    // Create coaching session record
    const sessionId = await ctx.runMutation(internal.dealCoach.createCoachingSession, {
      opportunityId: args.opportunityId,
      opportunityName: opportunityData.Name,
      personaType: args.personaType || "skeptical_cfo",
      personaName: persona.name,
      userId: args.userId,
      dealContext: {
        amount: opportunityData.Amount,
        stage: opportunityData.StageName,
        closeDate: opportunityData.CloseDate,
        accountName: accountData?.Name,
        industry: accountData?.Industry,
      },
    });

    return {
      sessionToken: data.sessionToken,
      coachingSessionId: sessionId,
      persona: {
        name: persona.name,
        type: args.personaType || "skeptical_cfo",
        description: persona.description,
      },
      dealContext: {
        opportunityName: opportunityData.Name,
        amount: opportunityData.Amount,
        stage: opportunityData.StageName,
        accountName: accountData?.Name,
      },
    };
  },
});

/**
 * Handle chat messages from Anam - this is our custom LLM endpoint
 * Anam calls this to get responses, we inject Salesforce context
 */
export const handleChatMessage = action({
  args: {
    coachingSessionId: v.id("coachingSessions"),
    messages: v.array(v.object({
      role: v.string(),
      content: v.string(),
    })),
  },
  handler: async (ctx, args) => {
    // Get the coaching session for context
    const session = await ctx.runQuery(internal.dealCoach.getCoachingSession, {
      sessionId: args.coachingSessionId,
    });

    if (!session) {
      throw new Error("Coaching session not found");
    }

    // Build the system prompt with deal context
    const systemPrompt = buildCoachingSystemPrompt(session);

    // Call Claude for the response using SDK
    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-opus-4-5-20251101",
      max_tokens: 300, // Keep responses concise for voice
      system: systemPrompt,
      messages: args.messages.map(m => ({
        role: m.role === "user" ? "user" as const : "assistant" as const,
        content: m.content,
      })),
    });

    const assistantMessage = response.content[0].type === "text"
      ? response.content[0].text
      : "I'm sorry, I didn't catch that. Could you repeat?";

    // Log the interaction
    await ctx.runMutation(internal.dealCoach.logCoachingInteraction, {
      sessionId: args.coachingSessionId,
      userMessage: args.messages[args.messages.length - 1]?.content || "",
      assistantMessage,
    });

    return {
      content: assistantMessage,
    };
  },
});

/**
 * Stream chat response for real-time conversation
 * This endpoint streams responses back to Anam for smooth voice output
 */
export const streamChatResponse = internalAction({
  args: {
    coachingSessionId: v.id("coachingSessions"),
    userMessage: v.string(),
    conversationHistory: v.array(v.object({
      role: v.string(),
      content: v.string(),
    })),
  },
  handler: async (ctx, args) => {
    // Get session context
    const session = await ctx.runQuery(internal.dealCoach.getCoachingSession, {
      sessionId: args.coachingSessionId,
    });

    if (!session) {
      throw new Error("Coaching session not found");
    }

    const systemPrompt = buildCoachingSystemPrompt(session);
    const messages = [
      ...args.conversationHistory,
      { role: "user", content: args.userMessage },
    ];

    // Use SDK streaming for faster response
    const client = new Anthropic();
    const stream = client.messages.stream({
      model: "claude-opus-4-5-20251101",
      max_tokens: 300,
      system: systemPrompt,
      messages: messages.map(m => ({
        role: m.role === "user" ? "user" as const : "assistant" as const,
        content: m.content,
      })),
    });

    // Return the stream - caller will handle chunked reading
    return stream;
  },
});

// ============================================================================
// PERSONA DEFINITIONS
// ============================================================================

interface PersonaConfig {
  name: string;
  avatarId: string;
  voiceId: string;
  systemPrompt: string;
  description: string;
}

function getCoachingPersona(
  personaType: string,
  opportunity: any,
  account: any
): PersonaConfig {
  // Anam stock avatar IDs - these are examples, replace with actual IDs from your Anam account
  const avatars = {
    skeptical_cfo: "30fa96d0-26c4-4e55-94a0-517025942e18", // Professional male
    technical_evaluator: "e2d0e7a0-4e6a-4e5a-9e8a-1234567890ab", // Technical persona
    friendly_champion: "f3e1f8b1-5f7b-5f6b-0f9b-2345678901bc", // Approachable persona
    procurement_gatekeeper: "a1b2c3d4-1234-5678-9abc-def012345678", // Formal persona
  };

  const voices = {
    skeptical_cfo: "6bfbe25a-979d-40f3-a92b-5394170af54b", // Authoritative voice
    technical_evaluator: "7cdc26b-0b4c-4c3c-a93c-6405281bd55c", // Technical voice
    friendly_champion: "8ded37c-1c5d-5d4d-b04d-7516392ce66d", // Warm voice
    procurement_gatekeeper: "9efe48d-2d6e-6e5e-c15e-86274a3df77e", // Formal voice
  };

  const dealAmount = opportunity.Amount ? `$${(opportunity.Amount / 1000).toFixed(0)}k` : "undisclosed amount";
  const companyName = account?.Name || "the company";
  const industry = account?.Industry || "their industry";

  const personas: Record<string, PersonaConfig> = {
    skeptical_cfo: {
      name: "Margaret Chen - CFO",
      avatarId: avatars.skeptical_cfo,
      voiceId: voices.skeptical_cfo,
      description: "A skeptical CFO who needs to see clear ROI and is protective of budget",
      systemPrompt: `You are Margaret Chen, the CFO of ${companyName} in the ${industry} industry.

PERSONALITY:
- Highly analytical and numbers-focused
- Skeptical of vendors who can't prove ROI
- Protective of company budget
- Values concrete data over marketing speak
- Asks tough questions about pricing, implementation costs, and hidden fees
- Has seen many failed software implementations

DEAL CONTEXT:
- Deal Size: ${dealAmount}
- Current Stage: ${opportunity.StageName}
- Close Date Target: ${opportunity.CloseDate}
${opportunity.NextStep ? `- Next Step: ${opportunity.NextStep}` : ""}

YOUR ROLE:
You're meeting with a sales rep who is trying to close this deal. Challenge them on:
- Total cost of ownership
- ROI timeline and proof points
- Implementation risks
- What happens if it doesn't work out
- Why you should prioritize this over other initiatives

Be tough but fair. If the rep gives good answers, acknowledge it. If they dodge questions, push back.
Keep responses conversational and under 100 words. You're in a meeting, not writing an email.`,
    },

    technical_evaluator: {
      name: "David Park - VP Engineering",
      avatarId: avatars.technical_evaluator,
      voiceId: voices.technical_evaluator,
      description: "A technical decision-maker focused on integration, security, and scalability",
      systemPrompt: `You are David Park, VP of Engineering at ${companyName}.

PERSONALITY:
- Deep technical expertise
- Concerned about integration complexity
- Asks about API limits, data security, compliance
- Skeptical of "easy integration" claims
- Has been burned by vendors who overpromised
- Values technical documentation and proof-of-concepts

DEAL CONTEXT:
- Deal Size: ${dealAmount}
- Current Stage: ${opportunity.StageName}
- Company Industry: ${industry}

YOUR ROLE:
You're evaluating this solution from a technical perspective. Challenge the rep on:
- Integration architecture and effort required
- Security certifications and data handling
- Scalability and performance at scale
- API rate limits and availability SLAs
- What their technical support looks like

Be technical but not condescending. If the rep doesn't know something, suggest they bring in a solutions engineer.
Keep responses under 100 words.`,
    },

    friendly_champion: {
      name: "Sarah Martinez - Director of Operations",
      avatarId: avatars.friendly_champion,
      voiceId: voices.friendly_champion,
      description: "An internal champion who wants the deal to happen but needs help selling internally",
      systemPrompt: `You are Sarah Martinez, Director of Operations at ${companyName}.

PERSONALITY:
- Genuinely interested in the solution
- Wants to be a champion but needs ammunition
- Asks questions that will come up internally
- Shares political dynamics and concerns from other stakeholders
- Helpful but realistic about internal challenges

DEAL CONTEXT:
- Deal Size: ${dealAmount}
- Current Stage: ${opportunity.StageName}
- Industry: ${industry}

YOUR ROLE:
You like what you've seen and want to champion this internally, but you need help. Ask about:
- Materials you can share with the CFO
- Case studies from similar companies
- How to handle the "we've always done it this way" objection
- What happens in the implementation - who needs to be involved
- How to get quick wins to build momentum

Be collaborative and coach the rep on how to help you sell internally.
Keep responses under 100 words and conversational.`,
    },

    procurement_gatekeeper: {
      name: "Robert Thompson - Procurement Director",
      avatarId: avatars.procurement_gatekeeper,
      voiceId: voices.procurement_gatekeeper,
      description: "A procurement professional focused on terms, compliance, and competitive pricing",
      systemPrompt: `You are Robert Thompson, Director of Procurement at ${companyName}.

PERSONALITY:
- Process-oriented and by-the-book
- Focused on compliance, terms, and risk mitigation
- Will ask about competitive alternatives
- Tries to negotiate better terms
- Needs proper documentation and approvals

DEAL CONTEXT:
- Deal Size: ${dealAmount}
- Current Stage: ${opportunity.StageName}

YOUR ROLE:
You're involved late in the deal to handle procurement. Ask about:
- Contract terms and flexibility
- Data processing agreements and compliance
- What competitors are offering
- Volume discounts or multi-year terms
- References from similar-sized companies
- SLAs and what happens if they're missed

Be professional and methodical. You're not trying to kill the deal, just doing your job.
Keep responses under 100 words.`,
    },
  };

  return personas[personaType] || personas.skeptical_cfo;
}

function buildCoachingSystemPrompt(session: any): string {
  const context = session.dealContext || {};

  return `${session.systemPrompt || "You are a sales coaching assistant."}

CURRENT SESSION INFO:
- Opportunity: ${session.opportunityName}
- Amount: ${context.amount ? `$${context.amount.toLocaleString()}` : "Not specified"}
- Stage: ${context.stage || "Unknown"}
- Account: ${context.accountName || "Unknown"}
- Industry: ${context.industry || "Unknown"}

COACHING GUIDELINES:
1. Stay in character as the buyer persona throughout the conversation
2. React realistically to what the sales rep says
3. If they give a great answer, acknowledge it and move to another topic
4. If they stumble, give them a chance to recover but note the weakness
5. Keep responses concise (under 100 words) - this is a spoken conversation
6. Occasionally reference the specific deal details to make it realistic
7. At natural breaking points, you can offer brief coaching feedback

Remember: Your goal is to help them practice and improve, not to make them fail.`;
}

// ============================================================================
// AVAILABLE PERSONAS LIST
// ============================================================================

export const getAvailablePersonas = action({
  args: {},
  handler: async () => {
    return [
      {
        id: "skeptical_cfo",
        name: "Skeptical CFO",
        title: "Margaret Chen - CFO",
        description: "Challenges on ROI, budget, and business justification",
        difficulty: "hard",
        focusAreas: ["pricing", "ROI", "risk"],
      },
      {
        id: "technical_evaluator",
        name: "Technical Evaluator",
        title: "David Park - VP Engineering",
        description: "Deep dives on integration, security, and scalability",
        difficulty: "medium",
        focusAreas: ["integration", "security", "technical"],
      },
      {
        id: "friendly_champion",
        name: "Internal Champion",
        title: "Sarah Martinez - Director of Operations",
        description: "Wants to help you win but needs ammunition for internal selling",
        difficulty: "easy",
        focusAreas: ["internal selling", "stakeholder management", "quick wins"],
      },
      {
        id: "procurement_gatekeeper",
        name: "Procurement Gatekeeper",
        title: "Robert Thompson - Procurement Director",
        description: "Focused on terms, compliance, and competitive positioning",
        difficulty: "medium",
        focusAreas: ["negotiation", "terms", "compliance"],
      },
    ];
  },
});
