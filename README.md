# RPG Life

Proyecto fullstack: frontend React + backend Node/Express + MongoDB.

## Estructura
- backend/: servidor Express
- frontend/: React app

## Requisitos
- Node.js 16+
- MongoDB (local o Atlas)

## Quickstart (local)
1. Backend:
   cd backend
   npm install
   MONGO_URI=mongodb://localhost:27017/rpg_life node server.js

2. Frontend:
   cd frontend
   npm install
   npm start

## Endpoints clave
- GET /api/user/:id
- POST /api/user/:id/xp
- POST /api/user/:id/gym
- POST /api/user/:id/events
- GET /api/user/:id/events

## Notas para Antigravity
- Ajustar variables de entorno (MONGO_URI, PORT).
- Mejorar validaciones y auth (JWT) para producción.
- Añadir tests automáticos (jest / supertest) si lo desean.
