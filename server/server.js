const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const bcryptjs = require('bcryptjs');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// In-memory database
const db = {
  users: {},
  houseGroups: {},
  sessions: {},
};

// Middleware to validate token
const validateToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token || !db.sessions[token]) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.userId = db.sessions[token];
  next();
};

// Auth Endpoints
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    // Check if username exists
    const userExists = Object.values(db.users).find(
      (u) => u.username.toLowerCase() === username.toLowerCase()
    );

    if (userExists) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Validate password strength
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
      return res.status(400).json({
        error: 'Password must be at least 8 chars and include uppercase, lowercase, and a number.',
      });
    }

    const userId = uuidv4();
    const hashedPassword = await bcryptjs.hash(password, 10);

    db.users[userId] = {
      id: userId,
      username,
      password: hashedPassword,
      createdAt: new Date().toISOString(),
    };

    const token = uuidv4();
    db.sessions[token] = userId;

    res.status(201).json({
      user: { id: userId, username },
      token,
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const user = Object.values(db.users).find((u) => u.username.toLowerCase() === username.toLowerCase());

    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const passwordMatch = await bcryptjs.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = uuidv4();
    db.sessions[token] = user.id;

    res.json({
      user: { id: user.id, username: user.username },
      token,
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/logout', validateToken, (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) {
    delete db.sessions[token];
  }
  res.json({ success: true });
});

// House Group Endpoints
app.get('/api/houses', validateToken, (req, res) => {
  try {
    const userHouses = Object.values(db.houseGroups).filter(
      (house) => house.owner === req.userId || house.members.some((m) => m.userId === req.userId)
    );
    res.json(userHouses);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/houses', validateToken, (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'House name required' });
    }

    const user = db.users[req.userId];
    const houseId = uuidv4();

    db.houseGroups[houseId] = {
      id: houseId,
      name,
      owner: req.userId,
      ownerName: user.username,
      members: [{ userId: req.userId, username: user.username, joinedAt: new Date().toISOString() }],
      chores: [],
      inviteCode: null,
      createdAt: new Date().toISOString(),
    };

    res.status(201).json(db.houseGroups[houseId]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/houses/:houseId/invite', validateToken, (req, res) => {
  try {
    const house = db.houseGroups[req.params.houseId];
    if (!house || house.owner !== req.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    house.inviteCode = inviteCode;

    res.json({ inviteCode });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/houses/join', validateToken, (req, res) => {
  try {
    const { inviteCode } = req.body;
    if (!inviteCode) {
      return res.status(400).json({ error: 'Invite code required' });
    }

    const house = Object.values(db.houseGroups).find((h) => h.inviteCode === inviteCode);
    if (!house) {
      return res.status(404).json({ error: 'Invalid invite code' });
    }

    // Check if already a member
    if (house.members.some((m) => m.userId === req.userId)) {
      return res.status(400).json({ error: 'Already a member of this house' });
    }

    const user = db.users[req.userId];
    house.members.push({
      userId: req.userId,
      username: user.username,
      joinedAt: new Date().toISOString(),
    });

    res.json(house);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/houses/:houseId/members/:memberId', validateToken, (req, res) => {
  try {
    const house = db.houseGroups[req.params.houseId];
    if (!house || house.owner !== req.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const memberToRemove = house.members.find((m) => m.userId === req.params.memberId);
    if (memberToRemove.userId === house.owner) {
      return res.status(400).json({ error: 'Cannot remove house owner' });
    }

    house.members = house.members.filter((m) => m.userId !== req.params.memberId);

    // Remove chores assigned to this member
    house.chores = house.chores.filter((c) => c.assigneeId !== req.params.memberId);

    res.json(house);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Chore Endpoints
app.post('/api/houses/:houseId/chores', validateToken, (req, res) => {
  try {
    const house = db.houseGroups[req.params.houseId];
    if (!house || (!house.members.some((m) => m.userId === req.userId))) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { title, assigneeId, schedule, reminderTime, notificationEnabled } = req.body;
    if (!title || !assigneeId) {
      return res.status(400).json({ error: 'Title and assignee required' });
    }

    const chore = {
      id: uuidv4(),
      title,
      assigneeId,
      assigneeName: house.members.find((m) => m.userId === assigneeId)?.username,
      schedule,
      nextReminder: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      notificationEnabled,
      reminderTime,
      createdAt: new Date().toISOString(),
    };

    house.chores.push(chore);
    res.status(201).json(chore);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/houses/:houseId/chores/:choreId', validateToken, (req, res) => {
  try {
    const house = db.houseGroups[req.params.houseId];
    if (!house) {
      return res.status(404).json({ error: 'House not found' });
    }

    const chore = house.chores.find((c) => c.id === req.params.choreId);
    if (!chore) {
      return res.status(404).json({ error: 'Chore not found' });
    }

    // Only owner or assignee can delete
    if (house.owner !== req.userId && chore.assigneeId !== req.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    house.chores = house.chores.filter((c) => c.id !== req.params.choreId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Profile Endpoints
app.get('/api/profile', validateToken, (req, res) => {
  try {
    const user = db.users[req.userId];
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ id: user.id, username: user.username, createdAt: user.createdAt });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/profile', validateToken, async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = db.users[req.userId];

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if new username already exists (excluding self)
    if (username && username.toLowerCase() !== user.username.toLowerCase()) {
      const userExists = Object.values(db.users).find(
        (u) => u.username.toLowerCase() === username.toLowerCase() && u.id !== req.userId
      );
      if (userExists) {
        return res.status(400).json({ error: 'Username already taken' });
      }
    }

    if (username) {
      user.username = username;

      // Update username in all house groups
      Object.values(db.houseGroups).forEach((house) => {
        if (house.owner === req.userId) {
          house.ownerName = username;
        }
        house.members.forEach((member) => {
          if (member.userId === req.userId) {
            member.username = username;
          }
        });
        house.chores.forEach((chore) => {
          if (chore.assigneeId === req.userId) {
            chore.assigneeName = username;
          }
        });
      });
    }

    if (password) {
      if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
        return res.status(400).json({
          error: 'Password must be at least 8 chars and include uppercase, lowercase, and a number.',
        });
      }
      user.password = await bcryptjs.hash(password, 10);
    }

    res.json({ id: user.id, username: user.username });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Roomie Rhythm server running on http://localhost:${PORT}`);
});
