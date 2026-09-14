import test from 'node:test';
import assert from 'node:assert/strict';
import {createDraft} from '../src/draft.mjs';
const plan={id:'plan',title:'ALP',sections:{strengths:'Original'},revision:1,status:'DRAFT',reviewDate:null};
test('edits during a save remain dirty and use the acknowledged revision next time',async()=>{
  let resolveSave;const bodies=[];const draft=createDraft(body=>{bodies.push(body);return new Promise(resolve=>{resolveSave=resolve;});});draft.load(plan);draft.change({sections:{strengths:'First'}});const first=draft.save();draft.change({sections:{strengths:'Second'}});resolveSave({...plan,revision:2});await first;assert.equal(draft.getSnapshot().plan.sections.strengths,'Second');assert.equal(draft.getSnapshot().dirty,true);const second=draft.save();assert.equal(bodies[1].revision,2);resolveSave({...plan,revision:3});await second;assert.equal(draft.getSnapshot().dirty,false);
});
test('conflicts preserve the local draft and never advance its revision',async()=>{const draft=createDraft(async()=>{throw new Error('Conflict: reload latest version.');});draft.load(plan);draft.change({title:'Local'});await assert.rejects(draft.save(),/Conflict/);assert.equal(draft.getSnapshot().plan.title,'Local');assert.equal(draft.getSnapshot().plan.revision,1);assert.equal(draft.getSnapshot().dirty,true);});
test('status transitions are saved explicitly',async()=>{let sent;const draft=createDraft(async body=>{sent=body;return {...body,revision:2};});draft.load(plan);await draft.save('IN_REVIEW');assert.equal(sent.status,'IN_REVIEW');assert.equal(draft.getSnapshot().plan.status,'IN_REVIEW');assert.equal(draft.getSnapshot().dirty,false);});
