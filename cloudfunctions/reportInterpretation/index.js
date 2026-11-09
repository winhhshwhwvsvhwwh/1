// No report persistence and no logging of images, medical values or credentials.
const cloud=require('wx-server-sdk');
const {createHandler}=require('./core');
const {callModel}=require('./modelClient');
cloud.init({env:cloud.DYNAMIC_CURRENT_ENV});
exports.main=createHandler({callModel,getContext:()=>cloud.getWXContext()});
