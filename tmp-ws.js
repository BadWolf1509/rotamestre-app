require('dotenv').config({path:'.env'});
const WebSocket = require('ws');
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const url = 'wss://xezslsyxjivunmhhyxtd.supabase.co/realtime/v1/websocket?apikey=' + key + '&vsn=1.0.0';
console.log('ws url', url.replace(key, '***'));
const ws = new WebSocket(url);
ws.on('open', () => { console.log('open'); ws.close(); });
ws.on('error', err => { console.error('error', err.message); });
ws.on('close', (code, reason) => { console.log('close', code, reason.toString()); });
