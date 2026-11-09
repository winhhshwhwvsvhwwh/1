const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
let definition;
let rects = [{ height: 500, bottom: 650 }, { bottom: 1000 }, { top: 686 }];
const wx = {
  getWindowInfo: () => ({ windowHeight: 813 }),
  createSelectorQuery() { return { in() { return this; }, select() { return this; }, boundingClientRect() { return this; }, exec(cb) { cb(rects); } }; }
};
vm.runInNewContext(fs.readFileSync(require.resolve('../pages/chat/chat.js'), 'utf8'), { require: () => ({}), wx, Page: p => { definition = p; } });
const p = { ...definition, data: { ...definition.data, pageMode: 'chat' }, setData(values, cb) { Object.assign(this.data, values); if (cb) cb(); } };
p.refreshScrollShortcut();assert.equal(p.data.showScrollShortcut, true);assert.equal(p.data.scrollShortcutBottom, 147);
p.onMessageScroll({ detail: { scrollHeight: 1000, scrollTop: 490 } });assert.equal(p.data.showScrollShortcut, false);
p.onMessageScroll({ detail: { scrollHeight: 1000, scrollTop: 100 } });assert.equal(p.data.showScrollShortcut, true);
p.onScrollShortcut();assert.equal(p.data.scrollToId, 'chat-bottom');assert.equal(p.data.showScrollShortcut, false);
p.onMessageScroll({ detail: { scrollHeight: 1000, scrollTop: 200 } });assert.equal(p.data.showScrollShortcut, false);
p.onMessageScroll({ detail: { scrollHeight: 1000, scrollTop: 500 } });assert.equal(p._scrollingToEnd, false);
p.onScrollTouchStart();p.onMessageScroll({ detail: { scrollHeight: 1000, scrollTop: 100 } });assert.equal(p.data.showScrollShortcut, true);
p.data.showDimensions = true;p.onMessageScroll({ detail: { scrollHeight: 1000, scrollTop: 100 } });assert.equal(p.data.showScrollShortcut, false);
p.data.showDimensions = false;p.data.pageMode = 'home';p.refreshScrollShortcut();assert.equal(p.data.showScrollShortcut, false);
p.data.pageMode = 'assessment';p.data.assessmentMode = 'quiz';p.refreshScrollShortcut();assert.equal(p.data.showScrollShortcut, false);
p.data.assessmentMode = 'result';p.refreshScrollShortcut();assert.equal(p.data.showScrollShortcut, true);
rects = [{ height: 500, bottom: 650 }, { bottom: 640 }, { top: 686 }];p.refreshScrollShortcut();assert.equal(p.data.showScrollShortcut, false);
console.log('PASS scroll arrow visibility, dock positioning, tap, animation, manual scrolling, short pages and dimensions overlay');
// Text growth must not be mistaken for the user reading older content.
p.data.pageMode='chat';p.data.showDimensions=false;p.data.messages=[{id:1,role:'assistant',animate:true}];
p._answerFollowPaused=false;p.onAnswerTypingProgress();assert.equal(p.data.answerTyping,true);assert.equal(p.data.scrollToId,'chat-bottom');
p.onMessageScroll({detail:{scrollHeight:1300,scrollTop:500}});assert.equal(p.data.showScrollShortcut,false);
p.onScrollTouchStart({touches:[{clientY:200}]});p.onScrollTouchMove({touches:[{clientY:240}]});assert.equal(p._answerFollowPaused,true);assert.equal(p.data.scrollToId,'');
p.onAnswerTypingProgress();assert.equal(p.data.scrollToId,'');assert.equal(p.data.showScrollShortcut,true);
p.onAnswerTypingComplete({currentTarget:{dataset:{id:1}}});assert.equal(p.data.answerTyping,false);assert.equal(p.data.scrollToId,'');
p.onScrollShortcut();p.onAnswerTypingProgress();assert.equal(p._answerFollowPaused,false);assert.equal(p.data.scrollToId,'chat-bottom');
p.onAnswerTypingComplete({currentTarget:{dataset:{id:1}}});assert.equal(p.data.messages[0].animate,false);assert.equal(p.data.answerTyping,false);
console.log('PASS typing growth follows bottom, upward history gesture pauses, completion respects pause, bottom shortcut resumes');
