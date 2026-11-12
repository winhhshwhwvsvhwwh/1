// Report transport contracts are retained in the archived module tests; current app disables uploads.
const assert=require('node:assert/strict'),fs=require('node:fs');
const config=require('../utils/constants');assert.equal(config.REPORT_VISION.enabled,false);assert.equal(config.USE_CLOUD,false);
const template=fs.readFileSync(require.resolve('../pages/chat/chat.wxml'),'utf8');assert(template.includes('bindtap="onReportClick"'));assert(template.includes('/images/campaign/shortcut-report.png'));assert(!template.includes('bindtap="onProfileClick"'));
global.wx={};const client=require('../utils/reportClient');
(async()=>{await assert.rejects(client.recognizeReport('never-read.jpg',''),/尚未启用/);console.log('PASS report disabled before file read/upload; original report button artwork restored; global USE_CLOUD remains false');})().catch(e=>{console.error(e);process.exitCode=1});
