require('dotenv').config()
const express = require('express')
const { createServer } = require('http')
const { Server } = require('socket.io')

const app = express()
const httpServer = createServer(app)

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    credentials: true,
  },
  transports: ['polling', 'websocket'],
})

const rooms = new Map()

function generateRoomCode() {
  let code
  do {
    code = Math.random().toString(36).substring(2, 8).toUpperCase()
  } while (rooms.has(code))
  return code
}

io.on('connection', (socket) => {
  console.log('🔌 Client connected:', socket.id)

  socket.on('create-room', ({ hostName }, callback) => {
    const roomCode = generateRoomCode()
    const room = {
      code: roomCode,
      hostId: socket.id,
      hostName,
      participants: new Map([[socket.id, hostName]]),
      players: [],
      teams: {
        red: { name: 'EQUIPE 1', score: 0, members: [] },
        blue: { name: 'EQUIPE 2', score: 0, members: [] },
      },
      allTeams: [],
      createdAt: Date.now(),
    }

    rooms.set(roomCode, room)
    socket.join(roomCode)
    console.log(`🎮 Room created: ${roomCode} by ${hostName}`)

    callback({
      success: true,
      roomCode,
      isHost: true,
    })
  })

  socket.on('join-room', ({ roomCode, participantName }, callback) => {
    const room = rooms.get(roomCode)

    if (!room) {
      callback({ success: false, error: 'Sala não encontrada' })
      return
    }

    socket.join(roomCode)
    room.participants.set(socket.id, participantName)
    console.log(`👤 ${participantName} joined room ${roomCode}`)

    callback({
      success: true,
      isHost: false,
      room: {
        code: room.code,
        hostName: room.hostName,
        participants: Array.from(room.participants.entries()).map(
          ([id, name]) => ({ id, name }),
        ),
        players: room.players,
        teams: room.teams,
        allTeams: room.allTeams,
      },
    })

    io.to(roomCode).emit('participant-joined', {
      participants: Array.from(room.participants.entries()).map(
        ([id, name]) => ({ id, name }),
      ),
    })
  })

  socket.on('sync-players', ({ roomCode, players }) => {
    const room = rooms.get(roomCode)
    if (room && room.hostId === socket.id) {
      room.players = players
      socket.to(roomCode).emit('players-updated', { players })
    }
  })

  socket.on('sync-teams', ({ roomCode, teams, allTeams }) => {
    const room = rooms.get(roomCode)
    if (room && room.hostId === socket.id) {
      room.teams = teams
      room.allTeams = allTeams
      socket.to(roomCode).emit('teams-updated', { teams, allTeams })
    }
  })

  socket.on('sync-score', ({ roomCode, color, score }) => {
    const room = rooms.get(roomCode)
    if (room) {
      room.teams[color].score = score
      socket.to(roomCode).emit('score-updated', { color, score })
    }
  })

  socket.on('sync-reset-scores', ({ roomCode }) => {
    const room = rooms.get(roomCode)
    if (room && room.hostId === socket.id) {
      room.teams.red.score = 0
      room.teams.blue.score = 0
      socket.to(roomCode).emit('scores-reset')
    }
  })

  socket.on('disconnect', () => {
    console.log('🔌 Client disconnected:', socket.id)

    rooms.forEach((room, code) => {
      if (room.hostId === socket.id) {
        console.log(`🗑️  Room closed: ${code}`)
        io.to(code).emit('room-closed', {
          message: 'O host encerrou a sessão',
        })
        rooms.delete(code)
      } else if (room.participants.has(socket.id)) {
        const name = room.participants.get(socket.id)
        room.participants.delete(socket.id)
        console.log(`👋 ${name} left room ${code}`)

        io.to(code).emit('participant-left', {
          participants: Array.from(room.participants.entries()).map(
            ([id, name]) => ({ id, name }),
          ),
        })
      }
    })
  })
})

// Limpar salas antigas (mais de 24 horas)
setInterval(
  () => {
    const now = Date.now()
    const dayInMs = 24 * 60 * 60 * 1000

    rooms.forEach((room, code) => {
      if (now - room.createdAt > dayInMs) {
        console.log(`🗑️  Cleaning old room: ${code}`)
        io.to(code).emit('room-closed', {
          message: 'Sala expirou (24h)',
        })
        rooms.delete(code)
      }
    })
  },
  60 * 60 * 1000,
)

const PORT = process.env.SOCKET_PORT || 5152

httpServer.listen(PORT, () => {
  console.log(`✅ Socket.IO server running on port ${PORT}`)
})
