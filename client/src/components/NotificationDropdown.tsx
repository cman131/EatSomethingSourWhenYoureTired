import React, { useState, useEffect, useRef } from 'react';
import { BellIcon } from '@heroicons/react/24/outline';
import { notificationsApi, Notification } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface NotificationDropdownProps {
  mobile?: boolean;
}

const NotificationDropdown: React.FC<NotificationDropdownProps> = ({ mobile = false }) => {
  const { user, refreshUser } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>(user?.notifications || []);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Update notifications when user changes
    if (user?.notifications) {
      setNotifications(user.notifications);
    }
  }, [user]);

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      const response = await notificationsApi.getNotifications();
      setNotifications(response.data.notifications || []);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.viewed) {
      try {
        await notificationsApi.markAsViewed(notification._id);
        setNotifications(prev =>
          prev.map(n => n._id === notification._id ? { ...n, viewed: true } : n)
        );
        await refreshUser();
      } catch (error) {
        console.error('Failed to mark notification as viewed:', error);
      }
    }

    setIsOpen(false);
    if (notification.url) {
      navigate(notification.url);
    }
  };

  const handleMarkAllAsViewed = async () => {
    try {
      await notificationsApi.markAllAsViewed();
      setNotifications(prev => prev.map(n => ({ ...n, viewed: true })));
      await refreshUser();
    } catch (error) {
      console.error('Failed to mark all as viewed:', error);
    }
  };

  const handleClearAllNotifications = async () => {
    if (window.confirm('Are you sure you want to delete all notifications? This action cannot be undone.')) {
      try {
        await notificationsApi.clearAllNotifications();
        setNotifications([]);
        await refreshUser();
      } catch (error) {
        console.error('Failed to clear all notifications:', error);
      }
    }
  };

  const handleDeleteNotification = async (notificationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await notificationsApi.deleteNotification(notificationId);
      setNotifications(prev => prev.filter(n => n._id !== notificationId));
      await refreshUser();
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  const unreadCount = notifications.filter(n => !n.viewed).length;

  return (
    <div className={mobile ? "w-full" : "relative"} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={mobile
          ? "block w-full text-left pl-3 pr-4 py-2 border-l-4 border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700"
          : "relative p-2 text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 rounded-md"
        }
        aria-label="Notifications"
      >
        {mobile ? (
          <div className="flex items-center">
            <BellIcon className="h-5 w-5 mr-3" />
            <span>Notifications</span>
            {unreadCount > 0 && (
              <span className="ml-auto block h-5 w-5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>
        ) : (
          <>
            <BellIcon className="h-6 w-6" />
            {unreadCount > 0 && (
              <span className="absolute top-0 right-0 block h-4 w-4 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </>
        )}
      </button>

      {isOpen && (
        <div className={`${mobile ? 'absolute left-0 right-0 mt-0 w-full' : 'absolute right-0 mt-2 w-80'} rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50 ${mobile ? 'max-h-[calc(100vh-8rem)]' : 'max-h-96'} overflow-hidden flex flex-col`}>
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
            <div className="flex items-center gap-3">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsViewed}
                  className="text-sm text-primary-600 hover:text-primary-700"
                >
                  Mark all read
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={handleClearAllNotifications}
                  className="text-sm text-red-600 hover:text-red-700"
                >
                  Delete all
                </button>
              )}
            </div>
          </div>

          <div className="overflow-y-auto flex-1">
            {isLoading ? (
              <div className="p-4 text-center text-gray-500">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="p-4 text-center text-gray-500">No notifications</div>
            ) : (
              <div className="divide-y divide-gray-200">
                {notifications.map((notification) => (
                  <div
                    key={notification._id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                      !notification.viewed ? 'bg-primary-50' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`text-sm font-medium ${
                            !notification.viewed ? 'text-gray-900' : 'text-gray-700'
                          }`}>
                            {notification.name}
                          </p>
                          {!notification.viewed && (
                            <span className="h-2 w-2 rounded-full bg-primary-600 flex-shrink-0"></span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 mt-1">{notification.description}</p>
                        {notification.createdAt && (
                          <p className="text-xs text-gray-400 mt-1">
                            {new Date(notification.createdAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={(e) => handleDeleteNotification(notification._id, e)}
                        className="ml-2 text-gray-400 hover:text-red-500 focus:outline-none"
                        aria-label="Delete notification"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationDropdown;

