const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs').promises; 
const crypto = require('crypto');

const app = express();
const PORT = 3000;
const DATA_FILE = 'users.json';

// --- Middlewares ---
app.use(cors()); 
app.use(bodyParser.json());

// --- Helper Functions ---

const hashPassword = (password) => {
    return crypto.createHash('sha256').update(password).digest('hex');
};

const loadUsers = async () => {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        // If file doesn't exist or is invalid, return an empty array
        return [];
    }
};

const saveUsers = async (users) => {
    await fs.writeFile(DATA_FILE, JSON.stringify(users, null, 2), 'utf-8');
};

// --- API Routes ---

/**
 * API: /api/register
 * Description: Registers a new user and initializes their profile data.
 */
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Username and password are required.' });
    }

    const users = await loadUsers();
    
    // Check if user already exists
    if (users.find(u => u.username === username)) {
        return res.status(409).json({ success: false, message: 'Username already taken.' });
    }

    // Create new user record with initial profile structure
    const newUser = {
        id: Date.now(),
        username: username, // 原始登录名
        passwordHash: hashPassword(password),
        createdAt: new Date().toISOString(),
        profile: {
            name: username, // 初始展示名与原始登录名相同
            handle: '@' + username.replace(/\s+/g, '').toLowerCase(),
            bio: '',
            location: '',
            profession: '',
            gender: '',
            hobbies: '',
            birthday: '', 
            posts: Math.floor(Math.random() * 50), 
            followers: Math.floor(Math.random() * 1000),
            following: Math.floor(Math.random() * 500),
            avatarUrl: ''
        }
    };
    
    users.push(newUser);
    await saveUsers(users);

    console.log(`User registered: ${username}`);
    res.json({ success: true, message: 'Registration successful.' });
});

/**
 * API: /api/login
 * Description: Logs a user in, supporting both original username and profile name.
 */
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body; // username 是用户在登录框中输入的值

    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Username and password are required.' });
    }

    const users = await loadUsers();
    
    // 关键修改: 查找用户时，允许使用原始 username 或 profile.name
    const user = users.find(u => 
        u.username === username || (u.profile && u.profile.name === username)
    );

    if (user && user.passwordHash === hashPassword(password)) {
        // 增加详细提示，显示用户是通过哪个名字登录的
        console.log(`User logged in successfully.`);
        console.log(`   - Input Identifier: ${username}`);
        console.log(`   - User Identity: (Original Name: ${user.username}, Display Name: ${user.profile ? user.profile.name : 'N/A'})`);
        console.log(`------------------------------------------`);
        
        // 成功登录后，始终返回原始的 username 作为会话标识，profile.html 需要它来获取数据
        return res.json({ 
            success: true, 
            message: 'Login successful.', 
            user: { 
                username: user.username, // 返回原始的 username
                profile: user.profile 
            } 
        });
    } else {
        console.log(`Login failed for input: ${username}. User not found or password incorrect.`);
        return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }
});

/**
 * API: /api/profile/get
 * Description: Fetches a user's current profile data.
 */
app.get('/api/profile/get', async (req, res) => {
    const { username } = req.query; 

    if (!username) {
        return res.status(400).json({ success: false, message: 'Username is required.' });
    }

    const users = await loadUsers();
    const user = users.find(u => u.username === username);

    if (user) {
        return res.json({ success: true, profile: user.profile });
    } else {
        return res.status(404).json({ success: false, message: 'User not found.' });
    }
});


/**
 * API: /api/profile/update
 * Description: Updates specified fields of a user's profile data.
 */
app.post('/api/profile/update', async (req, res) => {
    const { username, updates } = req.body; 

    if (!username || !updates) {
        return res.status(400).json({ success: false, message: 'Username and update data are required.' });
    }

    const users = await loadUsers();
    const userIndex = users.findIndex(u => u.username === username);

    if (userIndex === -1) {
        return res.status(404).json({ success: false, message: 'User not found.' });
    }
    
    // 获取旧的显示名，用于提示
    const oldName = users[userIndex].profile ? users[userIndex].profile.name : 'N/A';
    
    // Merge existing profile data with new updates
    users[userIndex].profile = {
        ...users[userIndex].profile,
        ...updates
    };

    await saveUsers(users);

    // 增加详细的服务器提示 (满足用户要求)
    console.log(`>>> PROFILE UPDATE RECEIVED AND SAVED <<<`);
    console.log(`   - Target Username: ${username}`);
    console.log(`   - Name Changed From: ${oldName} to ${users[userIndex].profile.name}`);
    console.log(`   - Location: ${updates.location || 'N/A'}`);
    console.log(`   - Bio Length: ${updates.bio ? updates.bio.length : 0} characters`);
    console.log(`------------------------------------------`);
    
    res.json({ success: true, message: 'Profile updated successfully.' });
});

// Route to serve static files (e.g., your HTML files)
app.use(express.static(__dirname)); 

// --- Server Startup ---
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`You can access your website at http://localhost:${PORT}/poSter_beta_v0.4.html`);
});
