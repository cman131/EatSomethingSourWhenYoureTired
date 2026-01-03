import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import NotificationDropdown from './NotificationDropdown';
import { 
  UserIcon, 
  ChartBarIcon,
  Bars3Icon,
  XMarkIcon,
  CalendarIcon,
  BookOpenIcon,
  UserGroupIcon,
  CalculatorIcon,
  QuestionMarkCircleIcon,
  ShoppingBagIcon,
  TrophyIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline';
import { FaFacebook, FaInstagram, FaDiscord, FaMeetup, FaMedal } from 'react-icons/fa';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isResourcesMenuOpen, setIsResourcesMenuOpen] = useState(false);
  const [isMobileResourcesOpen, setIsMobileResourcesOpen] = useState(false);
  const [isCommunityMenuOpen, setIsCommunityMenuOpen] = useState(false);
  const [isMobileCommunityOpen, setIsMobileCommunityOpen] = useState(false);
  const [isAdminMenuOpen, setIsAdminMenuOpen] = useState(false);
  const [isMobileAdminOpen, setIsMobileAdminOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, logout, user } = useAuth();

  const navigation = [
    { name: 'Events', href: 'https://www.meetup.com/charleston-riichi-mahjong/events/', icon: CalendarIcon, external: true },
    { name: 'Store', href: 'https://shop.printyourcause.com/campaigns/charleston-riichi-mahjong-club', icon: ShoppingBagIcon, external: true },
  ];

  const communityLinks = isAuthenticated ? [
    { name: 'Games', href: '/games', icon: ChartBarIcon },
    { name: 'Tournaments', href: '/tournaments', icon: TrophyIcon },
    { name: 'Members', href: '/members', icon: UserGroupIcon },
    { name: 'Achievements', href: '/achievements', icon: FaMedal },
  ] : [];

  const resourceLinks = [
    { name: 'Calculator', href: '/calculator', icon: CalculatorIcon },
    ...(isAuthenticated ? [
      { name: 'Discard quiz', href: '/discard-quiz', icon: QuestionMarkCircleIcon },
    ] : []),
    { name: 'Resources', href: '/resources', icon: BookOpenIcon },
  ];

  const adminLinks = (user?.isAdmin === true) ? [
    { name: 'Create Tournament', href: '/create-tournament', icon: CalendarIcon },
  ] : [];

  const externalLinks = [
    { name: 'Merch Shop', href: 'https://shop.printyourcause.com/campaigns/charleston-riichi-mahjong-club', icon: ShoppingBagIcon },
    { name: 'Meetup', href: 'https://www.meetup.com/charleston-riichi-mahjong/', icon: FaMeetup },
    { name: 'Discord Server', href: 'https://discord.gg/xhZtZZF3Jk', icon: FaDiscord },
    { name: 'Instagram', href: 'https://www.instagram.com/charlestonriichimahjong/', icon: FaInstagram },
    { name: 'Facebook', href: 'https://www.facebook.com/profile.php?id=61559320292988', icon: FaFacebook },
  ] as const;

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isActive = (href: string) => location.pathname.startsWith(href);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <Link to="/" className="text-2xl font-bold text-primary-600">
                  Charleston Riichi Mahjong
                </Link>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                {navigation.map((item) => {
                  const IconComponent = item.icon as React.ComponentType<{ className?: string }>;
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      target={item.external ? '_blank' : undefined}
                      rel={item.external ? 'noreferrer' : undefined}
                      className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                        isActive(item.href)
                          ? 'border-primary-500 text-gray-900'
                          : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                      }`}
                    >
                      <IconComponent className="h-4 w-4 mr-2" />
                      {item.name}
                    </Link>
                  );
                })}
                {/* Community Dropdown - Only show when authenticated */}
                {isAuthenticated && (
                  <div
                    className="relative inline-flex"
                    onMouseEnter={() => setIsCommunityMenuOpen(true)}
                    onMouseLeave={() => setIsCommunityMenuOpen(false)}
                  >
                    <button
                      className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                        communityLinks.some(item => isActive(item.href))
                          ? 'border-primary-500 text-gray-900'
                          : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                      }`}
                    >
                      <UserGroupIcon className="h-4 w-4 mr-2" />
                      Community
                    </button>
                    {isCommunityMenuOpen && (
                      <div className="absolute top-full left-0 mt-0 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
                        <div className="py-1">
                          {communityLinks.map((item) => {
                            const IconComponent = item.icon as React.ComponentType<{ className?: string }>;
                            return (
                              <Link
                                key={item.name}
                                to={item.href}
                                className={`flex items-center px-4 py-2 text-sm ${
                                  isActive(item.href)
                                    ? 'bg-primary-50 text-primary-700'
                                    : 'text-gray-700 hover:bg-gray-100'
                                }`}
                              >
                                <IconComponent className="h-4 w-4 mr-2" />
                                {item.name}
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {/* Learning Dropdown */}
                <div
                  className="relative inline-flex"
                  onMouseEnter={() => setIsResourcesMenuOpen(true)}
                  onMouseLeave={() => setIsResourcesMenuOpen(false)}
                >
                  <button
                    className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                      resourceLinks.some(item => isActive(item.href))
                        ? 'border-primary-500 text-gray-900'
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    }`}
                  >
                    <BookOpenIcon className="h-4 w-4 mr-2" />
                    Learning
                  </button>
                  {isResourcesMenuOpen && (
                    <div className="absolute top-full left-0 mt-0 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
                      <div className="py-1">
                        {resourceLinks.map((item) => {
                          const IconComponent = item.icon as React.ComponentType<{ className?: string }>;
                          return (
                            <Link
                              key={item.name}
                              to={item.href}
                              className={`flex items-center px-4 py-2 text-sm ${
                                isActive(item.href)
                                  ? 'bg-primary-50 text-primary-700'
                                  : 'text-gray-700 hover:bg-gray-100'
                              }`}
                            >
                              <IconComponent className="h-4 w-4 mr-2" />
                              {item.name}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
                {/* Admin Dropdown - Only show when authenticated and user is admin */}
                {isAuthenticated && user?.isAdmin === true && (
                  <div
                    className="relative inline-flex"
                    onMouseEnter={() => setIsAdminMenuOpen(true)}
                    onMouseLeave={() => setIsAdminMenuOpen(false)}
                  >
                    <button
                      className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                        adminLinks.some(item => isActive(item.href))
                          ? 'border-primary-500 text-gray-900'
                          : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                      }`}
                    >
                      <ShieldCheckIcon className="h-4 w-4 mr-2" />
                      Admin
                    </button>
                    {isAdminMenuOpen && (
                      <div className="absolute top-full left-0 mt-0 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
                        <div className="py-1">
                          {adminLinks.map((item) => {
                            const IconComponent = item.icon as React.ComponentType<{ className?: string }>;
                            return (
                              <Link
                                key={item.name}
                                to={item.href}
                                className={`flex items-center px-4 py-2 text-sm ${
                                  isActive(item.href)
                                    ? 'bg-primary-50 text-primary-700'
                                    : 'text-gray-700 hover:bg-gray-100'
                                }`}
                              >
                                <IconComponent className="h-4 w-4 mr-2" />
                                {item.name}
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            {/* Auth controls */}
            <div className="hidden sm:flex sm:items-center sm:space-x-4">
              {isAuthenticated ? (
                <>
                  <NotificationDropdown />
                  <Link
                    key={'Profile'}
                    to={'/profile'}
                    className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium border-transparent text-gray-500 hover:text-gray-700`}
                  >
                    <UserIcon className="h-4 w-4 mr-2" />
                    Profile
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Login
                  </Link>
                  <Link
                    to="/register"
                    className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md transition-colors duration-200"
                  >
                    Register
                  </Link>
                </>
              )}
            </div>
            
            {/* Mobile menu button */}
            <div className="sm:hidden flex items-center">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
              >
                {isMobileMenuOpen ? (
                  <XMarkIcon className="block h-6 w-6" />
                ) : (
                  <Bars3Icon className="block h-6 w-6" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {isMobileMenuOpen && (
          <div className="sm:hidden">
            <div className="pt-2 pb-3 space-y-1">
              {navigation.map((item) => {
                const IconComponent = item.icon as React.ComponentType<{ className?: string }>;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`block pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
                      isActive(item.href)
                        ? 'bg-primary-50 border-primary-500 text-primary-700'
                        : 'border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700'
                    }`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <div className="flex items-center">
                      <IconComponent className="h-5 w-5 mr-3" />
                      {item.name}
                    </div>
                  </Link>
                );
              })}
              {/* Mobile Community Collapsible - Only show when authenticated */}
              {isAuthenticated && (
                <div>
                  <button
                    onClick={() => setIsMobileCommunityOpen(!isMobileCommunityOpen)}
                    className={`block w-full text-left pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
                      communityLinks.some(item => isActive(item.href))
                        ? 'bg-primary-50 border-primary-500 text-primary-700'
                        : 'border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <UserGroupIcon className="h-5 w-5 mr-3" />
                        Community
                      </div>
                      <span className="text-xs">{isMobileCommunityOpen ? '−' : '+'}</span>
                    </div>
                  </button>
                  {isMobileCommunityOpen && (
                    <div className="pl-6 space-y-1">
                      {communityLinks.map((item) => {
                        const IconComponent = item.icon as React.ComponentType<{ className?: string }>;
                        return (
                          <Link
                            key={item.name}
                            to={item.href}
                            className={`block pl-3 pr-4 py-2 border-l-4 text-sm font-medium ${
                              isActive(item.href)
                                ? 'bg-primary-50 border-primary-500 text-primary-700'
                                : 'border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700'
                            }`}
                            onClick={() => {
                              setIsMobileMenuOpen(false);
                              setIsMobileCommunityOpen(false);
                            }}
                          >
                            <div className="flex items-center">
                              <IconComponent className="h-4 w-4 mr-3" />
                              {item.name}
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
              {/* Mobile Resources Collapsible */}
              <div>
                <button
                  onClick={() => setIsMobileResourcesOpen(!isMobileResourcesOpen)}
                  className={`block w-full text-left pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
                    resourceLinks.some(item => isActive(item.href))
                      ? 'bg-primary-50 border-primary-500 text-primary-700'
                      : 'border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <BookOpenIcon className="h-5 w-5 mr-3" />
                      Resources
                    </div>
                    <span className="text-xs">{isMobileResourcesOpen ? '−' : '+'}</span>
                  </div>
                </button>
                {isMobileResourcesOpen && (
                  <div className="pl-6 space-y-1">
                    {resourceLinks.map((item) => {
                      const IconComponent = item.icon as React.ComponentType<{ className?: string }>;
                      return (
                        <Link
                          key={item.name}
                          to={item.href}
                          className={`block pl-3 pr-4 py-2 border-l-4 text-sm font-medium ${
                            isActive(item.href)
                              ? 'bg-primary-50 border-primary-500 text-primary-700'
                              : 'border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700'
                          }`}
                          onClick={() => {
                            setIsMobileMenuOpen(false);
                            setIsMobileResourcesOpen(false);
                          }}
                        >
                          <div className="flex items-center">
                            <IconComponent className="h-4 w-4 mr-3" />
                            {item.name}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              {/* Mobile Admin Collapsible - Only show when authenticated and user is admin */}
              {isAuthenticated && user?.isAdmin === true && (
                <div>
                  <button
                    onClick={() => setIsMobileAdminOpen(!isMobileAdminOpen)}
                    className={`block w-full text-left pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
                      adminLinks.some(item => isActive(item.href))
                        ? 'bg-primary-50 border-primary-500 text-primary-700'
                        : 'border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <ShieldCheckIcon className="h-5 w-5 mr-3" />
                        Admin
                      </div>
                      <span className="text-xs">{isMobileAdminOpen ? '−' : '+'}</span>
                    </div>
                  </button>
                  {isMobileAdminOpen && (
                    <div className="pl-6 space-y-1">
                      {adminLinks.map((item) => {
                        const IconComponent = item.icon as React.ComponentType<{ className?: string }>;
                        return (
                          <Link
                            key={item.name}
                            to={item.href}
                            className={`block pl-3 pr-4 py-2 border-l-4 text-sm font-medium ${
                              isActive(item.href)
                                ? 'bg-primary-50 border-primary-500 text-primary-700'
                                : 'border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700'
                            }`}
                            onClick={() => {
                              setIsMobileMenuOpen(false);
                              setIsMobileAdminOpen(false);
                            }}
                          >
                            <div className="flex items-center">
                              <IconComponent className="h-4 w-4 mr-3" />
                              {item.name}
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
              {isAuthenticated ? (
                <>
                  <NotificationDropdown mobile />
                  <Link
                    to="/profile"
                    className="block pl-3 pr-4 py-2 border-l-4 border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <div className="flex items-center">
                      <UserIcon className="h-5 w-5 mr-3" />
                      Profile
                    </div>
                  </Link>
                  <button
                    onClick={() => {
                      handleLogout();
                      setIsMobileMenuOpen(false);
                    }}
                    className="block w-full text-left pl-3 pr-4 py-2 border-l-4 border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="block pl-3 pr-4 py-2 border-l-4 border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Login
                  </Link>
                  <Link
                    to="/register"
                    className="block pl-3 pr-4 py-2 border-l-4 border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Register
                  </Link>
                </>
              )}
            </div>
          </div>
        </div> 
        )}
      </nav>

      {/* Main content */}
      <main className="flex-1 max-w-7xl mx-auto py-6 sm:px-6 lg:px-8 w-full">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6">
            {externalLinks.map((item) => {
              const IconComponent = item.icon as React.ComponentType<{ className?: string }>;
              return (
                <a
                  key={item.name}
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <IconComponent className="h-4 w-4 mr-2" />
                  {item.name}
                </a>
              );
            })}
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;

