// server.js (简化版 - 仅实时聊天，无数据库/无认证)
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

// 存储在线用户列表 { socketId: username }
const onlineUsers = {};

// 默认路由：返回 index.html 文件
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 监听 Socket.IO 连接
io.on('connection', (socket) => {
    let currentUsername = null; // 用户未连接时为 null

    // 接收新用户上线事件 (客户端在“登录”后发送)
    socket.on('new user', (username) => {
        // 确保用户名非空，并且该 socketID 尚未被分配用户名
        if (!username || onlineUsers[socket.id]) return; 

        currentUsername = username;
        onlineUsers[socket.id] = currentUsername;
        
        console.log(`用户 ${currentUsername} (${socket.id}) 已连接`);
        
        // 广播有人上线
        socket.broadcast.emit('user connected', currentUsername);
        
        // 广播最新的在线用户列表给所有连接者
        io.emit('online users', Object.values(onlineUsers));
    });

    // 接收并广播聊天消息
    socket.on('chat message', (msgData) => {
        // 只有已注册/登录的用户才能发送消息
        if (!currentUsername) return;

        // 服务器端重新附加用户名和时间戳，确保数据一致
        msgData.user = currentUsername;
        msgData.timestamp = new Date().toISOString(); 
        
        console.log(`[${msgData.user}]: ${msgData.text}`);
        
        // 广播给所有连接的用户 (包括发送者自己)
        io.emit('chat message', msgData); 
    });

    // 用户断开连接 (下线检测)
    socket.on('disconnect', () => {
        const disconnectedUsername = onlineUsers[socket.id];
        delete onlineUsers[socket.id]; 
        
        if (disconnectedUsername) {
            console.log(`用户 ${disconnectedUsername} 已断开`);
            
            io.emit('user disconnected', disconnectedUsername);
            io.emit('online users', Object.values(onlineUsers));
        }
    });
});

// 启动服务器
const PORT = 3000;
http.listen(PORT, () => {
    console.log(`🚀 服务器已在 http://localhost:${PORT} 运行`);
    console.log(`➡️ 请在浏览器中输入昵称登录`);
});