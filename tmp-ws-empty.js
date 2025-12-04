const WebSocket = require('ws');
const url = 'wss://xezslsyxjivunmhhyxtd.supabase.co/realtime/v1/websocket?apikey=&vsn=1.0.0';
const ws = new WebSocket(url);
ws.on('open', () => { console.log('open'); ws.close(); });
ws.on('error', err => { console.error('error', err.message); });
ws.on('close', (code, reason) => { console.log('close', code, reason.toString()); });
