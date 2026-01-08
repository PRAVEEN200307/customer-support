import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { chatAPI } from '../../services/api';
import { Link } from 'react-router-dom';
import { 
  FiUsers, 
  FiMessageSquare, 
  FiCheckCircle, 
  FiClock,
  FiTrendingUp,
  FiActivity
} from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';

const AdminDashboard = () => {
  const { user } = useAuth();

  const { data: roomsData } = useQuery({
    queryKey: ['admin-rooms-summary'],
    queryFn: () => chatAPI.getAdminRooms(),
    refetchInterval: 30000,
  });

  console.log('Rooms Data:', roomsData?.data?.rooms);

  const activeRooms = roomsData?.data?.room?.filter(room => room.isActive) || [];
  const pendingRooms = roomsData?.data?.room?.filter(room => !room.isActive) || [];
  const totalMessages = roomsData?.data?.room?.reduce((acc, room) => acc + (room.messageCount || 0), 0) || 0;

  const stats = [
    {
      title: 'Active Chats',
      value: activeRooms.length,
      icon: <FiMessageSquare className="w-6 h-6" />,
      color: 'bg-green-100 text-green-600',
      description: 'Currently online customers',
    },
    {
      title: 'Pending Requests',
      value: pendingRooms.length,
      icon: <FiClock className="w-6 h-6" />,
      color: 'bg-yellow-100 text-yellow-600',
      description: 'Waiting for response',
    },
    {
      title: 'Total Conversations',
      value: roomsData?.data?.length || 0,
      icon: <FiUsers className="w-6 h-6" />,
      color: 'bg-blue-100 text-blue-600',
      description: 'All time unique rooms',
    },
    {
      title: 'Total Messages',
      value: totalMessages,
      icon: <FiTrendingUp className="w-6 h-6" />,
      color: 'bg-purple-100 text-purple-600',
      description: 'Messages exchanged',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Admin Overview</h1>
        <p className="text-gray-600 mt-2">
          Monitor support activity and manage customer communications.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {stats.map((stat, index) => (
          <div key={index} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">{stat.title}</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stat.value}</p>
              </div>
              <div className={`${stat.color} p-4 rounded-2xl`}>
                {stat.icon}
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-4 flex items-center">
              <FiActivity className="mr-1" />
              {stat.description}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Active Chats */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Recent Active Chats</h2>
            <Link to="/admin/chat" className="text-blue-600 hover:text-blue-700 font-medium text-sm">
              View All
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {activeRooms.length > 0 ? (
              activeRooms.slice(0, 5).map((room) => (
                <div key={room.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                        {room.customer?.email?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{room.customer?.email}</p>
                        <p className="text-xs text-gray-500">Last active: {new Date(room.updatedAt).toLocaleTimeString()}</p>
                      </div>
                    </div>
                    <Link
                      to={`/admin/chat?room=${room.id}`}
                      className="px-4 py-1.5 bg-blue-50 text-blue-600 rounded-full text-xs font-semibold hover:bg-blue-100 transition-colors"
                    >
                      Open Chat
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-gray-500">
                <p>No active chats at the moment.</p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Management */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Quick Management</h2>
          <div className="space-y-4">
            <Link
              to="/admin/rooms"
              className="flex items-center p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group"
            >
              <div className="bg-blue-600 text-white p-3 rounded-lg mr-4">
                <FiUsers className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Manage Rooms</h3>
                <p className="text-sm text-gray-500">View and organize all customer chat rooms</p>
              </div>
              <FiCheckCircle className="ml-auto text-gray-300 group-hover:text-blue-600 transition-colors" />
            </Link>

            <Link
              to="/admin/chat"
              className="flex items-center p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group"
            >
              <div className="bg-green-600 text-white p-3 rounded-lg mr-4">
                <FiMessageSquare className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Active Support</h3>
                <p className="text-sm text-gray-500">Jump directly into active conversations</p>
              </div>
              <FiCheckCircle className="ml-auto text-gray-300 group-hover:text-green-600 transition-colors" />
            </Link>
          </div>

          <div className="mt-8 p-6 bg-blue-50 rounded-2xl border border-blue-100">
            <h4 className="text-blue-800 font-bold mb-2">Support Tip</h4>
            <p className="text-sm text-blue-700">
              Prompt responses increase customer satisfaction by 40%. Keep an eye on the "Pending Requests" metric!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
