# Mahjong Club Website

A web application for tracking and recording mahjong games. Users can create accounts and submit completed games between 4 players with their scores.

## Features

- User authentication (register/login)
- Submit completed mahjong games with 4 players
- View game history and statistics
- User profiles with game statistics
- Game verification system

## Tech Stack

- **Backend**: Node.js, Express, MongoDB, Mongoose
- **Frontend**: React, TypeScript, Tailwind CSS
- **Authentication**: JWT tokens

## Setup Instructions

### Prerequisites

- Node.js (v14 or higher)
- MongoDB (running locally or connection string)
- npm or yarn

### Backend Setup

1. Navigate to the server directory:
```bash
cd server
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file from the example:
```bash
cp env.example .env
```

4. Update `.env` with your configuration:
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/mahjong-club
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRE=7d
```

5. Start the server:
```bash
npm run dev
```

The server will run on `http://localhost:5000`

### Frontend Setup

1. Navigate to the client directory:
```bash
cd client
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file from the example:
```bash
cp env.example .env
```

4. Update `.env` with your API URL:
```env
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_ENV=development
```

5. Start the development server:
```bash
npm start
```

The client will run on `http://localhost:3000`

## Project Structure

```
new-mahjong-site/
├── server/
│   ├── src/
│   │   ├── models/          # MongoDB models (User, Game)
│   │   ├── routes/          # API routes (auth, games, users)
│   │   ├── middleware/      # Auth, validation, error handling
│   │   └── server.js        # Express server setup
│   ├── package.json
│   └── env.example
├── client/
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── contexts/        # Auth context
│   │   ├── hooks/           # Custom React hooks
│   │   ├── pages/           # Page components
│   │   ├── services/        # API service layer
│   │   └── App.tsx          # Main app component
│   ├── package.json
│   └── env.example
└── README.md
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/refresh-token` - Refresh JWT token

### Users
- `GET /api/users/profile` - Get current user profile
- `PUT /api/users/profile` - Update user profile
- `GET /api/users/search` - Search users by name
- `GET /api/users/:id` - Get user by ID
- `GET /api/users/:id/games` - Get games for a user

### Games
- `GET /api/games` - Get all games (paginated)
- `POST /api/games` - Create a new game
- `GET /api/games/:id` - Get game by ID
- `PUT /api/games/:id/verify` - Verify a game
- `DELETE /api/games/:id` - Delete a game

## Usage

1. Start MongoDB if running locally
2. Start the backend server (`cd server && npm run dev`)
3. Start the frontend client (`cd client && npm start`)
4. Open `http://localhost:3000` in your browser
5. Register a new account or login
6. Submit games using the "Submit Game" page

## Development

- Backend uses nodemon for auto-reload during development
- Frontend uses React's hot-reload feature
- Both use environment variables for configuration

## License

MIT
