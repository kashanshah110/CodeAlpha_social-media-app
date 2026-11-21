# Socially

Socially is a small social app built with semantic HTML, CSS, vanilla JavaScript, Express, and MongoDB/Mongoose. It is intended as a learning project: the browser UI is a single page with hash-based views, and the API is served by the same Express server.

## Features

- Register, log in, and log out
- Edit a username, bio, and HTTPS profile-image URL
- Create, read, edit, and delete text posts
- Comment on posts and edit or delete your own comments
- Like and unlike posts
- Follow and unfollow users
- View profiles, posts, follower lists, and following lists
- Explore users by username

## Requirements

- Node.js 20.19 or newer
- MongoDB, either a local instance or a hosted deployment

## Setup

Open PowerShell in the project folder. The server reads its environment from `server/.env`. A safe template is provided in `server/.env.example`.

If you do not already have `server/.env`, copy the template:

```powershell
Copy-Item .\server\.env.example .\server\.env
```

If `server/.env` already exists, keep it and add or update the values below; do not overwrite your MongoDB connection string.

Set these variables in `server/.env`:

```dotenv
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/socially
SESSION_SECRET=replace-with-a-random-secret
```

`MONGODB_URI` must point to a database you can access. Generate a strong session secret locally with:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Copy the generated value into `SESSION_SECRET`. Do not put either secret in frontend code or share the contents of `.env`. The real `server/.env` and `server/node_modules/` are ignored by Git.

The value in `.env.example` is only a placeholder and is too short to start the server; replace it with the generated value.

Install server dependencies once, then start the app:

```powershell
cd .\server
npm install
npm start
```

Open [http://localhost:5000](http://localhost:5000). The API health check is at `/api/health`. Keep the terminal running while you use the site.

Run the model tests from the project folder:

```powershell
npm --prefix .\server test
```

The tests validate the Mongoose schemas and do not need a database connection.

## Main pages

- `#/feed` — latest posts and the post composer
- `#/explore` — find people by username
- `#/profile/username` — profile, posts, followers, and following
- `#/post/postId` — a post and its comments
- `#/login` and `#/register` — authentication

The home page is `/`; the page views are selected by the URL hash so Express can serve the same frontend entry point.

## API overview

All API responses are JSON. Protected endpoints use the HttpOnly `socially_session` cookie set when a user registers or logs in.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Create an account |
| `POST` | `/api/auth/login` | Log in |
| `GET` | `/api/auth/me` | Get the current user, or `null` |
| `POST` | `/api/auth/logout` | Log out and revoke existing sessions |
| `GET` | `/api/posts` | List newest posts |
| `POST` | `/api/posts` | Create a post |
| `GET`, `PATCH`, `DELETE` | `/api/posts/:postId` | Read or manage a post |
| `GET`, `POST` | `/api/posts/:postId/comments` | List or add comments |
| `PATCH`, `DELETE` | `/api/comments/:commentId` | Edit or delete your own comment |
| `POST`, `DELETE` | `/api/posts/:postId/like` | Like or unlike a post |
| `GET` | `/api/users/:username` | View a profile and its posts |
| `PATCH` | `/api/users/me` | Update your own profile |
| `GET` | `/api/users?search=name` | Search usernames |
| `GET` | `/api/users/:username/followers` | List followers |
| `GET` | `/api/users/:username/following` | List followed users |
| `POST`, `DELETE` | `/api/users/:userId/follow` | Follow or unfollow a user |

## Learning and security notes

- Passwords are hashed with Node.js `scrypt`; the plain-text password is never stored.
- Session cookies are `HttpOnly` and `SameSite=Lax`. The `Secure` cookie flag is enabled when `NODE_ENV=production`; production deployments must use HTTPS.
- Mongoose schemas and the API validate input. Unique database indexes prevent duplicate usernames, emails, likes, and follows.
- The frontend escapes user-generated text before rendering it. Profile images must use HTTPS URLs.
- This is a learning app, not a production-ready social network. It does not include login rate limiting, email verification, account recovery, or uploaded image storage. Add those protections before using it with real users.
