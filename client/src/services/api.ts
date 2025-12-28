const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Types
export interface User {
  _id: string;
  email: string;
  username: string;
  avatar: string;
}

export interface GamePlayer {
  player: User;
  score: number;
  position: number;
}

export interface Game {
  _id: string;
  submittedBy: User;
  players: GamePlayer[];
  gameDate: string;
  notes?: string;
  verified: boolean;
  verifiedBy?: User;
  verifiedAt?: string;
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
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
  }

  return response.json();
};

// Authentication API
export const authApi = {
  register: async (userData: {
    email: string;
    username: string;
    password: string;
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
};

// Users API
export const usersApi = {
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

  searchUsers: async (query: string, limit = 10) => {
    return apiRequest<ApiResponse<{ users: User[] }>>(`/users/search?q=${encodeURIComponent(query)}&limit=${limit}`);
  },
};

// Games API
export const gamesApi = {
  getGames: async (page = 1, limit = 20) => {
    return apiRequest<PaginatedResponse<Game>>(`/games?page=${page}&limit=${limit}`);
  },

  createGame: async (gameData: {
    players: Array<{ player: string; score: number; position: number }>;
    gameDate?: string;
    notes?: string;
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
};

// Health check
export const healthApi = {
  check: async () => {
    return apiRequest<{ status: string; timestamp: string; uptime: number }>('/health');
  },
};

