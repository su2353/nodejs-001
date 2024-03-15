const net = require('net');
const { WebSocket, createWebSocketStream } = require('ws');
const { TextDecoder } = require('util');

// 简化日志输出函数
const log = (...args) => console.log(...args);
const error = (...args) => console.error(...args);

// 处理 UUID 和端口
const uuid = (process.env.UUID || '86dd8a97-7410-40a5-9a0e-0f989d30e292').replace(/-/g, "");
const port = process.env.PORT || 3000;

// 创建 WebSocket 服务器
const wss = new WebSocket.Server({ port }, () => log('WebSocket 服务器启动，监听端口:', port));

// 处理 WebSocket 连接
wss.on('connection', ws => {
    log('建立 WebSocket 连接');
    ws.once('message', msg => {
        // 解析消息
        const [VERSION] = msg;
        const id = msg.slice(1, 17);
        if (!id.every((v, i) => v === parseInt(uuid.substr(i * 2, 2), 16))) return;
        let i = msg.slice(17, 18).readUInt8() + 19;
        const port = msg.slice(i, i += 2).readUInt16BE(0);
        const ATYP = msg.slice(i, i += 1).readUInt8();
        const host = ATYP === 1 ? msg.slice(i, i += 4).join('.') :
            (ATYP === 2 ? new TextDecoder().decode(msg.slice(i + 1, i += 1 + msg.slice(i, i + 1).readUInt8())) :
                (ATYP === 3 ? msg.slice(i, i += 16).reduce((s, b, i, a) => (i % 2 ? s.concat(a.slice(i - 1, i + 1)) : s), []).map(b => b.readUInt16BE(0).toString(16)).join(':') : ''));

        log('连接到:', host, port);

        // 发送响应消息
        ws.send(new Uint8Array([VERSION, 0]));

        // 创建 WebSocket 流
        const duplex = createWebSocketStream(ws);

        // 建立 TCP 连接
        net.connect({ host, port }, function () {
            // 发送剩余的消息
            this.write(msg.slice(i));
            // 处理数据流
            duplex.on('error', error('E1:')).pipe(this).on('error', error('E2:')).pipe(duplex);
        }).on('error', error('连接错误:', { host, port }));
    }).on('error', error('WebSocket 错误:'));
});
