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
  CalculatorIcon,
  QuestionMarkCircleIcon,
  ShoppingBagIcon,
  TrophyIcon,
  ScaleIcon,
  StarIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { FaFacebook, FaInstagram, FaDiscord, FaMeetup } from 'react-icons/fa';
import { PageBackdropContext } from '../contexts/PageBackdropContext';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isResourcesMenuOpen, setIsResourcesMenuOpen] = useState(false);
  const [isMobileResourcesOpen, setIsMobileResourcesOpen] = useState(false);
  const [isPlayMenuOpen, setIsPlayMenuOpen] = useState(false);
  const [isMobilePlayOpen, setIsMobilePlayOpen] = useState(false);
  const [pageBackdrop, setPageBackdrop] = useState<React.ReactNode>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, logout } = useAuth();

  const playLinks = [
    { name: 'Tournaments', href: '/tournaments', icon: TrophyIcon },
    { name: 'Ranked', href: '/ranked', icon: StarIcon },
    ...(isAuthenticated ? [
      { name: 'Games', href: '/games', icon: ChartBarIcon },
      { name: 'Flair Shop', href: '/shop', icon: SparklesIcon },
    ] : []),
  ];


  const resourceLinks = [
    { name: 'Calculator', href: '/calculator', icon: CalculatorIcon },
    { name: 'Penalties', href: '/penalties', icon: ScaleIcon },
    ...(isAuthenticated ? [
      { name: 'Discard quiz', href: '/discard-quiz', icon: QuestionMarkCircleIcon },
      { name: 'Discard quiz V2', href: '/decision-quiz', icon: QuestionMarkCircleIcon },
    ] : []),
    { name: 'Resources', href: '/resources', icon: BookOpenIcon },
  ];

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
    <PageBackdropContext.Provider value={setPageBackdrop}>
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Navigation */}
      {/* `relative z-20` gives nav its own stacking context, same reasoning as <main>'s `z-0`
          below: without it, nav's dropdown menus (z-50, further down) would compete at the
          document root against anything inside <main> that also escapes to the root — including
          fixed-position modals, which are plain DOM descendants of <main> (nothing in this app
          uses portals) and are therefore now contained within <main>'s stacking context by its
          z-0. Nav needs a higher root-level z-index than <main> so its dropdowns are guaranteed
          to stay on top of page content, deliberately rather than by incidental DOM order. */}
      <nav className="relative z-20 bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <Link to="/" className="text-2xl font-bold text-primary-600">
                  Charleston Riichi Mahjong
                </Link>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                {/* Events */}
                <Link
                  to="https://www.meetup.com/charleston-riichi-mahjong/events/"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                >
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  Events
                </Link>
                {/* Play Dropdown */}
                <div
                  className="relative inline-flex"
                  onMouseEnter={() => setIsPlayMenuOpen(true)}
                  onMouseLeave={() => setIsPlayMenuOpen(false)}
                >
                  <button
                    className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                      playLinks.some(item => isActive(item.href))
                        ? 'border-primary-500 text-gray-900'
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    }`}
                  >
                    <TrophyIcon className="h-4 w-4 mr-2" />
                    Play
                  </button>
                  {isPlayMenuOpen && (
                    <div className="absolute top-full left-0 mt-0 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
                      <div className="py-1">
                        {playLinks.map((item) => {
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
                {/* Store */}
                <Link
                  to="https://shop.printyourcause.com/campaigns/charleston-riichi-mahjong-club"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                >
                  <ShoppingBagIcon className="h-4 w-4 mr-2" />
                  Store
                </Link>
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
              {/* Events */}
              <Link
                to="https://www.meetup.com/charleston-riichi-mahjong/events/"
                target="_blank"
                rel="noreferrer"
                className="block pl-3 pr-4 py-2 border-l-4 border-transparent text-base font-medium text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <div className="flex items-center">
                  <CalendarIcon className="h-5 w-5 mr-3" />
                  Events
                </div>
              </Link>
              {/* Mobile Play Collapsible */}
              <div>
                <button
                  onClick={() => setIsMobilePlayOpen(!isMobilePlayOpen)}
                  className={`block w-full text-left pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
                    playLinks.some(item => isActive(item.href))
                      ? 'bg-primary-50 border-primary-500 text-primary-700'
                      : 'border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <TrophyIcon className="h-5 w-5 mr-3" />
                      Play
                    </div>
                    <span className="text-xs">{isMobilePlayOpen ? '−' : '+'}</span>
                  </div>
                </button>
                {isMobilePlayOpen && (
                  <div className="pl-6 space-y-1">
                    {playLinks.map((item) => {
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
                            setIsMobilePlayOpen(false);
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
              {/* Store */}
              <Link
                to="https://shop.printyourcause.com/campaigns/charleston-riichi-mahjong-club"
                target="_blank"
                rel="noreferrer"
                className="block pl-3 pr-4 py-2 border-l-4 border-transparent text-base font-medium text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <div className="flex items-center">
                  <ShoppingBagIcon className="h-5 w-5 mr-3" />
                  Store
                </div>
              </Link>
              {/* Mobile Learning Collapsible */}
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
                      Learning
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
              </div>
              {/* Mobile auth controls */}
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
      {/* `z-0` (alongside `relative`) is required, not decorative: it's what makes this element
          establish its own stacking context. Without it, a negative z-index descendant (e.g. the
          profile page's full-bleed backdrop layer) escapes past this element and paints behind
          the root div's own opaque bg-gray-50 background instead of behind this element's
          content, making it invisible. */}
      <main data-testid="layout-main" className="flex-1 max-w-7xl mx-auto py-6 sm:px-6 lg:px-8 w-full relative z-0">
        {pageBackdrop}
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
    </PageBackdropContext.Provider>
  );
};

export default Layout;
