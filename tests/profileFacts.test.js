const assert=require('node:assert/strict');const facts=require('../utils/profileFacts');
assert.deepEqual(facts.extract('我32岁，备孕半年，周期28天，经期5天'),{age:32,preparingMonths:6,cycleLength:28,periodLength:5});
assert.equal(facts.extract('我备孕一年半').preparingMonths,18);assert.deepEqual(facts.extract('比如我32岁'),{});assert.deepEqual(facts.extract('我朋友32岁'),{});assert.deepEqual(facts.extract('我不是32岁'),{});
assert.deepEqual(facts.extract('备孕半年以上需要关注什么？'),{});
console.log('PASS explicit profile proposals and hypothetical/third-party rejection');
