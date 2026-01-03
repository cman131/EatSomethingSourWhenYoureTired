const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Types
export interface Notification {
  _id: string;
  name: string;
  description: string;
  type: 'Game' | 'Comment' | 'Other';
  url?: string;
  viewed: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface NotificationPreferences {
  emailNotificationsEnabled?: boolean;
  emailNotificationsForComments?: boolean;
  emailNotificationsForNewGames?: boolean;
  emailNotificationsForNewTournaments?: boolean;
  emailNotificationsForRoundPairings?: boolean;
}

export interface User {
  _id: string;
  email: string;
  displayName: string;
  avatar: string;
  realName?: string;
  discordName?: string;
  mahjongSoulName?: string;
  favoriteYaku?: string | null;
  favoriteTile?: Tile | null;
  clubAffiliation?: 'Charleston' | 'Charlotte' | 'Washington D.C.';
  notifications?: Notification[];
  notificationPreferences?: NotificationPreferences;
  isAdmin?: boolean;
  privateMode?: boolean;
}

export interface GamePlayer {
  player: User;
  score: number;
  position: number;
}

export interface GameComment {
  _id?: string;
  comment: string;
  commenter: User;
  createdAt: string;
}

export interface Game {
  _id: string;
  submittedBy: User;
  players: GamePlayer[];
  gameDate: string;
  notes?: string;
  pointsLeftOnTable?: number;
  isEastOnly?: boolean;
  verified: boolean;
  verifiedBy?: User;
  verifiedAt?: string;
  comments?: GameComment[];
  createdAt: string;
  updatedAt: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: {
    items: T[];
    pagination: PaginationData;
  };
}

export interface PaginationData {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface UserStats {
  gamesWon: number;
  gamesVerified: number;
  gamesSubmitted: number;
  gamesPlayed: number;
  averageScore: number;
  highestScore: number;
  lowestScore: number;
  quizzesRespondedTo: number;
  commentsMade: number;
}

export interface AchievementRequirement {
  type: string;
  comparisonType: string;
  requirementsValue: number;
  isGrand?: boolean;
}

export interface Achievement {
  _id: string;
  name: string;
  description: string;
  icon: string;
  requirements: AchievementRequirement[];
  createdAt?: string;
  updatedAt?: string;
}

export interface UserAchievement {
  achievement: Achievement;
  earned: boolean;
  requirementResults?: Array<{
    requirement: AchievementRequirement;
    met: boolean;
  }>;
  userStats?: Partial<UserStats>;
}

export interface DiscardQuiz {
  id: string;
  hand: Tile[];
  doraIndicator: Tile;
  seat: 'E' | 'S' | 'W' | 'N';
  roundWind: 'E' | 'S';
  responses: Record<string, string[]>;
  createdAt?: string;
  updatedAt?: string;
}

export interface Tile {
  _id: string;
  id: string;
  name: string;
  suit: 'Man' | 'Sou' | 'Pin' | 'Wind' | 'Dragon';
}

export interface TournamentPlayer {
  player: User;
  uma: number;
  dropped: boolean;
}

export interface TournamentAddress {
  streetAddress: string;
  addressLine2?: string;
  city: string;
  state: string;
  zipCode: string;
}

export interface Tournament {
  _id: string;
  name: string;
  description?: string;
  date: string;
  location: TournamentAddress;
  isEastOnly: boolean;
  status: 'NotStarted' | 'InProgress' | 'Completed' | 'Cancelled';
  players: TournamentPlayer[];
  rounds?: any[];
  createdAt?: string;
  updatedAt?: string;
}

// Yaku list matching server-side enum
export const YAKU_LIST = [
  'Riichi',
  'All Simples',
  'Fully Concealed Hand',
  'Yakuhai Seat Wind',
  'Yakuhai Prevalent Wind',
  'Yakuhai Dragons',
  'Pinfu',
  'Pure Double Sequence',
  'Robbing a Kan',
  'After a Kan',
  'Under the Sea',
  'Under the River',
  'Ippatsu',
  'Double Riichi',
  'Mixed Triple Triplets',
  'Three Quads',
  'All Triplets',
  'Three Concealed Triplets',
  'Little Three Dragons',
  'All Terminals and Honors',
  'Seven Pairs',
  'Half Outside Hand',
  'Pure Straight',
  'Mixed Triple Sequence',
  'Half Flush',
  'Twice Pure Double Sequence',
  'Full Outside Hand',
  'Mangan at Draw',
  'Full Flush',
  'Counted Yakuman',
  'All Terminals',
  'Thirteen Orphans',
  'Little Four Winds',
  'Four Quads',
  'Nine Gates',
  'Blessing of Heaven',
  'Blessing of Earth',
  'Big Three Dragons',
  'Four Concealed Triplets',
  'All Honors',
  'All Green',
  'Four Concealed Triplets Single Wait',
  'Thirteen Orphans 13-Way Wait',
  'True Nine Gates',
  'Big Four Winds',
];

// Helper function to get auth token
const getAuthToken = (): string | null => {
  return localStorage.getItem('authToken');
};

// Helper function to make API requests
const apiRequest = async <T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> => {
  const token = getAuthToken();
  
  const config: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
    ...options,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
  
  if (!response.ok) {
    // Handle 401 Unauthorized - redirect to login
    if (response.status === 401) {
      // Don't redirect if we're already on the login page
      if (window.location.pathname === '/login') {
        // Already on login page, don't redirect
        throw new Error('Unauthorized');
      }
      const currentPath = window.location.pathname + window.location.search;
      const loginUrl = `/login?redirect=${encodeURIComponent(currentPath)}`;
      window.location.href = loginUrl;
      // Throw error to stop execution
      throw new Error('Unauthorized - redirecting to login');
    }
    
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
  }

  return response.json();
};

// Authentication API
export const authApi = {
  register: async (userData: {
    email: string;
    displayName: string;
    password: string;
    realName?: string;
    discordName?: string;
    mahjongSoulName?: string;
    clubAffiliation?: 'Charleston' | 'Charlotte' | 'Washington D.C.';
  }) => {
    return apiRequest<ApiResponse<{ user: User; token: string }>>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },

  login: async (credentials: { email: string; password: string }) => {
    return apiRequest<ApiResponse<{ user: User; token: string }>>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  },

  refreshToken: async () => {
    return apiRequest<ApiResponse<{ token: string }>>('/auth/refresh-token', {
      method: 'POST',
    });
  },

  forgotPassword: async (email: string) => {
    return apiRequest<ApiResponse<{ message: string }>>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  resetPassword: async (token: string, password: string) => {
    return apiRequest<ApiResponse<{ user: User; token: string }>>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
  },
};

// Users API
export const usersApi = {
  getUsers: async (page = 1, limit = 20) => {
    return apiRequest<PaginatedResponse<User>>(`/users?page=${page}&limit=${limit}`);
  },

  getProfile: async () => {
    return apiRequest<ApiResponse<{ user: User }>>('/users/profile');
  },

  updateProfile: async (userData: Partial<User>) => {
    return apiRequest<ApiResponse<{ user: User }>>('/users/profile', {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  },

  getUser: async (userId: string) => {
    return apiRequest<ApiResponse<{ user: User }>>(`/users/${userId}`);
  },

  getUserGames: async (userId: string, page = 1, limit = 10) => {
    return apiRequest<PaginatedResponse<Game>>(`/users/${userId}/games?page=${page}&limit=${limit}`);
  },

  getUserStats: async (userId: string) => {
    return apiRequest<ApiResponse<{ stats: UserStats }>>(`/users/${userId}/stats`);
  },

  searchUsers: async (query: string, limit = 10) => {
    return apiRequest<ApiResponse<{ users: User[] }>>(`/users/search?q=${encodeURIComponent(query)}&limit=${limit}`);
  },

  updateNotificationPreferences: async (preferences: NotificationPreferences) => {
    return apiRequest<ApiResponse<{ user: User }>>('/users/notification-preferences', {
      method: 'PUT',
      body: JSON.stringify(preferences),
    });
  },
};

// Notifications API
export const notificationsApi = {
  getNotifications: async () => {
    return apiRequest<ApiResponse<{ notifications: Notification[] }>>('/users/notifications');
  },

  markAsViewed: async (notificationId: string) => {
    return apiRequest<ApiResponse<{ user: User }>>(`/users/notifications/${notificationId}/view`, {
      method: 'PUT',
    });
  },

  markAllAsViewed: async () => {
    return apiRequest<ApiResponse<{ user: User }>>('/users/notifications/view-all', {
      method: 'PUT',
    });
  },

  deleteNotification: async (notificationId: string) => {
    return apiRequest<ApiResponse<{ user: User }>>(`/users/notifications/${notificationId}`, {
      method: 'DELETE',
    });
  },

  clearAllNotifications: async () => {
    return apiRequest<ApiResponse<{ user: User }>>('/users/notifications', {
      method: 'DELETE',
    });
  },
};

// Games API
export const gamesApi = {
  getGames: async (page = 1, limit = 20) => {
    return apiRequest<PaginatedResponse<Game>>(`/games?page=${page}&limit=${limit}`);
  },

  createGame: async (gameData: {
    players: Array<{ player: string; score: number; position: number }>;
    gameDate?: Date;
    notes?: string;
    pointsLeftOnTable?: number;
    isEastOnly?: boolean;
  }) => {
    return apiRequest<ApiResponse<{ game: Game }>>('/games', {
      method: 'POST',
      body: JSON.stringify(gameData),
    });
  },

  getGame: async (gameId: string) => {
    return apiRequest<ApiResponse<{ game: Game }>>(`/games/${gameId}`);
  },

  verifyGame: async (gameId: string) => {
    return apiRequest<ApiResponse<{ game: Game }>>(`/games/${gameId}/verify`, {
      method: 'PUT',
    });
  },

  deleteGame: async (gameId: string) => {
    return apiRequest<ApiResponse<null>>(`/games/${gameId}`, {
      method: 'DELETE',
    });
  },

  addComment: async (gameId: string, comment: string) => {
    return apiRequest<ApiResponse<{ game: Game }>>(`/games/${gameId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ comment }),
    });
  },
};

// Tiles API
export const tilesApi = {
  getTiles: async () => {
    return apiRequest<ApiResponse<{ tiles: Tile[] }>>('/tiles');
  },
};

// Discard Quizzes API
export const discardQuizzesApi = {
  getQuiz: async (quizId: string) => {
    return apiRequest<ApiResponse<{ quiz: DiscardQuiz }>>(`/discard-quizzes/${quizId}`);
  },

  generateRandomQuiz: async () => {
    return apiRequest<ApiResponse<{ quiz: DiscardQuiz }>>('/discard-quizzes/generate/random');
  },

  submitResponse: async (quizId: string, tileId: string) => {
    return apiRequest<ApiResponse<{ quiz: DiscardQuiz }>>(`/discard-quizzes/${quizId}/response`, {
      method: 'PUT',
      body: JSON.stringify({ tileId }),
    });
  },
};

// Achievements API
export const achievementsApi = {
  getAchievements: async (page = 1, limit = 20) => {
    return apiRequest<PaginatedResponse<Achievement>>(`/achievements?page=${page}&limit=${limit}`);
  },

  getUserAchievements: async (userId: string) => {
    return apiRequest<ApiResponse<{
      achievements: UserAchievement[];
      earned: UserAchievement[];
      unearned: UserAchievement[];
      summary: {
        total: number;
        earned: number;
        unearned: number;
      };
    }>>(`/achievements/user/${userId}`);
  },

  getGrandAchievementHolder: async (achievementIdentifier: string) => {
    return apiRequest<ApiResponse<{
      achievement: Achievement;
      isGrand: boolean;
      users: Array<{
        user: User;
        value: number;
        stats: Partial<UserStats>;
      }>;
      targetValue?: number;
      requirementType?: string;
      count: number;
      message?: string;
    }>>(`/achievements/grand/${achievementIdentifier}`);
  },
};

// Tournaments API
export const tournamentsApi = {
  getTournaments: async (page = 1, limit = 20) => {
    return apiRequest<PaginatedResponse<Tournament>>(`/tournaments?page=${page}&limit=${limit}`);
  },

  getTournament: async (tournamentId: string) => {
    return apiRequest<ApiResponse<{ tournament: Tournament }>>(`/tournaments/${tournamentId}`);
  },

  createTournament: async (tournamentData: {
    name: string;
    description?: string;
    date: Date;
    location: TournamentAddress;
  }) => {
    return apiRequest<ApiResponse<{ tournament: Tournament }>>('/tournaments/admin', {
      method: 'POST',
      body: JSON.stringify(tournamentData),
    });
  },

  signup: async (tournamentId: string) => {
    return apiRequest<ApiResponse<{ tournament: Tournament }>>(`/tournaments/${tournamentId}/signup`, {
      method: 'POST',
    });
  },

  drop: async (tournamentId: string) => {
    return apiRequest<ApiResponse<{ tournament: Tournament }>>(`/tournaments/${tournamentId}/drop`, {
      method: 'PUT',
    });
  },

  startTournament: async (tournamentId: string) => {
    return apiRequest<ApiResponse<{ tournament: Tournament }>>(`/tournaments/admin/${tournamentId}/start`, {
      method: 'PUT',
    });
  },

  endRound: async (tournamentId: string, roundNumber: number) => {
    return apiRequest<ApiResponse<{ tournament: Tournament }>>(`/tournaments/admin/${tournamentId}/rounds/${roundNumber}/end`, {
      method: 'PUT',
    });
  },

  submitTournamentGame: async (
    tournamentId: string,
    gameData: {
      players: Array<{ player: string; score: number; position: number }>;
      notes?: string;
      pointsLeftOnTable?: number;
      ranOutOfTime?: boolean;
      roundNumber: number;
      pairingIndex?: number;
    }
  ) => {
    return apiRequest<ApiResponse<{ game: Game; tournament: Tournament }>>(
      `/tournaments/${tournamentId}/games`,
      {
        method: 'POST',
        body: JSON.stringify(gameData),
      }
    );
  },
};

// Health check
export const healthApi = {
  check: async () => {
    return apiRequest<{ status: string; timestamp: string; uptime: number }>('/health');
  },
};

