const fs = require('fs');
const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const path = require("path"); 
const { Server } = require("socket.io");
const io = new Server(server);
var usernames = []; 

// per-user spam protection: each user starts with a default limit
let userSpamCounts = {}; 
const defaultSpamLimit = 6; 

// reset each user's spam count every 3000ms
setInterval(() => {
    for (let user in userSpamCounts) {
        userSpamCounts[user] = defaultSpamLimit;
    }
}, 6000); 

app.use('/static', express.static('public'))
io.on('connection', (socket) => {
    const clientIp = 1010;
    console.log("ip connected: " + clientIp); 
    socket.join("global"); 
    for (let i = 0; i < chatLogArray.length; i++) {
        if (chatLogArray[i][2] == "global") {
            var string = chatLogArray[i][0] + ": " + chatLogArray[i][1]; 
            socket.emit("logUpdate", string); 
        }
    }
    socket.on('signupMessage', (msg) => {
        if (checkForUser(msg[0].replace(/[\u0000-\u001F\u007F-\u009F\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, ""))) {
            socket.emit("taken", ""); 
        } else {
            if (msg[0].length < 50 && msg[1].length < 50) {
                pushUser(msg[0], msg[1]); 
                socket.emit("signupSuccess", [msg[0], msg[1]]); 
            } else {
                socket.emit("taken", ""); 
            }
        }
    });
    socket.on('joinRequest', (msg) => { 
        socket.leave(msg[1]); 
        socket.join(msg[0]); 
        socket.emit("logUpdate", "Joined " + msg[0]); 
        var msgs = filterByThirdValue(chatLogArray, msg[0]);
        for (let i = 0; i < msgs.length; i++) {
            var string = msgs[i][0] + ": " + msgs[i][1]; 
            socket.emit("logUpdate", string); 
        }
    });
    socket.on('userMessage', (msg) => { 
        if (getPass(msg[2]) == msg[3]) {
            if ((msg[0].length + msg[2].length) < 5000) {
                if (msg[1] == "global") {
                    // initialize spam count for this user if not already set
                    if (userSpamCounts[msg[2]] === undefined) {
                        userSpamCounts[msg[2]] = defaultSpamLimit;
                    }
                    // decrement this user's spam count
                    userSpamCounts[msg[2]] -= 1; 
                    if (userSpamCounts[msg[2]] <= 0) {
                        socket.emit("siddartha", ":(");
                        io.to("global").emit('logUpdate', msg[2] + " just got rickrolled for spamming. ");
                        pushToLogs(msg[2], "just got rickrolled for spamming. ", "global");
                        chatLogArray = readLogs();
                    }
                }
                pushToLogs(msg[2], msg[0], msg[1]); 
                var string = msg[2] + ": " + msg[0]; 
                io.to(msg[1]).emit("logUpdate", string); 
                chatLogArray = readLogs(); 
            } else {
                socket.emit("userError", "Message is over 5000 characters"); 
            }
        } else {
            socket.emit('siddartha', ":(");
        }
    });
    socket.on('verification', (msg) => {
        if (checkForUser(msg[0])) {
            if (getPass(msg[0]) == msg[1]) {
                socket.emit("verified", "yay"); 
            } else {
                socket.emit("siddartha", ":(");
            }
        } else {
            socket.emit("siddartha", ":(");
        }
    });
    socket.on('loginMessage', (msg) => {
        if (checkForUser(msg[0].replace(/[\u0000-\u001F\u007F-\u009F\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, ""))) {
            if (getPass(msg[0])) {
                if (msg[1] == getPass(msg[0].replace(/[\u0000-\u001F\u007F-\u009F\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, ""))) { 
                    socket.emit("loginSuccess", [msg[0], msg[1]]); 
                } else {
                    socket.emit("false", ""); 
                }
            } else {
                socket.emit("false", ""); 
            }
        } else {
            socket.emit("false", ""); 
        }
    });
    console.log('a user connected');
    socket.on('disconnect', () => {
        console.log('user disconnected');
    });
});

app.get('/rick', (req, res) => {
    res.sendFile(path.join(__dirname, 'rick.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'signup.html'));
});
app.get('/svelt', (req, res) => {
    res.sendFile(path.join(__dirname, 'svelt.html'));
});

server.listen(3000, () => {
    console.log('listening on 3000');
});

// read logs and user functions

const usersFilePath = path.join(__dirname, 'users.json');
const usersChatPath = path.join(__dirname, 'chats.json');

// read all entries from the json file and convert to an array of subarrays
function readLogs() {
    try {
        const data = fs.readFileSync(usersChatPath, 'utf8');
        const logs = JSON.parse(data);
        // convert logs to an array of subarrays
        return logs.map(log => [log.name, log.value, log.server]);
    } catch (error) {
        console.error("error reading the file:", error);
        return [];
    }
}

// push a new entry to the logs file
function pushToLogs(username, value, server) {
    const newLog = {
        name: username,
        value: value,
        server: server
    };
  
    try {
        const data = fs.readFileSync(usersChatPath, 'utf8');
        const logs = JSON.parse(data);
        // add the new log to the logs array
        logs.push(newLog);
        // write the updated logs back to the file
        fs.writeFileSync(usersChatPath, JSON.stringify(logs, null, 2), 'utf8');
        console.log('log added successfully!');
    } catch (error) {
        console.error("error reading or writing the file:", error);
    }
}
  
// function to check if a user exists
function checkForUser(name) {
    const users = JSON.parse(fs.readFileSync(usersFilePath, 'utf-8'));
    return users.some(user => user.name === name);
}

// function to add a new user
function pushUser(name, pass) {
    const users = JSON.parse(fs.readFileSync(usersFilePath, 'utf-8'));
    if (!checkForUser(name)) {
        users.push({ name, pass });
        fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));
        return true; // user added
    }
    return false; // user already exists
}

// function to get a user's password
function getPass(name) {
    const users = JSON.parse(fs.readFileSync(usersFilePath, 'utf-8'));
    const user = users.find(user => user.name === name);
    return user ? user.pass : null; // return password or null if not found
}

const filterByThirdValue = (arr, target) => 
    arr.filter(item => item[2] === target);

var chatLogArray = readLogs();
