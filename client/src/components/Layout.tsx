import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import NotificationDropdown from './NotificationDropdown';
import { 
  UserIcon, 
  ChartBarIcon,
  Bars3Icon,
  XMarkIcon,
  ArrowTopRightOnSquareIcon,
  LinkIcon,
  CalendarIcon,
  BookOpenIcon,
  UserGroupIcon,
  CalculatorIcon,
  QuestionMarkCircleIcon
} from '@heroicons/react/24/outline';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLinksMenuOpen, setIsLinksMenuOpen] = useState(false);
  const [isMobileLinksOpen, setIsMobileLinksOpen] = useState(false);
  const [isResourcesMenuOpen, setIsResourcesMenuOpen] = useState(false);
  const [isMobileResourcesOpen, setIsMobileResourcesOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, logout } = useAuth();

  const navigation = [
    { name: 'Events', href: 'https://www.meetup.com/charleston-riichi-mahjong/events/', icon: CalendarIcon, external: true },
    { name: 'Calculator', href: '/calculator', icon: CalculatorIcon },
    ...(isAuthenticated ? [
      { name: 'Games', href: '/games', icon: ChartBarIcon },
    ] : []),
  ];

  const resourceLinks = [
    ...(isAuthenticated ? [
      { name: 'Members', href: '/members', icon: UserGroupIcon },
      { name: 'Discard quiz', href: '/discard-quiz', icon: QuestionMarkCircleIcon },
    ] : []),
    { name: 'Resource links', href: '/resources', icon: BookOpenIcon },
  ];

  const externalLinks = [
    { name: 'Merch Shop', href: 'https://shop.printyourcause.com/campaigns/charleston-riichi-mahjong-club', icon: ArrowTopRightOnSquareIcon },
    { name: 'Meetup', href: 'https://www.meetup.com/charleston-riichi-mahjong/', icon: ArrowTopRightOnSquareIcon },
    { name: 'Discord Server', href: 'https://discord.gg/xhZtZZF3Jk', icon: ArrowTopRightOnSquareIcon },
    { name: 'Instagram', href: 'https://www.instagram.com/charlestonriichimahjong/', icon: ArrowTopRightOnSquareIcon },
    { name: 'Facebook', href: 'https://www.facebook.com/profile.php?id=61559320292988', icon: ArrowTopRightOnSquareIcon },
  ];

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isActive = (href: string) => location.pathname === href;

  return (
    <div className="min-h-screen bg-gray-50">
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
                {navigation.map((item) => (
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
                    <item.icon className="h-4 w-4 mr-2" />
                    {item.name}
                  </Link>
                ))}
                {/* Resources Dropdown */}
                <div
                  className="relative inline-flex"
                  onMouseEnter={() => setIsResourcesMenuOpen(true)}
                  onMouseLeave={() => setIsResourcesMenuOpen(false)}
                >
                  <button
                    className="inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium border-transparent text-gray-500 hover:text-gray-700"
                  >
                    <BookOpenIcon className="h-4 w-4 mr-2" />
                    Resources
                  </button>
                  {isResourcesMenuOpen && (
                    <div className="absolute top-full left-0 mt-0 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
                      <div className="py-1">
                        {resourceLinks.map((item) => (
                          <Link
                            key={item.name}
                            to={item.href}
                            className={`flex items-center px-4 py-2 text-sm ${
                              isActive(item.href)
                                ? 'bg-primary-50 text-primary-700'
                                : 'text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            <item.icon className="h-4 w-4 mr-2" />
                            {item.name}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                {/* External Links Dropdown */}
                <div
                  className="relative inline-flex"
                  onMouseEnter={() => setIsLinksMenuOpen(true)}
                  onMouseLeave={() => setIsLinksMenuOpen(false)}
                >
                  <button
                    className="inline-flex items-center px-1 pt-1 border-b-2 border-transparent text-sm font-medium text-gray-500 hover:text-gray-700"
                  >
                    <LinkIcon className="h-4 w-4 mr-2" />
                    Links
                  </button>
                  {isLinksMenuOpen && (
                    <div className="absolute top-full left-0 mt-0 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
                      <div className="py-1">
                        {externalLinks.map((item) => (
                          <a
                            key={item.name}
                            href={item.href}
                            target="_blank"
                            rel="noreferrer"
                            title={item.name}
                            className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          >
                            <item.icon className="h-4 w-4 mr-2" />
                            {item.name}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
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
              {navigation.map((item) => (
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
                    <item.icon className="h-5 w-5 mr-3" />
                    {item.name}
                  </div>
                </Link>
              ))}
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
                    {resourceLinks.map((item) => (
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
                          <item.icon className="h-4 w-4 mr-3" />
                          {item.name}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
              {/* Mobile External Links Collapsible */}
              <div>
                <button
                  onClick={() => setIsMobileLinksOpen(!isMobileLinksOpen)}
                  className="block w-full text-left pl-3 pr-4 py-2 border-l-4 border-transparent text-base font-medium text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <LinkIcon className="h-5 w-5 mr-3" />
                      Links
                    </div>
                    <span className="text-xs">{isMobileLinksOpen ? '−' : '+'}</span>
                  </div>
                </button>
                {isMobileLinksOpen && (
                  <div className="pl-6 space-y-1">
                    {externalLinks.map((item) => (
                      <a
                        key={item.name}
                        href={item.href}
                        target="_blank"
                        rel="noreferrer"
                        title={item.name}
                        className="block pl-3 pr-4 py-2 border-l-4 border-transparent text-sm font-medium text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700"
                        onClick={() => {
                          setIsMobileMenuOpen(false);
                          setIsMobileLinksOpen(false);
                        }}
                      >
                        <div className="flex items-center">
                          <item.icon className="h-4 w-4 mr-3" />
                          {item.name}
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </div>
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
        )}
      </nav>

      {/* Main content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
};

export default Layout;

