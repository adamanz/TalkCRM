import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <header className="sticky top-0 z-10 bg-white dark:bg-slate-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <span className="text-white text-xl">📞</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">TalkCRM</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">Voice-Powered Salesforce</p>
            </div>
          </div>
          <SalesforceStatus />
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-8">
        <Dashboard />
      </main>
    </div>
  );
}

function SalesforceStatus() {
  // TODO: Check Salesforce connection status
  const isConnected = false; // Will be replaced with actual check

  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-yellow-500'}`} />
      <span className="text-sm text-slate-600 dark:text-slate-300">
        {isConnected ? 'Salesforce Connected' : 'Connect Salesforce'}
      </span>
      {!isConnected && (
        <a
          href={getSalesforceAuthUrl()}
          className="ml-2 px-3 py-1 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          Connect
        </a>
      )}
    </div>
  );
}

function getSalesforceAuthUrl() {
  const clientId = import.meta.env.VITE_SALESFORCE_CLIENT_ID || 'YOUR_CLIENT_ID';
  const redirectUri = import.meta.env.VITE_SALESFORCE_REDIRECT_URI || 'http://localhost:5173/auth/callback';
  return `https://login.salesforce.com/services/oauth2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}`;
}

function Dashboard() {
  const stats = useQuery(api.conversations.getConversationStats);
  const conversations = useQuery(api.conversations.listConversations, { limit: 10 });

  return (
    <div className="space-y-8">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Calls"
          value={stats?.total ?? 0}
          icon="📞"
          color="blue"
        />
        <StatCard
          title="Today"
          value={stats?.today ?? 0}
          icon="📅"
          color="green"
        />
        <StatCard
          title="Records Accessed"
          value={stats?.recordsAccessed ?? 0}
          icon="📊"
          color="purple"
        />
        <StatCard
          title="Records Modified"
          value={stats?.recordsModified ?? 0}
          icon="✏️"
          color="orange"
        />
      </div>

      {/* How to Use */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          How to Use TalkCRM
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          <Step
            number={1}
            title="Call the Number"
            description="Call your dedicated TalkCRM phone number to connect with your AI assistant"
          />
          <Step
            number={2}
            title="Ask Anything"
            description="'Show me my pipeline', 'Find the Acme account', 'Create a follow-up task'"
          />
          <Step
            number={3}
            title="Get Things Done"
            description="Your assistant will search, create, and update Salesforce records for you"
          />
        </div>
      </div>

      {/* Phone Number Display */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm opacity-80">Your TalkCRM Number</p>
            <p className="text-3xl font-bold font-mono">+1 (555) 123-4567</p>
            <p className="text-sm mt-2 opacity-80">Call anytime to talk to your Salesforce data</p>
          </div>
          <div className="text-6xl">📱</div>
        </div>
      </div>

      {/* Example Commands */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Example Voice Commands
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          <CommandExample
            command="Show me my pipeline"
            description="Get a summary of your open opportunities"
          />
          <CommandExample
            command="Find the Acme account"
            description="Search for an account by name"
          />
          <CommandExample
            command="What tasks do I have today?"
            description="List your open tasks due today"
          />
          <CommandExample
            command="Create a task to follow up with John"
            description="Create a new task in Salesforce"
          />
          <CommandExample
            command="Update the Acme deal to Closed Won"
            description="Update an opportunity stage"
          />
          <CommandExample
            command="Log this call on the Johnson contact"
            description="Log call activity in Salesforce"
          />
        </div>
      </div>

      {/* Recent Conversations */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Recent Conversations
        </h2>
        {!conversations || conversations.length === 0 ? (
          <p className="text-slate-500 dark:text-slate-400 text-center py-8">
            No conversations yet. Make your first call!
          </p>
        ) : (
          <div className="space-y-3">
            {conversations.map((conv) => (
              <ConversationRow key={conv._id} conversation={conv} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: number;
  icon: string;
  color: 'blue' | 'green' | 'purple' | 'orange';
}) {
  const colorClasses = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
    orange: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400',
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">{title}</p>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">{value}</p>
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${colorClasses[color]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function Step({
  number,
  title,
  description,
}: {
  number: number;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-4">
      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-sm flex-shrink-0">
        {number}
      </div>
      <div>
        <h3 className="font-medium text-slate-900 dark:text-white">{title}</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
      </div>
    </div>
  );
}

function CommandExample({
  command,
  description,
}: {
  command: string;
  description: string;
}) {
  return (
    <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
      <p className="font-mono text-sm text-blue-600 dark:text-blue-400">"{command}"</p>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{description}</p>
    </div>
  );
}

function ConversationRow({
  conversation,
}: {
  conversation: {
    _id: string;
    conversationId: string;
    callerPhone?: string;
    startTime: number;
    endTime?: number;
    status: 'active' | 'completed' | 'failed';
    summary?: string;
    salesforceRecordsAccessed: string[];
    salesforceRecordsModified: string[];
  };
}) {
  const duration = conversation.endTime
    ? Math.round((conversation.endTime - conversation.startTime) / 1000)
    : null;

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  return (
    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
      <div className="flex items-center gap-4">
        <div className={`w-3 h-3 rounded-full ${
          conversation.status === 'active' ? 'bg-green-500 animate-pulse' :
          conversation.status === 'completed' ? 'bg-slate-400' : 'bg-red-500'
        }`} />
        <div>
          <p className="font-medium text-slate-900 dark:text-white">
            {conversation.callerPhone || conversation.conversationId.slice(0, 8)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {new Date(conversation.startTime).toLocaleString()}
            {duration && ` · ${formatDuration(duration)}`}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
        <span title="Records accessed">📊 {conversation.salesforceRecordsAccessed.length}</span>
        <span title="Records modified">✏️ {conversation.salesforceRecordsModified.length}</span>
      </div>
    </div>
  );
}
