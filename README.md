# Chat App

A modern, real-time group chat application built with Node.js, Socket.IO, and Prisma, featuring **anonymous mode**, typing indicators, user presence, and a WhatsApp-style double-check message status.

---

## Table of Contents

- [Features](#features)
- [Demo](#demo)  
- [Getting Started](#getting-started)
- [Usage](#usage)
- [Architecture Overview](#architecture-overview)
- [Technologies Used](#technologies-used)
- [Contributing](#contributing)
- [License](#license)

---

## Features

- **Anonymous Mode**: Toggle to send messages anonymously without revealing your username. Your anonymity persists even on page reloads.
- **Real-time Messaging**: Instant group chat powered by Socket.IO for low-latency communication.
- **Typing Indicator**: See when other users are typing, displayed at the bottom of the chat.
- **Double Check Marks**: Sent messages display a blue double check mark indicating delivery.
- **Persisted Message Status**: Messages retain anonymous status and user info, stored in a relational database via Prisma ORM.
- **Dark/Light Mode**: Toggle between light and dark themes seamlessly.
- **Responsive Design**: Mobile and desktop friendly.

---

## Getting Started

### Prerequisites

- Node.js >= 16.x
- npm or yarn
- PostgreSQL or your preferred database supported by Prisma

### Installation

1. Clone the repo:

   ```
   git clone https://github.com/yourusername/anonymous-chat.git
   cd chat-app
   ```

2. Install dependencies:

   ```
   npm install
   ```

3. Setup environment variables:

   Create a `.env` file in the root directory and configure as follows:

   ```
    DATABASE_URL="url"
    JWT_SECRET="secret"
    JWT_EXPIRES_IN="7d"
    PORT=3000
    NODE_ENV="development"
    CLIENT_URL="http://localhost:3000"
   ```

4. Run Prisma migrations to create the database schema:

   ```
   npx prisma migrate dev --name init
   ```

5. Start the server:

   ```
   npm start
   ```

6. Open your browser and navigate to:

   ```
   http://localhost:3000
   ```

---

## Usage

- **Authenticate**: Register or login to join the chat.
- **Anonymous mode**: Click the Incognito button to toggle anonymous messaging; messages sent will appear as “Anonymous” to others.
- **Chat**: Send messages, add emojis, and see who's typing in real-time.
- **Presence**: Online users have green indicator dots beside their names.
- **Message Status**: Your sent messages display blue double check marks reflecting delivery.
- **Theme toggle**: Use the toggle button in the header to switch themes.

---

## Architecture Overview

- **Frontend**:  
  - Vanilla JavaScript with modular structure.
  - Socket.IO client for WebSocket communication.
  - Dynamic UI updates for presence, typing, and messages.
  - State management for anonymous mode.

- **Backend**:  
  - Express.js server with Socket.IO for real-time events.
  - Prisma ORM managing PostgreSQL (or other supported DB).
  - REST API for auth and fetching chat/message data.
  - Socket event handlers for join/leave, messaging, typing, and presence across rooms.
  - Persistent `isAnonymous` flag per message to maintain user privacy.

---

## Technologies Used

- [Node.js](https://nodejs.org/)
- [Express](https://expressjs.com/)
- [Socket.IO](https://socket.io/)
- [Prisma ORM](https://www.prisma.io/)
- [PostgreSQL](https://www.postgresql.org/) (or any supported database)
- Vanilla JavaScript, HTML, CSS
- [Emoji Picker Element](https://github.com/nolanlawson/emoji-picker-element)
- FontAwesome icons


## License

Distributed under the MIT License. See `LICENSE` file for details.

---
