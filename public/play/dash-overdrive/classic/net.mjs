// The game name and server shared by the room-code race (online.mjs) and
// accounts, friends and friend chat (social-ui.mjs).
// Tests point the page at a server on this computer with ?net=http://127.0.0.1:8787.
// Only this computer's address is taken, so a password never goes to someone else's server.
import {DEFAULT_SERVER} from './net-client/index.mjs';

export const GAME = 'dash-classic';
const LOOPBACK = /^(https?|wss?):\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?\/?$/;
const asked = new URLSearchParams(location.search).get('net');
export const server = asked && LOOPBACK.test(asked) ? asked.replace(/\/+$/, '') : DEFAULT_SERVER;
export const testServer = server !== DEFAULT_SERVER;
// The real server only answers pages on seonn.dev (and this computer), so a test
// copy on another address (192.168…, a Vercel preview) can't log in or make rooms.
const SITES = ['seonn.dev', 'www.seonn.dev', 'localhost', '127.0.0.1'];
export const offSite = !testServer && !SITES.includes(location.hostname);
export const OFF_SITE_MESSAGE = '테스트 서버 주소에서는 서버가 연결을 받아 주지 않아. seonn.dev 에서 해 줘.';
