import { useQuery } from '@tanstack/react-query';
import { chatAPI } from '../../services/api';
import { Link } from 'react-router-dom';
import { 
  FiMessageSquare, 
  FiClock, 
  FiCheckCircle, 
  FiHelpCircle,
  FiBell,
  FiStar
} from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';

const CustomerDashboard = () => {
  const { user } = useAuth();

  const { data: unreadData } = useQuery({
    queryKey: ['unread-count'],
    queryFn: () => chatAPI.getUnreadCount(),
    refetchInterval: 30000,
  });

  const { data: roomData } = useQuery({
    queryKey: ['chat-room'],
    queryFn: () => chatAPI.getMyRoom(),
  });

  const stats = [
    {
      title: 'Active Chat',
      value: roomData?.data?.isActive ? 'Connected' : 'Waiting',
      icon: <FiMessageSquare className="w-6 h-6" />,
      color: 'bg-blue-100 text-blue-600',
      description: roomData?.data?.adminId ? 'With support agent' : 'Waiting for agent assignment',
    },
    {
      title: 'Unread Messages',
      value: unreadData?.data?.count || 0,
      icon: <FiBell className="w-6 h-6" />,
      color: 'bg-red-100 text-red-600',
      description: 'Messages waiting for your response',
    },
    {
      title: 'Last Active',
      value: roomData?.data?.lastMessageAt ? 'Today' : 'Never',
      icon: <FiClock className="w-6 h-6" />,
      color: 'bg-green-100 text-green-600',
      description: roomData?.data?.lastMessageAt || 'No messages yet',
    },
    {
      title: 'Account Status',
      value: user?.isVerified ? 'Verified' : 'Pending',
      icon: user?.isVerified ? <FiCheckCircle className="w-6 h-6" /> : <FiHelpCircle className="w-6 h-6" />,
      color: user?.isVerified ? 'bg-purple-100 text-purple-600' : 'bg-yellow-100 text-yellow-600',
      description: user?.isVerified ? 'Email verified' : 'Please verify your email',
    },
  ];

  const quickActions = [
    {
      title: 'Start New Chat',
      description: 'Begin a conversation with support',
      icon: <FiMessageSquare className="w-8 h-8" />,
      link: '/customer/chat',
      color: 'from-blue-500 to-blue-600',
    },
    {
      title: 'View Chat History',
      description: 'Review previous conversations',
      icon: <FiClock className="w-8 h-8" />,
      link: '/customer/chat',
      color: 'from-green-500 to-green-600',
    },
    {
      title: 'Rate Support',
      description: 'Share your feedback',
      icon: <FiStar className="w-8 h-8" />,
      link: '#',
      color: 'from-purple-500 to-purple-600',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto">
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back, {user?.email?.split('@')[0]}!
        </h1>
        <p className="text-gray-600 mt-2">
          Here's your support dashboard. You can start a new chat or continue existing conversations.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, index) => (
          <div key={index} className="bg-white rounded-xl shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{stat.title}</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">{stat.value}</p>
                <p className="text-xs text-gray-500 mt-1">{stat.description}</p>
              </div>
              <div className={`${stat.color} p-3 rounded-full`}>
                {stat.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {quickActions.map((action, index) => (
          <Link
            key={index}
            to={action.link}
            className={`bg-gradient-to-r ${action.color} rounded-xl shadow-lg overflow-hidden transform transition-transform hover:scale-[1.02]`}
          >
            <div className="p-6 text-white">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-white/20 p-3 rounded-full">
                  {action.icon}
                </div>
              </div>
              <h3 className="text-xl font-semibold mb-2">{action.title}</h3>
              <p className="text-white/90">{action.description}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Active Chat Section */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Active Support Chat</h2>
          <p className="text-gray-600">Continue your conversation with our support team</p>
        </div>
        
        {roomData?.data?.isActive ? (
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                  <FiMessageSquare className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Chat with Support Agent</h3>
                  <p className="text-gray-600 text-sm">
                    Last message: {roomData.data.lastMessageAt || 'No messages yet'}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                  Active Now
                </span>
                <Link
                  to="/customer/chat"
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Continue Chat
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FiMessageSquare className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No active chat</h3>
            <p className="text-gray-600 mb-6">Start a conversation with our support team</p>
            <Link
              to="/customer/chat"
              className="inline-flex items-center bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <FiMessageSquare className="mr-2" />
              Start New Chat
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerDashboard;