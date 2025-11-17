// server.js (最终修正版本 - 简单聊天 + 云部署兼容)
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

// 存储在线用户列表 { socketId: username }
const onlineUsers = {};

// 默认路由：返回 index.html 文件 (解决 404 错误的关键)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 监听 Socket.IO 连接
io.on('connection', (socket) => {
    let currentUsername = null; 

    // 接收新用户上线事件 (客户端在“登录”后发送)
    socket.on('new user', (username) => {
        if (!username || onlineUsers[socket.id]) return; 

        currentUsername = username;
        onlineUsers[socket.id] = currentUsername;
        
        console.log(`用户 ${currentUsername} (${socket.id}) 已连接`);
        
        socket.broadcast.emit('user connected', currentUsername);
        io.emit('online users', Object.values(onlineUsers));
    });

    // 接收并广播聊天消息
    socket.on('chat message', (msgData) => {
        if (!currentUsername) return;

        msgData.user = currentUsername;
        msgData.timestamp = new Date().toISOString(); 
        
        console.log(`[${msgData.user}]: ${msgData.text}`);
        
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

// ----------------------------------------------------
// 🚨 关键修正：使用 process.env.PORT 以兼容云部署环境
// ----------------------------------------------------

const PORT = process.env.PORT || 3000;

http.listen(PORT, () => {
    // 这里的 console.log 不再硬编码 http://localhost:3000
    console.log(`🚀 服务器已在端口 ${PORT} 运行`); 
    console.log(`➡️ 请在浏览器中输入昵称登录`);
});
