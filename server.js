const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// 初始化 Socket.IO 服务器
// { connectionStateRecovery: {} } 可以在生产环境中用于连接状态恢复，这里简化设置为默认
const io = new Server(server, {
    cors: {
        origin: "*", // 允许所有来源，在生产环境应限制为您的域名
        methods: ["GET", "POST"]
    }
});

const PORT = 3000;

// ------------------ 用户状态管理 ------------------

/**
 * 存储在线用户及其 Socket ID 的映射。
 * { 'username': 'socket.id', ... }
 */
const users = {}; 

/**
 * 返回当前所有在线用户的用户名列表。
 * @returns {Array<string>} 用户名数组
 */
function getOnlineUsernames() {
    return Object.keys(users);
}

/**
 * 广播最新的在线用户列表给所有连接的客户端。
 */
function broadcastOnlineUsers() {
    io.emit('online users', getOnlineUsernames());
}

// ------------------ Express 设置 ------------------

// 托管 index.html 和其他静态文件（如 /socket.io/socket.io.js）
app.get('/', (req, res) => {
    // 假设您的 index.html 就在应用根目录
    res.sendFile(__dirname + '/index.html');
});

// ------------------ Socket.IO 连接逻辑 ------------------

io.on('connection', (socket) => {
    console.log(`[Connect] Socket ID: ${socket.id}`);

    // [1] 客户端发送 'new user' 事件，进行登录和用户状态记录
    socket.on('new user', (username) => {
        // 确保用户名不为空，并且当前用户名未被占用
        if (!username || users[username]) {
            console.log(`[Login Reject] User ${username} already connected or invalid.`);
            // 可以选择断开连接或发送错误消息
            socket.emit('system message', { text: '⚠️ 昵称已被占用或无效，请重新登录。' });
            return;
        }

        // 记录用户名和 Socket ID
        users[username] = socket.id;
        socket.username = username; // 将用户名附加到 socket 对象上，方便后续使用

        console.log(`[Login Accept] User ${username} logged in.`);
        
        // 广播用户上线消息给所有客户端 (包括发送者自己)
        io.emit('user connected', username); 
        
        // 广播更新后的在线用户列表
        broadcastOnlineUsers();
    });

    // [2] 客户端发送 'public message' 事件 (公共聊天)
    socket.on('public message', (msgData) => {
        // 检查用户是否已登录 (是否有 socket.username)
        if (!socket.username) return; 

        const messagePayload = {
            user: socket.username,
            text: msgData.text,
            timestamp: new Date().toISOString(),
            isPrivate: false
        };

        // 广播给所有客户端 (包括发送者)
        io.emit('public message', messagePayload);
        console.log(`[Public Msg] ${socket.username}: ${msgData.text}`);
    });

    // [3] 客户端发送 'private message' 事件 (私聊)
    socket.on('private message', (msgData) => {
        // 检查用户是否已登录
        if (!socket.username) return; 

        const sender = socket.username;
        const recipient = msgData.recipient;
        const recipientSocketId = users[recipient];

        // 检查接收者是否存在且在线
        if (recipientSocketId && recipientSocketId !== socket.id) {
            const messagePayload = {
                user: sender,
                text: msgData.text,
                timestamp: new Date().toISOString(),
                isPrivate: true,
                recipient: recipient // 告诉发送者和接收者，私聊的另一方是谁
            };

            // 1. 发送给接收者
            io.to(recipientSocketId).emit('private message', messagePayload);

            // 2. 发送回给发送者，以便在发送者的聊天窗口显示
            socket.emit('private message', messagePayload);

            console.log(`[Private Msg] ${sender} -> ${recipient}: ${msgData.text}`);

        } else {
            // 接收者不在线或尝试给自己私聊
            const errorText = (recipientSocketId === socket.id) ? 
                '⚠️ 无法给自己发送私聊消息。' : 
                `⚠️ 错误：用户 ${recipient} 不在线或不存在。`;

            // 发送系统消息回给发送者
            socket.emit('public message', {
                user: 'system',
                text: errorText
            });
            console.log(`[Private Fail] ${sender} to ${recipient}. Error: Recipient not found.`);
        }
    });

    // [4] 用户断开连接
    socket.on('disconnect', () => {
        const username = socket.username;

        if (username) {
            console.log(`[Disconnect] User ${username} disconnected.`);
            
            // 从用户映射中删除该用户
            delete users[username];
            
            // 广播用户下线消息
            io.emit('user disconnected', username); 
            
            // 广播更新后的在线用户列表
            broadcastOnlineUsers();
        } else {
            console.log(`[Disconnect] Unknown socket disconnected: ${socket.id}`);
        }
    });
});

// ------------------ 启动服务器 ------------------

server.listen(PORT, () => {
    console.log(`Chat server running at http://localhost:${PORT}`);
    console.log(`Socket.IO listening on port ${PORT}`);
});
